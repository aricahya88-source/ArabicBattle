-- Arabic Hunt Battle v0.7.0 — AR Battle upgrade
-- Safe to run once after v0.6.0. No destructive schema changes.

-- Separate AR leaderboard while keeping learning progress shared across modes.
create or replace function public.get_ar_leaderboard(p_limit integer default 20)
returns table(
  player_id uuid,
  display_name text,
  xp integer,
  level integer,
  total_score bigint,
  total_claims bigint,
  matches_played bigint
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select
    p.id,
    p.display_name,
    p.xp,
    p.level,
    coalesce(sum(mp.score) filter (where m.id is not null),0)::bigint as total_score,
    coalesce(sum(mp.claims) filter (where m.id is not null),0)::bigint as total_claims,
    count(distinct m.id)::bigint as matches_played
  from public.profiles p
  left join public.match_players mp
    on mp.player_id=p.id and mp.role<>'spectator'
  left join public.matches m
    on m.id=mp.match_id and m.game_mode='ar' and m.status='ended'
  where p.active=true and p.role='player'
  group by p.id,p.display_name,p.xp,p.level
  order by total_score desc,total_claims desc,p.xp desc,p.display_name
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;

revoke all on function public.get_ar_leaderboard(integer) from public;
grant execute on function public.get_ar_leaderboard(integer) to authenticated;

-- The v0.6 create_hunt_match_v060 RPC already accepts p_game_mode in ('3d','ar').
-- Claim validation, timer, pause/resume, first-claim locking, class restriction,
-- progress finalization, Presence/Broadcast, and spectator roles are shared by both modes.
