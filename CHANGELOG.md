# Changelog

## v0.7.0 — WebXR AR Battle
- Enabled competitive AR Battle for Student Room and Kitchen.
- Added HTTPS/WebXR/immersive-ar device preflight.
- Added immersive AR lifecycle, DOM Overlay, hit-test reticle and surface placement.
- Added optional WebXR Anchor placement with hit-test fallback.
- Fixed AR fairness at a common miniature scale; players can rotate but not resize the arena.
- Added AR setup/Ready flow without tearing down the WebXR session.
- Added WebXR select-ray object picking plus touch fallback.
- Added AR virtual-coordinate telemetry for admin 3D spectator / Top View.
- Added AR reconnect/re-entry behavior and automatic Not Ready when placement/session is lost before start.
- Reused server-authoritative claim/scoring, pause/resume, first-claim locking and match finalization across 3D and AR.
- Added separate AR leaderboard RPC/UI.
- Kept 3D Battle, Kitchen, admin spectator, QR join, classes, analytics and content tools.

## v0.6.0 — Classroom Platform
- Kitchen, live admin 3D spectator, pause/resume, projectors, QR, practice, classes, analytics and content tools.

## v0.5.0 — Stability
- RPC ambiguity fixes, realtime partition safety, target guidance and performance pass.
