-- Arabic Hunt Battle v0.5.0 — stability patch
-- Run AFTER 202609230001_admin_credentials.sql.
-- Fixes:
-- 1) room-code generation no longer depends on pgcrypto search_path
-- 2) create/join no longer broadcast before the client can subscribe
-- 3) all RPC table references are qualified to avoid PL/pgSQL ambiguity
-- 4) Realtime broadcast failures never roll back authoritative game state
-- 5) countdown increased to 5 seconds to give clients time to enter the 3D scene

create or replace function public.ahb_safe_broadcast(
  p_topic text,
  p_event text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  perform realtime.send(p_payload,p_event,p_topic,true);
exception when others then
  raise warning 'AHB realtime broadcast skipped: %', sqlerrm;
end;
$$;

revoke all on function public.ahb_safe_broadcast(text,text,jsonb) from public;


create or replace function public.ahb_server_now()
returns timestamptz
language sql
security definer
set search_path=public,pg_temp
as $$ select clock_timestamp(); $$;

revoke all on function public.ahb_server_now() from public;
grant execute on function public.ahb_server_now() to authenticated;

create or replace function public.create_hunt_match(
  p_game_mode text default '3d',
  p_max_players integer default 4,
  p_target_count integer default 12,
  p_duration_seconds integer default 180,
  p_difficulty text default 'medium',
  p_world_slug text default 'student-room',
  p_as_spectator boolean default false
)
returns table(match_id uuid, room_code text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_world uuid;
  v_match uuid;
  v_code text;
  v_seed bigint;
  v_actual integer;
begin
  if v_user is null or not public.is_active_user(v_user) then raise exception 'AUTH_REQUIRED'; end if;
  if p_game_mode not in ('3d','ar') then raise exception 'INVALID_MODE'; end if;
  if p_max_players<2 or p_max_players>8 then raise exception 'PLAYERS_2_TO_8'; end if;
  if p_target_count<1 or p_target_count>20 then raise exception 'TARGETS_1_TO_20'; end if;
  if p_duration_seconds<30 or p_duration_seconds>1800 then raise exception 'INVALID_DURATION'; end if;
  if p_difficulty not in ('easy','medium','hard') then raise exception 'INVALID_DIFFICULTY'; end if;

  select w.id into v_world
  from public.worlds as w
  where w.slug=p_world_slug and w.active=true;
  if v_world is null then raise exception 'WORLD_NOT_FOUND'; end if;

  loop
    -- md5 is built into PostgreSQL, avoiding extension/search_path issues.
    v_code:=upper(substr(md5(random()::text||clock_timestamp()::text||v_user::text),1,6));
    exit when not exists(select 1 from public.matches as m where m.room_code=v_code);
  end loop;

  v_seed:=floor(random()*2000000000)::bigint;

  insert into public.matches as m(room_code,host_id,world_id,game_mode,max_players,target_count,duration_seconds,difficulty,seed,status)
  values(v_code,v_user,v_world,p_game_mode,p_max_players,p_target_count,p_duration_seconds,p_difficulty,v_seed,'waiting')
  returning m.id into v_match;

  insert into public.match_players(match_id,player_id,role,ready)
  values(v_match,v_user,case when p_as_spectator then 'spectator' else 'host' end,p_as_spectator);

  insert into public.match_targets(match_id,object_id,vocabulary_id,points,sort_order)
  select v_match,wo.object_id,wo.vocabulary_id,v.points,
         (row_number() over(order by md5(wo.object_id||v_seed::text)))::integer
  from public.world_objects as wo
  join public.vocabulary as v on v.id=wo.vocabulary_id
  where wo.world_id=v_world
    and wo.targetable=true
    and (
      p_difficulty='hard'
      or (p_difficulty='medium' and v.difficulty in ('easy','medium'))
      or (p_difficulty='easy' and v.difficulty='easy')
    )
  order by md5(wo.object_id||v_seed::text)
  limit p_target_count;

  select count(*) into v_actual
  from public.match_targets as mt
  where mt.match_id=v_match;

  update public.matches as m
  set target_count=v_actual
  where m.id=v_match;

  -- Do not broadcast here: the creator does not know the topic until this RPC returns.
  return query select v_match,v_code;
end;
$$;

create or replace function public.join_hunt_match(p_room_code text)
returns table(match_id uuid, room_code text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_match public.matches%rowtype;
  v_count integer;
begin
  if v_user is null or not public.is_active_user(v_user) then raise exception 'AUTH_REQUIRED'; end if;

  select m.* into v_match
  from public.matches as m
  where m.room_code=upper(trim(p_room_code))
  for update;

  if v_match.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_match.status<>'waiting' then raise exception 'MATCH_ALREADY_STARTED'; end if;

  select count(*) into v_count
  from public.match_players as mp
  where mp.match_id=v_match.id and mp.role<>'spectator';

  if v_count>=v_match.max_players
     and not exists(
       select 1 from public.match_players as mp2
       where mp2.match_id=v_match.id and mp2.player_id=v_user
     )
  then raise exception 'ROOM_FULL';
  end if;

  insert into public.match_players(match_id,player_id,role,ready)
  values(v_match.id,v_user,'player',false)
  on conflict on constraint match_players_pkey do nothing;

  -- Presence sync will notify the lobby after this client subscribes.
  return query select v_match.id,v_match.room_code;
end;
$$;

create or replace function public.set_match_ready(p_match_id uuid,p_ready boolean)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null or not public.is_active_user(v_user) then raise exception 'AUTH_REQUIRED'; end if;
  update public.match_players as mp
  set ready=p_ready
  where mp.match_id=p_match_id and mp.player_id=v_user and mp.role<>'spectator';
  if not found then raise exception 'NOT_MEMBER'; end if;
  perform public.ahb_safe_broadcast('match:'||p_match_id::text,'PLAYER_READY',jsonb_build_object('match_id',p_match_id,'player_id',v_user,'ready',p_ready));
end;
$$;

create or replace function public.start_hunt_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_match public.matches%rowtype;
  v_count integer;
  v_unready integer;
  v_start timestamptz;
  v_end timestamptz;
begin
  select m.* into v_match from public.matches as m where m.id=p_match_id for update;
  if v_match.id is null or v_match.host_id<>auth.uid() or not public.is_active_user(auth.uid()) then raise exception 'HOST_ONLY'; end if;
  if v_match.status<>'waiting' then raise exception 'INVALID_STATUS'; end if;

  select count(*) filter(where mp.role<>'spectator'),
         count(*) filter(where mp.role<>'spectator' and not mp.ready)
  into v_count,v_unready
  from public.match_players as mp
  where mp.match_id=p_match_id;

  if v_count<2 then raise exception 'NEED_AT_LEAST_2_PLAYERS'; end if;
  if v_unready>0 then raise exception 'ALL_PLAYERS_MUST_BE_READY'; end if;

  v_start:=clock_timestamp()+interval '5 seconds';
  v_end:=v_start+make_interval(secs=>v_match.duration_seconds);

  update public.matches as m
  set status='countdown',started_at=v_start,ends_at=v_end,paused_remaining_seconds=null
  where m.id=p_match_id;

  perform public.ahb_safe_broadcast('match:'||p_match_id::text,'MATCH_START',jsonb_build_object('match_id',p_match_id,'starts_at',v_start,'ends_at',v_end,'seed',v_match.seed));
end;
$$;

create or replace function public.pause_hunt_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_remaining integer;
begin
  if not public.is_match_host(p_match_id) then raise exception 'HOST_ONLY'; end if;

  select greatest(0,ceil(extract(epoch from (m.ends_at-clock_timestamp())))::integer)
  into v_remaining
  from public.matches as m
  where m.id=p_match_id and m.status in ('countdown','running')
  for update;

  if v_remaining is null then raise exception 'INVALID_STATUS'; end if;

  update public.matches as m
  set status='paused',paused_remaining_seconds=v_remaining
  where m.id=p_match_id;

  perform public.ahb_safe_broadcast('match:'||p_match_id::text,'MATCH_PAUSE',jsonb_build_object('match_id',p_match_id,'remaining_seconds',v_remaining));
end;
$$;

create or replace function public.resume_hunt_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_remaining integer;v_end timestamptz;
begin
  if not public.is_match_host(p_match_id) then raise exception 'HOST_ONLY'; end if;

  select m.paused_remaining_seconds into v_remaining
  from public.matches as m
  where m.id=p_match_id and m.status='paused'
  for update;

  if v_remaining is null then raise exception 'INVALID_STATUS'; end if;
  v_end:=clock_timestamp()+make_interval(secs=>v_remaining);

  update public.matches as m
  set status='running',ends_at=v_end,paused_remaining_seconds=null
  where m.id=p_match_id;

  perform public.ahb_safe_broadcast('match:'||p_match_id::text,'MATCH_RESUME',jsonb_build_object('match_id',p_match_id,'ends_at',v_end));
end;
$$;

create or replace function public.claim_hunt_target(p_match_id uuid,p_object_id text)
returns table(
  ok boolean,
  reason text,
  target_id uuid,
  object_id text,
  player_id uuid,
  points_awarded integer,
  score integer,
  combo integer,
  best_combo integer,
  match_ended boolean
)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_match public.matches%rowtype;
  v_target public.match_targets%rowtype;
  v_claimed public.match_targets%rowtype;
  v_combo integer:=0;
  v_best integer:=0;
  v_score integer:=0;
  v_award integer:=0;
  v_bonus integer:=0;
  v_ended boolean:=false;
begin
  if v_user is null or not public.is_match_member(p_match_id,v_user) then
    return query select false,'not_member',null::uuid,p_object_id,v_user,0,0,0,0,false;
    return;
  end if;

  select m.* into v_match
  from public.matches as m
  where m.id=p_match_id
  for update;

  if v_match.id is null then
    return query select false,'not_member',null::uuid,p_object_id,v_user,0,0,0,0,false;
    return;
  end if;

  if v_match.status='countdown' and clock_timestamp()>=v_match.started_at then
    update public.matches as m set status='running' where m.id=p_match_id;
    v_match.status:='running';
  end if;

  if v_match.status='ended' or (v_match.ends_at is not null and clock_timestamp()>=v_match.ends_at) then
    update public.matches as m
    set status='ended',ended_at=coalesce(m.ended_at,clock_timestamp())
    where m.id=p_match_id;

    select mp.score into v_score
    from public.match_players as mp
    where mp.match_id=p_match_id and mp.player_id=v_user;

    return query select false,'ended',null::uuid,p_object_id,v_user,0,coalesce(v_score,0),0,0,true;
    return;
  end if;

  if v_match.status<>'running' then
    select mp.score,mp.combo,mp.best_combo into v_score,v_combo,v_best
    from public.match_players as mp
    where mp.match_id=p_match_id and mp.player_id=v_user;
    return query select false,'not_running',null::uuid,p_object_id,v_user,0,coalesce(v_score,0),coalesce(v_combo,0),coalesce(v_best,0),false;
    return;
  end if;

  select mt.* into v_target
  from public.match_targets as mt
  where mt.match_id=p_match_id and mt.object_id=p_object_id;

  if v_target.id is null then
    update public.match_players as mp
    set score=greatest(0,mp.score-15),wrong_taps=mp.wrong_taps+1,combo=0
    where mp.match_id=p_match_id and mp.player_id=v_user
    returning mp.score,mp.best_combo into v_score,v_best;

    insert into public.claims(match_id,target_id,player_id,object_id,correct,points_awarded,reason)
    values(p_match_id,null,v_user,p_object_id,false,-15,'wrong');

    perform public.ahb_safe_broadcast('match:'||p_match_id::text,'CLAIM_REJECTED',jsonb_build_object('match_id',p_match_id,'player_id',v_user,'object_id',p_object_id,'reason','wrong','score',v_score));
    return query select false,'wrong',null::uuid,p_object_id,v_user,-15,coalesce(v_score,0),0,coalesce(v_best,0),false;
    return;
  end if;

  if v_target.claimed_by is not null then
    select mp.score,mp.combo,mp.best_combo into v_score,v_combo,v_best
    from public.match_players as mp
    where mp.match_id=p_match_id and mp.player_id=v_user;

    insert into public.claims(match_id,target_id,player_id,object_id,correct,points_awarded,reason)
    values(p_match_id,v_target.id,v_user,p_object_id,false,0,'already_claimed');

    return query select false,'already_claimed',v_target.id,p_object_id,v_user,0,coalesce(v_score,0),coalesce(v_combo,0),coalesce(v_best,0),false;
    return;
  end if;

  update public.match_targets as mt
  set claimed_by=v_user,claimed_at=clock_timestamp()
  where mt.id=v_target.id and mt.claimed_by is null
  returning mt.* into v_claimed;

  if v_claimed.id is null then
    select mp.score,mp.combo,mp.best_combo into v_score,v_combo,v_best
    from public.match_players as mp
    where mp.match_id=p_match_id and mp.player_id=v_user;
    return query select false,'already_claimed',v_target.id,p_object_id,v_user,0,coalesce(v_score,0),coalesce(v_combo,0),coalesce(v_best,0),false;
    return;
  end if;

  select mp.combo into v_combo
  from public.match_players as mp
  where mp.match_id=p_match_id and mp.player_id=v_user
  for update;

  v_combo:=coalesce(v_combo,0)+1;
  v_bonus:=least(40,greatest(0,v_combo-1)*10);
  v_award:=v_claimed.points+v_bonus;

  update public.match_players as mp
  set score=mp.score+v_award,
      claims=mp.claims+1,
      combo=v_combo,
      best_combo=greatest(mp.best_combo,v_combo)
  where mp.match_id=p_match_id and mp.player_id=v_user
  returning mp.score,mp.best_combo into v_score,v_best;

  insert into public.claims(match_id,target_id,player_id,object_id,correct,points_awarded,reason)
  values(p_match_id,v_claimed.id,v_user,p_object_id,true,v_award,'accepted');

  select not exists(
    select 1 from public.match_targets as mt
    where mt.match_id=p_match_id and mt.claimed_by is null
  ) into v_ended;

  if v_ended then
    update public.matches as m set status='ended',ended_at=clock_timestamp() where m.id=p_match_id;
  end if;

  perform public.ahb_safe_broadcast('match:'||p_match_id::text,'TARGET_CLAIMED',jsonb_build_object('match_id',p_match_id,'target_id',v_claimed.id,'object_id',p_object_id,'player_id',v_user,'points',v_award,'score',v_score,'combo',v_combo,'match_ended',v_ended));
  if v_ended then
    perform public.ahb_safe_broadcast('match:'||p_match_id::text,'MATCH_END',jsonb_build_object('match_id',p_match_id,'reason','all_claimed'));
  end if;

  return query select true,'accepted',v_claimed.id,p_object_id,v_user,v_award,coalesce(v_score,0),v_combo,coalesce(v_best,0),v_ended;
end;
$$;

create or replace function public.finish_hunt_match_if_due(p_match_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare v_changed boolean:=false;
begin
  if not public.is_match_member(p_match_id) then return false; end if;

  update public.matches as m
  set status='ended',ended_at=clock_timestamp()
  where m.id=p_match_id
    and m.status in ('countdown','running')
    and m.ends_at<=clock_timestamp();

  v_changed:=found;
  if v_changed then
    perform public.ahb_safe_broadcast('match:'||p_match_id::text,'MATCH_END',jsonb_build_object('match_id',p_match_id,'reason','timer'));
  end if;
  return v_changed;
end;
$$;

revoke all on function public.create_hunt_match(text,integer,integer,integer,text,text,boolean) from public;
revoke all on function public.join_hunt_match(text) from public;
revoke all on function public.set_match_ready(uuid,boolean) from public;
revoke all on function public.start_hunt_match(uuid) from public;
revoke all on function public.pause_hunt_match(uuid) from public;
revoke all on function public.resume_hunt_match(uuid) from public;
revoke all on function public.claim_hunt_target(uuid,text) from public;
revoke all on function public.finish_hunt_match_if_due(uuid) from public;

grant execute on function public.create_hunt_match(text,integer,integer,integer,text,text,boolean) to authenticated;
grant execute on function public.join_hunt_match(text) to authenticated;
grant execute on function public.set_match_ready(uuid,boolean) to authenticated;
grant execute on function public.start_hunt_match(uuid) to authenticated;
grant execute on function public.pause_hunt_match(uuid) to authenticated;
grant execute on function public.resume_hunt_match(uuid) to authenticated;
grant execute on function public.claim_hunt_target(uuid,text) to authenticated;
grant execute on function public.finish_hunt_match_if_due(uuid) to authenticated;
