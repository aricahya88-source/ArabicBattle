-- Arabic Hunt Battle v0.4.1 — Admin-provisioned username/password accounts
-- Run AFTER 202609210001_initial.sql and 202609210002_realtime_multiplayer.sql

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists role text not null default 'player';
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('admin','player'));

-- Existing accounts receive a safe technical username. Admin can rename/bootstrap explicitly.
update public.profiles
set username='user_'||substr(replace(id::text,'-',''),1,10)
where username is null or btrim(username)='';

update public.profiles set username=lower(username);
create unique index if not exists profiles_username_lower_uidx on public.profiles(lower(username));

-- New users are ALWAYS created as player at trigger level.
-- Elevating to admin is done only by trusted setup SQL or the server-side admin Edge Function.
create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  v_username text;
  v_display text;
begin
  v_username:=lower(coalesce(nullif(new.raw_user_meta_data->>'username',''),nullif(split_part(coalesce(new.email,''),'@',1),''),'user_'||substr(replace(new.id::text,'-',''),1,10)));
  v_username:=regexp_replace(v_username,'[^a-z0-9._-]','','g');
  if length(v_username)<3 then v_username:='user_'||substr(replace(new.id::text,'-',''),1,10); end if;
  if exists(select 1 from public.profiles p where lower(p.username)=lower(v_username) and p.id<>new.id) then
    v_username:=left(v_username,20)||'_'||substr(replace(new.id::text,'-',''),1,6);
  end if;
  v_display:=coalesce(nullif(new.raw_user_meta_data->>'display_name',''),nullif(new.raw_user_meta_data->>'full_name',''),v_username,'Player');

  insert into public.profiles(id,username,display_name,avatar_url,role,active)
  values(new.id,v_username,v_display,new.raw_user_meta_data->>'avatar_url','player',true)
  on conflict(id) do update set
    username=coalesce(public.profiles.username,excluded.username),
    display_name=coalesce(nullif(public.profiles.display_name,''),excluded.display_name);
  return new;
end;$$;

-- Helpers used by realtime and privileged actions.
create or replace function public.is_active_user(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=p_user_id and p.active=true);
$$;

create or replace function public.is_admin(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles p where p.id=p_user_id and p.active=true and p.role='admin');
$$;

create or replace function public.is_match_member(p_match_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_active_user(p_user_id) and exists(
    select 1 from public.match_players mp where mp.match_id=p_match_id and mp.player_id=p_user_id
  );
$$;

create or replace function public.is_match_host(p_match_id uuid,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_active_user(p_user_id) and exists(
    select 1 from public.matches m where m.id=p_match_id and m.host_id=p_user_id
  );
$$;

create or replace function public.can_access_realtime_topic(p_topic text,p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select public.is_active_user(p_user_id) and exists(
    select 1 from public.match_players mp
    where mp.player_id=p_user_id and ('match:'||mp.match_id::text)=p_topic
  );
$$;

-- Account directory: authenticated users can read display identity; only self can edit directly.
-- User creation, role changes, password resets and activation use the server-side Edge Function.
drop policy if exists "profiles authenticated read" on public.profiles;
create policy "profiles authenticated read" on public.profiles for select to authenticated using(public.is_active_user(auth.uid()));

grant execute on function public.is_active_user(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;

-- One-time bootstrap example (run manually AFTER creating the first Auth user):
-- update public.profiles
-- set username='admin', display_name='Administrator', role='admin', active=true
-- where id=(select id from auth.users where email='admin@login.arabichuntbattle.app');
