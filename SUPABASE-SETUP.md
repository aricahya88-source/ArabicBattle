# Supabase Setup — Arabic Hunt Battle v0.7.0

## Upgrade from v0.6.0
Run exactly once in SQL Editor:
`APPLY-V0.7.0-PATCH.sql`

It adds the authenticated `get_ar_leaderboard()` RPC. Existing v0.6 database structures already support `game_mode = ar`, so no destructive schema migration is required.

## Existing backend reused by AR
AR Battle uses the same server-authoritative backend as 3D Battle:
- room create/join
- 2–8 player membership
- Ready/start/countdown
- atomic first target claim
- wrong-tap penalty and combo
- pause/resume/end
- Presence/Broadcast
- reconnect snapshot recovery
- progress/mastery finalization

## Auth
Keep Email/Password enabled. Google and Anonymous can remain off.

## Edge Function
The existing `admin-users` Edge Function is unchanged.

## Frontend env
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
```
