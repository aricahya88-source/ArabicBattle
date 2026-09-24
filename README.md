# Arabic Hunt Battle v0.7.0 — WebXR AR Battle

Multiplayer Arabic vocabulary hunt built with **Vite + TypeScript + PlayCanvas Engine + WebXR + Supabase**.

## Playable modes
- **3D Battle** — realtime 2–8 players.
- **AR Battle** — realtime AR-only pool using a miniature virtual world placed on a real table/floor.
- **Solo Practice** — local 3D practice.
- **Tutorial** — 3-target control tutorial.

## Playable worlds
- Student Room
- Kitchen

Visible roadmap cards: Classroom, Market, Library, Hospital, Airport, Park.

## AR Battle flow
1. Player selects **AR Battle**.
2. Device check verifies HTTPS, WebXR API and `immersive-ar` support.
3. Choose Student Room or Kitchen.
4. Create/join an AR room.
5. Press **Start AR** (must be a user gesture).
6. Scan a horizontal surface until the reticle appears.
7. Press **Place Arena**. The world uses a fixed miniature scale (~10%) for fairness.
8. Optionally rotate the arena in 15° steps; scale is intentionally fixed.
9. Press **Ready**. Admin/host starts only after all AR players are ready.
10. During the match, taps/select rays claim the same server-authoritative targets used by 3D Battle.

AR and 3D matches are separate because `matches.game_mode` is either `3d` or `ar`. The admin can spectate both from the desktop 3D/Top View using virtual-coordinate telemetry; no player camera video is sent.

## v0.7.0 highlights
- WebXR immersive AR session lifecycle.
- Surface hit testing and reticle.
- Optional WebXR Anchor placement when supported; safe hit-test placement fallback otherwise.
- DOM Overlay HUD during AR.
- AR input via WebXR select ray plus DOM/touch fallback.
- Fixed miniature scale for fairness and per-device rotation.
- AR placement must be locked before Ready.
- AR session loss/reset before match automatically clears Ready.
- Re-enter/re-place AR after session interruption or page refresh.
- Server-authoritative first claim/scoring, pause/resume, reconnect and match end shared with 3D.
- AR virtual pose telemetry for admin spectator.
- Separate **AR Leaderboard**.
- Student Room + Kitchen supported in both 3D and AR.
- Bootstrap Icons remain available in the admin/player UI.

## Upgrade from v0.6.0
1. Extract this project.
2. Copy your existing `.env` into the project root.
3. In Supabase SQL Editor run **`APPLY-V0.7.0-PATCH.sql` once**.
4. Keep the already deployed `admin-users` Edge Function.
5. Run:
   ```bash
   npm install
   npm run typecheck
   npm run dev
   ```
6. Test 3D locally. For **AR on a phone**, use the Vercel HTTPS deployment (or another secure origin). A LAN URL such as `http://192.168.x.x:5173` is not a secure context for WebXR on normal mobile browsers.

## Fresh database
Run migrations in order:
1. `202609210001_initial.sql`
2. `202609210002_realtime_multiplayer.sql`
3. `202609230001_admin_credentials.sql`
4. `202609230002_v050_stability.sql`
5. `202609230003_v060_classroom_platform.sql`
6. `202609240001_v070_ar_battle.sql`

## Environment
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
```
Never place service-role/secret keys in Vite environment variables.

## Device notes
WebXR AR support is device/browser dependent. The authoritative test is successfully starting an immersive AR session. The app provides a preflight check and a clear fallback message when AR is unavailable.

## Vercel
See `VERCEL-DEPLOY.md`. Add the same two public Supabase variables in Vercel Project Settings → Environment Variables. HTTPS from Vercel is required for normal phone WebXR use.
