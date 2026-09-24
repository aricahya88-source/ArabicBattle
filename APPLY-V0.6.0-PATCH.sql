-- Arabic Hunt Battle v0.6.0 — Classroom Platform
-- Run AFTER v0.5.0 stability patch.

alter table public.matches add column if not exists target_categories text[];
alter table public.matches add column if not exists class_id uuid;
alter table public.matches add column if not exists progress_finalized boolean not null default false;

create table if not exists public.learning_classes(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(created_by,name)
);
create table if not exists public.class_members(
  class_id uuid not null references public.learning_classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key(class_id,user_id)
);
do $$ begin
  if not exists(select 1 from pg_constraint where conname='matches_class_id_fkey') then
    alter table public.matches add constraint matches_class_id_fkey foreign key(class_id) references public.learning_classes(id) on delete set null;
  end if;
end $$;

alter table public.learning_classes enable row level security;
alter table public.class_members enable row level security;
drop policy if exists "classes admin read" on public.learning_classes;
create policy "classes admin read" on public.learning_classes for select to authenticated using(public.is_admin(auth.uid()) or exists(select 1 from public.class_members cm where cm.class_id=id and cm.user_id=auth.uid()));
drop policy if exists "class members admin read" on public.class_members;
create policy "class members admin read" on public.class_members for select to authenticated using(public.is_admin(auth.uid()) or user_id=auth.uid());
drop policy if exists "progress admin read" on public.user_world_progress;
create policy "progress admin read" on public.user_world_progress for select to authenticated using(public.is_admin(auth.uid()) or auth.uid()=user_id);

-- Worlds: two playable + visible coming-soon catalog.
insert into public.worlds(slug,name,name_ar,active,ar_scale) values
('kitchen','Kitchen','الْمَطْبَخُ',true,0.1),
('classroom','Classroom','الْفَصْلُ الدِّرَاسِيُّ',false,0.1),
('market','Market','السُّوقُ',false,0.1),
('library','Library','الْمَكْتَبَةُ',false,0.1),
('hospital','Hospital','الْمُسْتَشْفَى',false,0.1),
('airport','Airport','الْمَطَارُ',false,0.1),
('park','Park','الْحَدِيقَةُ',false,0.1)
on conflict(slug) do update set name=excluded.name,name_ar=excluded.name_ar,ar_scale=excluded.ar_scale;

insert into public.vocabulary(slug,arabic,transliteration,meaning_id,meaning_en,category,difficulty,points) values
('fridge','ثَلَّاجَةٌ','thallājatun','Kulkas','Refrigerator','appliance','easy',50),
('stove','مَوْقِدٌ','mawqidun','Kompor','Stove','appliance','medium',80),
('oven','فُرْنٌ','furnun','Oven','Oven','appliance','easy',50),
('sink','مِغْسَلَةٌ','mighsalatun','Bak cuci','Sink','appliance','medium',80),
('kitchenTable','طَاوِلَةٌ','ṭāwilatun','Meja makan','Table','furniture','easy',50),
('kitchenChair','كُرْسِيٌّ','kursiyyun','Kursi makan','Chair','furniture','easy',50),
('plate','طَبَقٌ','ṭabaqun','Piring','Plate','utensil','easy',50),
('kitchenCup','كُوبٌ','kūbun','Gelas','Cup','utensil','easy',50),
('spoon','مِلْعَقَةٌ','milʿaqatun','Sendok','Spoon','utensil','easy',50),
('fork','شَوْكَةٌ','shawkatun','Garpu','Fork','utensil','medium',80),
('knife','سِكِّينٌ','sikkīnun','Pisau','Knife','utensil','medium',80),
('pot','قِدْرٌ','qidrun','Panci','Pot','cookware','medium',80),
('pan','مِقْلَاةٌ','miqlātun','Wajan','Frying pan','cookware','hard',120),
('kitchenBottle','زُجَاجَةٌ','zujājatun','Botol','Bottle','utensil','easy',50),
('apple','تُفَّاحَةٌ','tuffāḥatun','Apel','Apple','food','easy',50),
('appleOnTable','تُفَّاحَةٌ عَلَى الطَّاوِلَةِ','tuffāḥatun ʿalā aṭ-ṭāwilati','Apel di atas meja','Apple on the table','spatial','hard',120),
('banana','مَوْزٌ','mawzun','Pisang','Banana','food','easy',50),
('bread','خُبْزٌ','khubzun','Roti','Bread','food','easy',50),
('egg','بَيْضَةٌ','bayḍatun','Telur','Egg','food','easy',50),
('milk','حَلِيبٌ','ḥalībun','Susu','Milk','food','easy',50),
('rice','أَرُزٌّ','aruzzun','Beras','Rice','food','medium',80),
('sugar','سُكَّرٌ','sukkarun','Gula','Sugar','food','medium',80),
('kettle','إِبْرِيقٌ','ibrīqun','Teko','Kettle','cookware','medium',80),
('cuttingBoard','لَوْحُ التَّقْطِيعِ','lawḥu at-taqṭīʿ','Talenan','Cutting board','utensil','hard',120),
('bowl','وِعَاءٌ','wiʿāʾun','Mangkuk','Bowl','utensil','medium',80),
('trashBin','سَلَّةُ الْمُهْمَلَاتِ','sallatu al-muhmalāt','Tempat sampah','Trash bin','object','hard',120),
('spoonInPot','مِلْعَقَةٌ دَاخِلَ الْقِدْرِ','milʿaqatun dākhila al-qidri','Sendok di dalam panci','Spoon inside the pot','spatial','hard',120),
('plateBesideCup','طَبَقٌ بِجَانِبِ الْكُوبِ','ṭabaqun bijānibi al-kūbi','Piring di samping gelas','Plate beside the cup','spatial','hard',120)
on conflict(slug) do update set arabic=excluded.arabic,transliteration=excluded.transliteration,meaning_id=excluded.meaning_id,meaning_en=excluded.meaning_en,category=excluded.category,difficulty=excluded.difficulty,points=excluded.points;

with w as (select id from public.worlds where slug='kitchen')
insert into public.world_objects(world_id,object_id,vocabulary_id,targetable)
select w.id,x.object_id,v.id,true from w cross join (values
('fridge','fridge'),('stove','stove'),('oven','oven'),('sink','sink'),('table','kitchenTable'),('chair-kitchen','kitchenChair'),
('plate','plate'),('cup-kitchen','kitchenCup'),('spoon','spoon'),('fork','fork'),('knife','knife'),('pot','pot'),('pan','pan'),
('bottle-kitchen','kitchenBottle'),('apple','apple'),('apple-on-table','appleOnTable'),('banana','banana'),('bread','bread'),('egg','egg'),
('milk','milk'),('rice','rice'),('sugar','sugar'),('kettle','kettle'),('cutting-board','cuttingBoard'),('bowl','bowl'),('trash-bin','trashBin'),
('spoon-in-pot','spoonInPot'),('plate-beside-cup','plateBesideCup')
) as x(object_id,slug)
join public.vocabulary v on v.slug=x.slug
on conflict(world_id,object_id) do update set vocabulary_id=excluded.vocabulary_id,targetable=true;

create or replace function public.create_hunt_match_v060(
  p_game_mode text,
  p_max_players integer,
  p_target_count integer,
  p_duration_seconds integer,
  p_difficulty text,
  p_world_slug text,
  p_as_spectator boolean,
  p_categories text[],
  p_class_id uuid
)
returns table(match_id uuid,room_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid();v_world uuid;v_match uuid;v_code text;v_seed bigint;v_actual integer;
begin
  if v_user is null or not public.is_active_user(v_user) then raise exception 'AUTH_REQUIRED'; end if;
  if p_game_mode not in ('3d','ar') then raise exception 'INVALID_MODE'; end if;
  if p_max_players<2 or p_max_players>8 then raise exception 'PLAYERS_2_TO_8'; end if;
  if p_target_count<1 or p_target_count>20 then raise exception 'TARGETS_1_TO_20'; end if;
  if p_duration_seconds<30 or p_duration_seconds>1800 then raise exception 'INVALID_DURATION'; end if;
  if p_difficulty not in ('easy','medium','hard') then raise exception 'INVALID_DIFFICULTY'; end if;
  if p_class_id is not null and not public.is_admin(v_user) then raise exception 'ADMIN_CLASS_ONLY'; end if;
  select w.id into v_world from public.worlds w where w.slug=p_world_slug and w.active=true;
  if v_world is null then raise exception 'WORLD_NOT_FOUND'; end if;
  loop v_code:=upper(substr(md5(random()::text||clock_timestamp()::text||v_user::text),1,6));exit when not exists(select 1 from public.matches m where m.room_code=v_code);end loop;
  v_seed:=floor(random()*2000000000)::bigint;
  insert into public.matches(room_code,host_id,world_id,game_mode,max_players,target_count,duration_seconds,difficulty,target_categories,class_id,seed,status)
  values(v_code,v_user,v_world,p_game_mode,p_max_players,p_target_count,p_duration_seconds,p_difficulty,p_categories,p_class_id,v_seed,'waiting') returning id into v_match;
  insert into public.match_players(match_id,player_id,role,ready) values(v_match,v_user,case when p_as_spectator then 'spectator' else 'host' end,p_as_spectator);
  insert into public.match_targets(match_id,object_id,vocabulary_id,points,sort_order)
  select v_match,wo.object_id,wo.vocabulary_id,v.points,(row_number() over(order by md5(wo.object_id||v_seed::text)))::integer
  from public.world_objects wo join public.vocabulary v on v.id=wo.vocabulary_id
  where wo.world_id=v_world and wo.targetable=true
    and (p_categories is null or cardinality(p_categories)=0 or v.category=any(p_categories))
    and (p_difficulty='hard' or (p_difficulty='medium' and v.difficulty in ('easy','medium')) or (p_difficulty='easy' and v.difficulty='easy'))
  order by md5(wo.object_id||v_seed::text) limit p_target_count;
  select count(*) into v_actual from public.match_targets mt where mt.match_id=v_match;
  if v_actual=0 then raise exception 'NO_TARGETS_FOR_FILTER'; end if;
  update public.matches m set target_count=v_actual where m.id=v_match;
  return query select v_match,v_code;
end;$$;
revoke all on function public.create_hunt_match_v060(text,integer,integer,integer,text,text,boolean,text[],uuid) from public;
grant execute on function public.create_hunt_match_v060(text,integer,integer,integer,text,text,boolean,text[],uuid) to authenticated;

create or replace function public.join_hunt_match(p_room_code text)
returns table(match_id uuid,room_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid();v_match public.matches%rowtype;v_count integer;
begin
  if v_user is null or not public.is_active_user(v_user) then raise exception 'AUTH_REQUIRED'; end if;
  select m.* into v_match from public.matches m where m.room_code=upper(trim(p_room_code)) for update;
  if v_match.id is null then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_match.status<>'waiting' then raise exception 'MATCH_ALREADY_STARTED'; end if;
  if v_match.class_id is not null and not public.is_admin(v_user) and not exists(select 1 from public.class_members cm where cm.class_id=v_match.class_id and cm.user_id=v_user) then raise exception 'NOT_IN_MATCH_CLASS'; end if;
  select count(*) into v_count from public.match_players mp where mp.match_id=v_match.id and mp.role<>'spectator';
  if v_count>=v_match.max_players and not exists(select 1 from public.match_players mp2 where mp2.match_id=v_match.id and mp2.player_id=v_user) then raise exception 'ROOM_FULL'; end if;
  insert into public.match_players(match_id,player_id,role,ready) values(v_match.id,v_user,'player',false) on conflict on constraint match_players_pkey do nothing;
  return query select v_match.id,v_match.room_code;
end;$$;

create or replace function public.ahb_finalize_match_progress(p_match_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;v_world uuid;v_targets integer;v_acc numeric;v_mastery numeric;v_xp integer;
begin
  update public.matches m set progress_finalized=true where m.id=p_match_id and m.progress_finalized=false returning m.world_id,m.target_count into v_world,v_targets;
  if v_world is null then return;end if;
  for r in select mp.player_id,mp.score,mp.claims,mp.wrong_taps from public.match_players mp where mp.match_id=p_match_id and mp.role<>'spectator' loop
    v_acc:=case when r.claims+r.wrong_taps=0 then 0 else round((r.claims::numeric/(r.claims+r.wrong_taps))*100,2) end;
    v_mastery:=case when v_targets=0 then 0 else least(100,round((r.claims::numeric/v_targets)*100,2)) end;
    insert into public.user_world_progress(user_id,world_id,mastery,best_accuracy,updated_at) values(r.player_id,v_world,v_mastery,v_acc,now())
    on conflict(user_id,world_id) do update set mastery=greatest(public.user_world_progress.mastery,excluded.mastery),best_accuracy=greatest(public.user_world_progress.best_accuracy,excluded.best_accuracy),updated_at=now();
    v_xp:=greatest(10,floor(r.score/10.0)::integer);
    update public.profiles p set xp=p.xp+v_xp,level=greatest(p.level,1+floor((p.xp+v_xp)/500.0)::integer) where p.id=r.player_id;
  end loop;
end;$$;
revoke all on function public.ahb_finalize_match_progress(uuid) from public;

create or replace function public.end_hunt_match(p_match_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not public.is_match_host(p_match_id) then raise exception 'HOST_ONLY'; end if;
  update public.matches m set status='ended',ended_at=coalesce(m.ended_at,clock_timestamp()) where m.id=p_match_id and m.status<>'ended';
  perform public.ahb_finalize_match_progress(p_match_id);
  perform public.ahb_safe_broadcast('match:'||p_match_id::text,'MATCH_END',jsonb_build_object('match_id',p_match_id,'reason','host'));
end;$$;
revoke all on function public.end_hunt_match(uuid) from public;grant execute on function public.end_hunt_match(uuid) to authenticated;

create or replace function public.finish_hunt_match_if_due(p_match_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_changed boolean:=false;
begin
  if not public.is_match_member(p_match_id) then return false;end if;
  update public.matches m set status='ended',ended_at=clock_timestamp() where m.id=p_match_id and m.status in ('countdown','running') and m.ends_at<=clock_timestamp();
  v_changed:=found;
  if v_changed then perform public.ahb_finalize_match_progress(p_match_id);perform public.ahb_safe_broadcast('match:'||p_match_id::text,'MATCH_END',jsonb_build_object('match_id',p_match_id,'reason','timer'));end if;
  return v_changed;
end;$$;

-- Recreate claim RPC so an all-targets finish also finalizes learning progress.
create or replace function public.claim_hunt_target(p_match_id uuid,p_object_id text)
returns table(ok boolean,reason text,target_id uuid,object_id text,player_id uuid,points_awarded integer,score integer,combo integer,best_combo integer,match_ended boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid();v_match public.matches%rowtype;v_target public.match_targets%rowtype;v_claimed public.match_targets%rowtype;v_combo integer:=0;v_best integer:=0;v_score integer:=0;v_award integer:=0;v_bonus integer:=0;v_ended boolean:=false;
begin
  if v_user is null or not public.is_match_member(p_match_id,v_user) then return query select false,'not_member',null::uuid,p_object_id,v_user,0,0,0,0,false;return;end if;
  select m.* into v_match from public.matches m where m.id=p_match_id for update;
  if v_match.id is null then return query select false,'not_member',null::uuid,p_object_id,v_user,0,0,0,0,false;return;end if;
  if v_match.status='countdown' and clock_timestamp()>=v_match.started_at then update public.matches m set status='running' where m.id=p_match_id;v_match.status:='running';end if;
  if v_match.status='ended' or (v_match.ends_at is not null and clock_timestamp()>=v_match.ends_at) then update public.matches m set status='ended',ended_at=coalesce(m.ended_at,clock_timestamp()) where m.id=p_match_id;perform public.ahb_finalize_match_progress(p_match_id);select mp.score into v_score from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user;return query select false,'ended',null::uuid,p_object_id,v_user,0,coalesce(v_score,0),0,0,true;return;end if;
  if v_match.status<>'running' then select mp.score,mp.combo,mp.best_combo into v_score,v_combo,v_best from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user;return query select false,'not_running',null::uuid,p_object_id,v_user,0,coalesce(v_score,0),coalesce(v_combo,0),coalesce(v_best,0),false;return;end if;
  select mt.* into v_target from public.match_targets mt where mt.match_id=p_match_id and mt.object_id=p_object_id;
  if v_target.id is null then update public.match_players mp set score=greatest(0,mp.score-15),wrong_taps=mp.wrong_taps+1,combo=0 where mp.match_id=p_match_id and mp.player_id=v_user returning mp.score,mp.best_combo into v_score,v_best;insert into public.claims(match_id,target_id,player_id,object_id,correct,points_awarded,reason) values(p_match_id,null,v_user,p_object_id,false,-15,'wrong');perform public.ahb_safe_broadcast('match:'||p_match_id::text,'CLAIM_REJECTED',jsonb_build_object('match_id',p_match_id,'player_id',v_user,'object_id',p_object_id,'reason','wrong','score',v_score));return query select false,'wrong',null::uuid,p_object_id,v_user,-15,coalesce(v_score,0),0,coalesce(v_best,0),false;return;end if;
  if v_target.claimed_by is not null then select mp.score,mp.combo,mp.best_combo into v_score,v_combo,v_best from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user;insert into public.claims(match_id,target_id,player_id,object_id,correct,points_awarded,reason) values(p_match_id,v_target.id,v_user,p_object_id,false,0,'already_claimed');return query select false,'already_claimed',v_target.id,p_object_id,v_user,0,coalesce(v_score,0),coalesce(v_combo,0),coalesce(v_best,0),false;return;end if;
  update public.match_targets mt set claimed_by=v_user,claimed_at=clock_timestamp() where mt.id=v_target.id and mt.claimed_by is null returning mt.* into v_claimed;
  if v_claimed.id is null then select mp.score,mp.combo,mp.best_combo into v_score,v_combo,v_best from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user;return query select false,'already_claimed',v_target.id,p_object_id,v_user,0,coalesce(v_score,0),coalesce(v_combo,0),coalesce(v_best,0),false;return;end if;
  select mp.combo into v_combo from public.match_players mp where mp.match_id=p_match_id and mp.player_id=v_user for update;v_combo:=coalesce(v_combo,0)+1;v_bonus:=least(40,greatest(0,v_combo-1)*10);v_award:=v_claimed.points+v_bonus;
  update public.match_players mp set score=mp.score+v_award,claims=mp.claims+1,combo=v_combo,best_combo=greatest(mp.best_combo,v_combo) where mp.match_id=p_match_id and mp.player_id=v_user returning mp.score,mp.best_combo into v_score,v_best;
  insert into public.claims(match_id,target_id,player_id,object_id,correct,points_awarded,reason) values(p_match_id,v_claimed.id,v_user,p_object_id,true,v_award,'accepted');
  select not exists(select 1 from public.match_targets mt where mt.match_id=p_match_id and mt.claimed_by is null) into v_ended;
  if v_ended then update public.matches m set status='ended',ended_at=clock_timestamp() where m.id=p_match_id;perform public.ahb_finalize_match_progress(p_match_id);end if;
  perform public.ahb_safe_broadcast('match:'||p_match_id::text,'TARGET_CLAIMED',jsonb_build_object('match_id',p_match_id,'target_id',v_claimed.id,'object_id',p_object_id,'player_id',v_user,'points',v_award,'score',v_score,'combo',v_combo,'match_ended',v_ended));
  if v_ended then perform public.ahb_safe_broadcast('match:'||p_match_id::text,'MATCH_END',jsonb_build_object('match_id',p_match_id,'reason','all_claimed'));end if;
  return query select true,'accepted',v_claimed.id,p_object_id,v_user,v_award,coalesce(v_score,0),v_combo,coalesce(v_best,0),v_ended;
end;$$;



-- Public authenticated 3D leaderboard. Scores remain server authoritative.
create or replace function public.get_3d_leaderboard(p_limit integer default 20)
returns table(player_id uuid,display_name text,xp integer,level integer,total_score bigint,total_claims bigint,matches_played bigint)
language sql stable security definer set search_path=public,pg_temp as $$
  select p.id,p.display_name,p.xp,p.level,
    coalesce(sum(mp.score) filter (where m.id is not null),0)::bigint as total_score,
    coalesce(sum(mp.claims) filter (where m.id is not null),0)::bigint as total_claims,
    count(distinct m.id)::bigint as matches_played
  from public.profiles p
  left join public.match_players mp on mp.player_id=p.id and mp.role<>'spectator'
  left join public.matches m on m.id=mp.match_id and m.game_mode='3d' and m.status='ended'
  where p.active=true and p.role='player'
  group by p.id,p.display_name,p.xp,p.level
  order by total_score desc,total_claims desc,p.xp desc,p.display_name
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;
revoke all on function public.get_3d_leaderboard(integer) from public;
grant execute on function public.get_3d_leaderboard(integer) to authenticated;

create or replace function public.admin_create_class(p_name text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_id uuid;begin if not public.is_admin(auth.uid()) then raise exception 'ADMIN_ONLY';end if;if length(trim(p_name))<2 then raise exception 'INVALID_CLASS_NAME';end if;insert into public.learning_classes(name,created_by) values(trim(p_name),auth.uid()) on conflict(created_by,name) do update set name=excluded.name returning id into v_id;return v_id;end;$$;
create or replace function public.admin_assign_class(p_class_id uuid,p_user_id uuid,p_assigned boolean default true) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin if not public.is_admin(auth.uid()) then raise exception 'ADMIN_ONLY';end if;if p_assigned then insert into public.class_members(class_id,user_id) values(p_class_id,p_user_id) on conflict do nothing;else delete from public.class_members cm where cm.class_id=p_class_id and cm.user_id=p_user_id;end if;end;$$;
create or replace function public.admin_upsert_vocabulary(p_slug text,p_arabic text,p_transliteration text,p_meaning_id text,p_meaning_en text,p_category text,p_difficulty text,p_points integer) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$declare v_id uuid;begin if not public.is_admin(auth.uid()) then raise exception 'ADMIN_ONLY';end if;if p_difficulty not in ('easy','medium','hard') then raise exception 'INVALID_DIFFICULTY';end if;insert into public.vocabulary(slug,arabic,transliteration,meaning_id,meaning_en,category,difficulty,points) values(trim(p_slug),trim(p_arabic),p_transliteration,trim(p_meaning_id),p_meaning_en,trim(p_category),p_difficulty,greatest(1,p_points)) on conflict(slug) do update set arabic=excluded.arabic,transliteration=excluded.transliteration,meaning_id=excluded.meaning_id,meaning_en=excluded.meaning_en,category=excluded.category,difficulty=excluded.difficulty,points=excluded.points returning id into v_id;return v_id;end;$$;
create or replace function public.admin_map_world_object(p_world_slug text,p_object_id text,p_vocab_slug text,p_targetable boolean default true) returns void language plpgsql security definer set search_path=public,pg_temp as $$declare v_world uuid;v_vocab uuid;begin if not public.is_admin(auth.uid()) then raise exception 'ADMIN_ONLY';end if;select id into v_world from public.worlds where slug=p_world_slug;select id into v_vocab from public.vocabulary where slug=p_vocab_slug;if v_world is null or v_vocab is null then raise exception 'WORLD_OR_VOCAB_NOT_FOUND';end if;insert into public.world_objects(world_id,object_id,vocabulary_id,targetable) values(v_world,trim(p_object_id),v_vocab,p_targetable) on conflict(world_id,object_id) do update set vocabulary_id=excluded.vocabulary_id,targetable=excluded.targetable;end;$$;
create or replace function public.admin_set_world_active(p_world_slug text,p_active boolean) returns void language plpgsql security definer set search_path=public,pg_temp as $$begin if not public.is_admin(auth.uid()) then raise exception 'ADMIN_ONLY';end if;if p_world_slug not in ('student-room','kitchen') and p_active then raise exception 'WORLD_NOT_IMPLEMENTED';end if;update public.worlds set active=p_active where slug=p_world_slug;if not found then raise exception 'WORLD_NOT_FOUND';end if;end;$$;

revoke all on function public.admin_create_class(text) from public;grant execute on function public.admin_create_class(text) to authenticated;
revoke all on function public.admin_assign_class(uuid,uuid,boolean) from public;grant execute on function public.admin_assign_class(uuid,uuid,boolean) to authenticated;
revoke all on function public.admin_upsert_vocabulary(text,text,text,text,text,text,text,integer) from public;grant execute on function public.admin_upsert_vocabulary(text,text,text,text,text,text,text,integer) to authenticated;
revoke all on function public.admin_map_world_object(text,text,text,boolean) from public;grant execute on function public.admin_map_world_object(text,text,text,boolean) to authenticated;
revoke all on function public.admin_set_world_active(text,boolean) from public;grant execute on function public.admin_set_world_active(text,boolean) to authenticated;
