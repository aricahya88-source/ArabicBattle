# Changelog

## 0.4.1
- Removed Google OAuth UI and flow.
- Removed Guest / Anonymous login UI and flow.
- Added admin-provisioned username/password login.
- Added `username`, `role`, `active`, and `created_by` profile fields.
- Added Admin → User Accounts page.
- Added server-side account creation Edge Function.
- Added server-side password reset.
- Added activate/deactivate account control.
- Added admin route authorization in the client.
- Added first-admin bootstrap guide.
- Kept v0.4 server-authoritative realtime gameplay unchanged.

## 0.4.0
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
- Kept AR Battle separate from realtime 3D Battle.
