-- Arabic Hunt Battle v0.4.0 — Realtime Multiplayer Core
-- Run after 202609210001_initial.sql

create extension if not exists pgcrypto;

-- ---------- Schema upgrades ----------
alter table public.matches add column if not exists difficulty text not null default 'medium';
alter table public.matches add column if not exists ends_at timestamptz;
alter table public.matches add column if not exists paused_remaining_seconds integer;
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add constraint matches_status_check check (status in ('waiting','countdown','running','paused','ended'));
alter table public.matches drop constraint if exists matches_difficulty_check;
alter table public.matches add constraint matches_difficulty_check check (difficulty in ('easy','medium','hard'));

alter table public.match_players add column if not exists role text not null default 'player';
alter table public.match_players add column if not exists combo integer not null default 0;
alter table public.match_players add column if not exists best_combo integer not null default 0;
alter table public.match_players drop constraint if exists match_players_role_check;
alter table public.match_players add constraint match_players_role_check check (role in ('host','player','spectator')) not valid;
alter table public.match_players validate constraint match_players_role_check;

alter table public.match_targets add column if not exists sort_order integer not null default 0;
alter table public.claims add column if not exists reason text;

create table if not exists public.world_objects (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds(id) on delete cascade,
  object_id text not null,
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  targetable boolean not null default true,
  unique(world_id, object_id)
);

create index if not exists idx_match_players_player on public.match_players(player_id,match_id);
create index if not exists idx_match_targets_match_claimed on public.match_targets(match_id,claimed_by);
create index if not exists idx_claims_match_created on public.claims(match_id,created_at);
create index if not exists idx_matches_room_code on public.matches(room_code);

-- ---------- Seed production Student Room vocabulary ----------
insert into public.worlds(slug,name,name_ar,active,ar_scale)
values ('student-room','Student Room','غُرْفَةُ الطَّالِبِ',true,0.1)
on conflict(slug) do update set name=excluded.name,name_ar=excluded.name_ar,active=true,ar_scale=excluded.ar_scale;

insert into public.vocabulary(slug,arabic,transliteration,meaning_id,meaning_en,category,difficulty,points) values
('book','كِتَابٌ','kitābun','Buku','Book','study','easy',50),
('redBook','كِتَابٌ أَحْمَرُ','kitābun aḥmaru','Buku merah','Red book','study','medium',80),
('blueBook','كِتَابٌ أَزْرَقُ','kitābun azraqu','Buku biru','Blue book','study','medium',80),
('chair','كُرْسِيٌّ','kursiyyun','Kursi','Chair','furniture','easy',50),
('desk','مَكْتَبٌ','maktabun','Meja belajar','Desk','furniture','easy',50),
('lamp','مِصْبَاحٌ','miṣbāḥun','Lampu','Lamp','room','easy',50),
('bag','حَقِيبَةٌ','ḥaqībatun','Tas','Bag','school','easy',50),
('key','مِفْتَاحٌ','miftāḥun','Kunci','Key','object','medium',80),
('ballUnderBed','كُرَةٌ تَحْتَ السَّرِيرِ','kuratun taḥta as-sarīri','Bola di bawah tempat tidur','Ball under the bed','spatial','hard',120),
('bed','سَرِيرٌ','sarīrun','Tempat tidur','Bed','furniture','easy',50),
('pillow','وِسَادَةٌ','wisādatun','Bantal','Pillow','room','easy',50),
('wardrobe','خِزَانَةٌ','khizānatun','Lemari','Wardrobe','furniture','medium',80),
('window','نَافِذَةٌ','nāfidhatun','Jendela','Window','room','easy',50),
('door','بَابٌ','bābun','Pintu','Door','room','easy',50),
('clock','سَاعَةٌ','sāʿatun','Jam','Clock','room','easy',50),
('plant','نَبَاتٌ','nabātun','Tanaman','Plant','decor','easy',50),
('computer','حَاسُوبٌ','ḥāsūbun','Komputer','Computer','study','medium',80),
('keyboard','لَوْحَةُ الْمَفَاتِيحِ','lawḥatu al-mafātīḥ','Papan ketik','Keyboard','study','hard',120),
('mouse','فَأْرَةُ الْحَاسُوبِ','faʾratu al-ḥāsūb','Mouse komputer','Computer mouse','study','hard',120),
('notebook','دَفْتَرٌ','daftarun','Buku tulis','Notebook','study','easy',50),
('pen','قَلَمٌ','qalamun','Pena','Pen','study','easy',50),
('bottle','زُجَاجَةٌ','zujājatun','Botol','Bottle','object','medium',80),
('cup','كُوبٌ','kūbun','Cangkir','Cup','object','easy',50),
('rug','سَجَّادَةٌ','sajjādatun','Karpet','Rug','room','medium',80),
('shelf','رَفٌّ','raffun','Rak','Shelf','furniture','medium',80)
on conflict(slug) do update set arabic=excluded.arabic,transliteration=excluded.transliteration,meaning_id=excluded.meaning_id,meaning_en=excluded.meaning_en,category=excluded.category,difficulty=excluded.difficulty,points=excluded.points;

with w as (select id from public.worlds where slug='student-room')
insert into public.world_objects(world_id,object_id,vocabulary_id,targetable)
select w.id,x.object_id,v.id,true from w cross join (values
('rug','rug'),('bed-frame','bed'),('pillow','pillow'),('desk','desk'),('chair-seat','chair'),('wardrobe','wardrobe'),
('shelf-body','shelf'),('red-book','redBook'),('blue-book','blueBook'),('green-book','book'),('notebook','notebook'),('pen','pen'),
('monitor','computer'),('keyboard','keyboard'),('mouse','mouse'),('lamp-base','lamp'),('bag','bag'),('ball','ballUnderBed'),
('clock','clock'),('window','window'),('door','door'),('plant-pot','plant'),('cup','cup'),('bottle','bottle'),('key','key')
) as x(object_id,vocab_slug)
join public.vocabulary v on v.slug=x.vocab_slug
on conflict(world_id,object_id) do update set vocabulary_id=excluded.vocabulary_id,targetable=true;

-- ---------- Auth profile bootstrap ----------
create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name,avatar_url)
  values(new.id,coalesce(new.raw_user_meta_data->>'display_name',new.raw_user_meta_data->>'full_name',split_part(coalesce(new.email,'Player'),'@',1),'Player'),new.raw_user_meta_data->>'avatar_url')
  on conflict(id) do nothing;
  return new;
end;$$;

drop trigger if exists on_auth_user_created_ahb on auth.users;
create trigger on_auth_user_created_ahb after insert on auth.users for each row execute function public.handle_new_user_profile();

insert into public.profiles(id,display_name)
select id,coalesce(raw_user_meta_data->>'display_name',raw_user_meta_data->>'full_name',split_part(coalesce(email,'Player'),'@',1),'Player') from auth.users
on conflict(id) do nothing;

-- ---------- Authorization helpers ----------
create or replace function public.is_match_member(p_match_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.match_players mp where mp.match_id=p_match_id and mp.player_id=p_user_id);
$$;

create or replace function public.is_match_host(p_match_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.matches m where m.id=p_match_id and m.host_id=p_user_id);
$$;

create or replace function public.can_access_realtime_topic(p_topic text,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.match_players mp
    where mp.player_id=p_user_id and ('match:'||mp.match_id::text)=p_topic
  );
$$;

-- ---------- Match RPCs ----------
drop function if exists public.create_hunt_match(text,integer,integer,integer,text,text);
create or replace function public.create_hunt_match(
  p_game_mode text default '3d', p_max_players integer default 4, p_target_count integer default 12,
  p_duration_seconds integer default 180, p_difficulty text default 'medium', p_world_slug text default 'student-room',
  p_as_spectator boolean default false
) returns table(match_id uuid, room_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid:=auth.uid(); v_world uuid; v_match uuid; v_code text; v_seed bigint; v_actual int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_game_mode not in ('3d','ar') then raise exception 'INVALID_MODE'; end if;
  if p_max_players<2 or p_max_players>8 then raise exception 'PLAYERS_2_TO_8'; end if;
  if p_target_count<1 or p_target_count>20 then raise exception 'TARGETS_1_TO_20'; end if;
  if p_duration_seconds<30 or p_duration_seconds>1800 then raise exception 'INVALID_DURATION'; end if;
  if p_difficulty not in ('easy','medium','hard') then raise exception 'INVALID_DIFFICULTY'; end if;
  select id into v_world from public.worlds where slug=p_world_slug and active=true;
  if v_world is null then raise exception 'WORLD_NOT_FOUND'; end if;
  insert into public.profiles(id,display_name) values(v_user,'Player') on conflict(id) do nothing;
  loop
    v_code:=upper(substr(encode(gen_random_bytes(5),'hex'),1,6));
    exit when not exists(select 1 from public.matches where matches.room_code=v_code);
  end loop;
  v_seed:=floor(random()*2000000000)::bigint;
  insert into public.matches(room_code,host_id,world_id,game_mode,max_players,target_count,duration_seconds,difficulty,seed,status)
  values(v_code,v_user,v_world,p_game_mode,p_max_players,p_target_count,p_duration_seconds,p_difficulty,v_seed,'waiting') returning id into v_match;
  insert into public.match_players(match_id,player_id,role,ready) values(v_match,v_user,case when p_as_spectator then 'spectator' else 'host' end,p_as_spectator);
  insert into public.match_targets(match_id,object_id,vocabulary_id,points,sort_order)
  select v_match,wo.object_id,wo.vocabulary_id,v.points,(row_number() over(order by md5(wo.object_id||v_seed::text)))::int
  from public.world_objects wo join public.vocabulary v on v.id=wo.vocabulary_id
  where wo.world_id=v_world and wo.targetable=true
    and (p_difficulty='hard' or (p_difficulty='medium' and v.difficulty in ('easy','medium')) or (p_difficulty='easy' and v.difficulty='easy'))
  order by md5(wo.object_id||v_seed::text) limit p_target_count;
  select count(*) into v_actual from public.match_targets where match_targets.match_id=v_match;
  update public.matches set target_count=v_actual where id=v_match;
  perform realtime.send(jsonb_build_object('match_id',v_match,'player_id',v_user),'PLAYER_JOINED','match:'||v_match::text,true);
  return query select v_match,v_code;
end;$$;

create or replace function public.join_hunt_match(p_room_code text)
returns table(match_id uuid, room_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_match public.matches%rowtype; v_count int;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_match from public.matches where matches.room_code=upper(trim(p_room_code)) for update;
  if v_match.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_match.status<>'waiting' then raise exception 'MATCH_ALREADY_STARTED'; end if;
  select count(*) into v_count from public.match_players where match_id=v_match.id and role<>'spectator';
  if v_count>=v_match.max_players and not exists(select 1 from public.match_players where match_id=v_match.id and player_id=v_user) then raise exception 'ROOM_FULL'; end if;
  insert into public.profiles(id,display_name) values(v_user,'Player') on conflict(id) do nothing;
  insert into public.match_players(match_id,player_id,role,ready) values(v_match.id,v_user,'player',false) on conflict(match_id,player_id) do nothing;
  perform realtime.send(jsonb_build_object('match_id',v_match.id,'player_id',v_user),'PLAYER_JOINED','match:'||v_match.id::text,true);
  return query select v_match.id,v_match.room_code;
end;$$;

create or replace function public.set_match_ready(p_match_id uuid,p_ready boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid();
begin
  update public.match_players set ready=p_ready where match_id=p_match_id and player_id=v_user;
  if not found then raise exception 'NOT_MEMBER'; end if;
  perform realtime.send(jsonb_build_object('match_id',p_match_id,'player_id',v_user,'ready',p_ready),'PLAYER_READY','match:'||p_match_id::text,true);
end;$$;

create or replace function public.start_hunt_match(p_match_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_match public.matches%rowtype; v_count int; v_unready int; v_start timestamptz; v_end timestamptz;
begin
  select * into v_match from public.matches where id=p_match_id for update;
  if v_match.id is null or v_match.host_id<>auth.uid() then raise exception 'HOST_ONLY'; end if;
  if v_match.status<>'waiting' then raise exception 'INVALID_STATUS'; end if;
  select count(*) filter(where role<>'spectator'),count(*) filter(where role<>'spectator' and not ready) into v_count,v_unready from public.match_players where match_id=p_match_id;
  if v_count<2 then raise exception 'NEED_AT_LEAST_2_PLAYERS'; end if;
  if v_unready>0 then raise exception 'ALL_PLAYERS_MUST_BE_READY'; end if;
  v_start:=clock_timestamp()+interval '3 seconds'; v_end:=v_start+make_interval(secs=>v_match.duration_seconds);
  update public.matches set status='countdown',started_at=v_start,ends_at=v_end,paused_remaining_seconds=null where id=p_match_id;
  perform realtime.send(jsonb_build_object('match_id',p_match_id,'starts_at',v_start,'ends_at',v_end,'seed',v_match.seed),'MATCH_START','match:'||p_match_id::text,true);
end;$$;

create or replace function public.pause_hunt_match(p_match_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_remaining int;
begin
  if not public.is_match_host(p_match_id) then raise exception 'HOST_ONLY'; end if;
  select greatest(0,ceil(extract(epoch from (ends_at-clock_timestamp())))::int) into v_remaining from public.matches where id=p_match_id and status in ('countdown','running') for update;
  if v_remaining is null then raise exception 'INVALID_STATUS'; end if;
  update public.matches set status='paused',paused_remaining_seconds=v_remaining where id=p_match_id;
  perform realtime.send(jsonb_build_object('match_id',p_match_id,'remaining_seconds',v_remaining),'MATCH_PAUSE','match:'||p_match_id::text,true);
end;$$;

create or replace function public.resume_hunt_match(p_match_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_remaining int; v_end timestamptz;
begin
  if not public.is_match_host(p_match_id) then raise exception 'HOST_ONLY'; end if;
  select paused_remaining_seconds into v_remaining from public.matches where id=p_match_id and status='paused' for update;
  if v_remaining is null then raise exception 'INVALID_STATUS'; end if;
  v_end:=clock_timestamp()+make_interval(secs=>v_remaining);
  update public.matches set status='running',ends_at=v_end,paused_remaining_seconds=null where id=p_match_id;
  perform realtime.send(jsonb_build_object('match_id',p_match_id,'ends_at',v_end),'MATCH_RESUME','match:'||p_match_id::text,true);
end;$$;

create or replace function public.claim_hunt_target(p_match_id uuid,p_object_id text)
returns table(ok boolean,reason text,target_id uuid,object_id text,player_id uuid,points_awarded integer,score integer,combo integer,best_combo integer,match_ended boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_user uuid:=auth.uid(); v_match public.matches%rowtype; v_target public.match_targets%rowtype; v_claimed public.match_targets%rowtype;
  v_combo int; v_best int; v_score int; v_award int:=0; v_bonus int:=0; v_ended boolean:=false;
begin
  if v_user is null or not public.is_match_member(p_match_id,v_user) then
    return query select false,'not_member',null::uuid,p_object_id,v_user,0,0,0,0,false; return;
  end if;
  select * into v_match from public.matches where id=p_match_id for update;
  if v_match.status='countdown' and clock_timestamp()>=v_match.started_at then update public.matches set status='running' where id=p_match_id;v_match.status:='running'; end if;
  if v_match.status='ended' or (v_match.ends_at is not null and clock_timestamp()>=v_match.ends_at) then
    update public.matches set status='ended',ended_at=coalesce(ended_at,clock_timestamp()) where id=p_match_id;
    return query select false,'ended',null::uuid,p_object_id,v_user,0,coalesce((select mp.score from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user),0),0,0,true; return;
  end if;
  if v_match.status<>'running' then
    return query select false,'not_running',null::uuid,p_object_id,v_user,0,coalesce((select mp.score from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user),0),0,0,false; return;
  end if;
  select * into v_target from public.match_targets where match_id=p_match_id and match_targets.object_id=p_object_id;
  if v_target.id is null then
    update public.match_players set score=greatest(0,score-15),wrong_taps=wrong_taps+1,combo=0 where match_id=p_match_id and player_id=v_user returning match_players.score,match_players.best_combo into v_score,v_best;
    insert into public.claims(match_id,target_id,player_id,object_id,correct,points_awarded,reason) values(p_match_id,null,v_user,p_object_id,false,-15,'wrong');
    perform realtime.send(jsonb_build_object('match_id',p_match_id,'player_id',v_user,'object_id',p_object_id,'reason','wrong','score',v_score),'CLAIM_REJECTED','match:'||p_match_id::text,true);
    return query select false,'wrong',null::uuid,p_object_id,v_user,-15,v_score,0,coalesce(v_best,0),false; return;
  end if;
  if v_target.claimed_by is not null then
    select mp.score,mp.combo,mp.best_combo into v_score,v_combo,v_best from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user;
    insert into public.claims(match_id,target_id,player_id,object_id,correct,points_awarded,reason) values(p_match_id,v_target.id,v_user,p_object_id,false,0,'already_claimed');
    return query select false,'already_claimed',v_target.id,p_object_id,v_user,0,v_score,v_combo,v_best,false; return;
  end if;
  update public.match_targets set claimed_by=v_user,claimed_at=clock_timestamp()
  where id=v_target.id and claimed_by is null returning * into v_claimed;
  if v_claimed.id is null then
    select mp.score,mp.combo,mp.best_combo into v_score,v_combo,v_best from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user;
    return query select false,'already_claimed',v_target.id,p_object_id,v_user,0,v_score,v_combo,v_best,false; return;
  end if;
  select mp.combo into v_combo from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user for update;
  v_combo:=coalesce(v_combo,0)+1; v_bonus:=least(40,greatest(0,v_combo-1)*10); v_award:=v_claimed.points+v_bonus;
  update public.match_players set score=score+v_award,claims=claims+1,combo=v_combo,best_combo=greatest(best_combo,v_combo)
  where match_id=p_match_id and player_id=v_user returning match_players.score,match_players.best_combo into v_score,v_best;
  insert into public.claims(match_id,target_id,player_id,object_id,correct,points_awarded,reason) values(p_match_id,v_claimed.id,v_user,p_object_id,true,v_award,'accepted');
  select not exists(select 1 from public.match_targets mt where mt.match_id=p_match_id and mt.claimed_by is null) into v_ended;
  if v_ended then update public.matches set status='ended',ended_at=clock_timestamp() where id=p_match_id; end if;
  perform realtime.send(jsonb_build_object('match_id',p_match_id,'target_id',v_claimed.id,'object_id',p_object_id,'player_id',v_user,'points',v_award,'score',v_score,'combo',v_combo,'match_ended',v_ended),'TARGET_CLAIMED','match:'||p_match_id::text,true);
  if v_ended then perform realtime.send(jsonb_build_object('match_id',p_match_id,'reason','all_claimed'),'MATCH_END','match:'||p_match_id::text,true); end if;
  return query select true,'accepted',v_claimed.id,p_object_id,v_user,v_award,v_score,v_combo,v_best,v_ended;
end;$$;

create or replace function public.finish_hunt_match_if_due(p_match_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_changed boolean:=false;
begin
  if not public.is_match_member(p_match_id) then return false; end if;
  update public.matches set status='ended',ended_at=clock_timestamp()
  where id=p_match_id and status in ('countdown','running') and ends_at<=clock_timestamp();
  v_changed:=found;
  if v_changed then perform realtime.send(jsonb_build_object('match_id',p_match_id,'reason','timer'),'MATCH_END','match:'||p_match_id::text,true); end if;
  return v_changed;
end;$$;

-- ---------- RLS ----------
alter table public.worlds enable row level security;
alter table public.vocabulary enable row level security;
alter table public.world_objects enable row level security;

-- Drop v0.3 permissive policies
drop policy if exists "profiles readable" on public.profiles;
drop policy if exists "profile self update" on public.profiles;
drop policy if exists "matches readable by authenticated" on public.matches;
drop policy if exists "host creates matches" on public.matches;
drop policy if exists "match players self join" on public.match_players;
drop policy if exists "match players readable" on public.match_players;
drop policy if exists "targets readable" on public.match_targets;
drop policy if exists "claims own insert" on public.claims;
drop policy if exists "claims readable" on public.claims;
drop policy if exists "progress own" on public.user_world_progress;

create policy "profiles authenticated read" on public.profiles for select to authenticated using(true);
create policy "profile self insert" on public.profiles for insert to authenticated with check(auth.uid()=id);
create policy "profile self update" on public.profiles for update to authenticated using(auth.uid()=id) with check(auth.uid()=id);
create policy "worlds authenticated read" on public.worlds for select to authenticated using(true);
create policy "vocabulary authenticated read" on public.vocabulary for select to authenticated using(true);
create policy "world objects authenticated read" on public.world_objects for select to authenticated using(true);
create policy "matches members read" on public.matches for select to authenticated using(public.is_match_member(id));
create policy "match players members read" on public.match_players for select to authenticated using(public.is_match_member(match_id));
create policy "targets members read" on public.match_targets for select to authenticated using(public.is_match_member(match_id));
create policy "claims members read" on public.claims for select to authenticated using(public.is_match_member(match_id));
create policy "progress own" on public.user_world_progress for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);

-- Realtime Authorization: use private channels named match:<uuid>.
-- In Supabase Dashboard > Realtime Settings, disable "Allow public access".
drop policy if exists "ahb realtime receive" on realtime.messages;
drop policy if exists "ahb realtime send" on realtime.messages;
create policy "ahb realtime receive" on realtime.messages for select to authenticated
using (extension in ('broadcast','presence') and public.can_access_realtime_topic((select realtime.topic())));
create policy "ahb realtime send" on realtime.messages for insert to authenticated
with check (extension in ('broadcast','presence') and public.can_access_realtime_topic((select realtime.topic())));

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
