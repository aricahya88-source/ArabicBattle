-- Arabic Hunt Battle v0.3 starter schema
create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player', avatar_url text,
  xp integer not null default 0, level integer not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists worlds (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  name text not null, name_ar text not null, active boolean not null default true,
  ar_scale numeric not null default 0.1, created_at timestamptz default now()
);
create table if not exists vocabulary (
  id uuid primary key default gen_random_uuid(), slug text unique not null,
  arabic text not null, transliteration text, meaning_id text, meaning_en text,
  category text, difficulty text check (difficulty in ('easy','medium','hard')),
  points integer not null default 50, audio_url text
);
create table if not exists matches (
  id uuid primary key default gen_random_uuid(), room_code text unique not null,
  host_id uuid references profiles(id), world_id uuid references worlds(id),
  game_mode text not null check (game_mode in ('3d','ar')),
  max_players int not null default 4 check(max_players between 2 and 8),
  target_count int not null default 12, duration_seconds int not null default 180,
  seed bigint not null, status text not null default 'waiting',
  started_at timestamptz, ended_at timestamptz, created_at timestamptz default now()
);
create table if not exists match_players (
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references profiles(id) on delete cascade,
  ready boolean not null default false, score integer not null default 0,
  wrong_taps integer not null default 0, claims integer not null default 0,
  joined_at timestamptz default now(), primary key(match_id,player_id)
);
create table if not exists match_targets (
  id uuid primary key default gen_random_uuid(), match_id uuid references matches(id) on delete cascade,
  object_id text not null, vocabulary_id uuid references vocabulary(id), points integer not null,
  claimed_by uuid references profiles(id), claimed_at timestamptz,
  unique(match_id,object_id)
);
create table if not exists claims (
  id uuid primary key default gen_random_uuid(), match_id uuid references matches(id) on delete cascade,
  target_id uuid references match_targets(id) on delete cascade, player_id uuid references profiles(id),
  object_id text not null, correct boolean not null, points_awarded integer not null default 0,
  created_at timestamptz default now()
);
create table if not exists user_world_progress (
  user_id uuid references profiles(id) on delete cascade,
  world_id uuid references worlds(id) on delete cascade,
  mastery numeric not null default 0, best_accuracy numeric not null default 0,
  best_time_ms bigint, updated_at timestamptz default now(), primary key(user_id,world_id)
);

alter table profiles enable row level security;
alter table matches enable row level security;
alter table match_players enable row level security;
alter table match_targets enable row level security;
alter table claims enable row level security;
alter table user_world_progress enable row level security;

create policy "profiles readable" on profiles for select using (true);
create policy "profile self update" on profiles for update using (auth.uid()=id);
create policy "matches readable by authenticated" on matches for select to authenticated using (true);
create policy "host creates matches" on matches for insert to authenticated with check (auth.uid()=host_id);
create policy "match players self join" on match_players for insert to authenticated with check (auth.uid()=player_id);
create policy "match players readable" on match_players for select to authenticated using (true);
create policy "targets readable" on match_targets for select to authenticated using (true);
create policy "claims own insert" on claims for insert to authenticated with check (auth.uid()=player_id);
create policy "claims readable" on claims for select to authenticated using (true);
create policy "progress own" on user_world_progress for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- IMPORTANT: Production claim resolution should be moved to an RPC / Edge Function
-- using a transaction/row lock so only the first valid claim awards points.
