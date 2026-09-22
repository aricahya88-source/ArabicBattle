# Changelog

## 0.4.0
- Added Supabase Auth service and Guest/Google entry hooks.
- Added server-side create/join/ready/start/pause/resume/finish RPCs.
- Added atomic `claim_hunt_target` scoring RPC.
- Added private Realtime Broadcast + Presence channel per match.
- Added Realtime Authorization policy based on match membership.
- Added Student Room server object registry and vocabulary seed.
- Added admin spectator role that does not consume a player slot.
- Added synchronized timestamps and countdown.
- Added reconnect snapshot restore.
- Added live scoreboard backed by PostgreSQL.
- Added throttled player camera pose telemetry for admin monitor.
- Added local fallback/demo when Supabase is not configured.
- Kept AR Battle separate from realtime 3D Battle.
