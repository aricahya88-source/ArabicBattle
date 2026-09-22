# Arabic Hunt Battle v0.4.0 — Realtime Multiplayer Core

**PlayCanvas Engine + Vite + TypeScript + Supabase PostgreSQL + Supabase Realtime + WebXR + PWA**

v0.4.0 turns the v0.3 local Hunt vertical slice into a real **server-authoritative 3D multiplayer foundation**. The player UI remains mobile-first; the admin UI is laptop-first.

## v0.4.0 highlights

### Realtime match lifecycle
- Supabase Auth session restoration.
- Anonymous/Guest sign-in support (must be enabled in Supabase Auth settings).
- Google OAuth hook.
- Create room and join by room code.
- 2–8 participant architecture.
- Admin-created rooms use an **admin spectator** role and do **not consume a player slot**.
- Presence for online/connected state.
- Ready state.
- Server-scheduled 3-second synchronized start countdown.
- Server `started_at` / `ends_at` timer.
- Pause/resume by host/admin.
- Reconnect recovery from PostgreSQL using the locally stored active match id.

### Server-authoritative Hunt
- Server chooses the target list from `world_objects` using a match seed.
- 8/12/15/20 target options.
- Difficulty affects the target pool.
- Client sends only `match_id + object_id`.
- `claim_hunt_target()` validates membership, match status and target.
- First claim uses an atomic `UPDATE ... WHERE claimed_by IS NULL`.
- A target can only be awarded once.
- Wrong object penalty: `-15`.
- Combo bonus: +10 per consecutive valid claim, capped at +40.
- Scores, wrong taps, combo and claims are persisted in PostgreSQL.
- Match ends when time expires or all targets have been claimed.

### Supabase Realtime
- Private channel per match: `match:<uuid>`.
- Broadcast for game events and player pose telemetry.
- Presence for connected users only.
- Realtime Authorization policies on `realtime.messages` ensure only match members/spectators can access the private topic.
- Broadcast messages are treated as notifications; the database remains the source of truth.

### Admin / spectator
- Admin creates a match without occupying one of the 2–8 player slots.
- Waiting room shows participants and spectator/admin separately.
- Live score comes from `match_players`.
- Player camera pose telemetry is Broadcast at a throttled rate and visualized in the admin top-down monitor.
- Pause and resume controls use server RPCs.

### 3D / AR separation
- **3D Battle** is the realtime competitive path in v0.4.
- **AR Battle remains a separate mode.** WebXR device checking and arena placement remain included from v0.3.
- AR multiplayer is intentionally not merged into the 3D room yet; that remains a later milestone after 3D QA.

## Quick start

```bash
unzip Arabic-Hunt-Battle-v0.4.0.zip
cd arabic-hunt-battle-v0.4.0
npm install
cp .env.example .env
npm run dev
```

Without Supabase configuration, the player can still run a **local 3D demo**. Realtime Create/Join requires Supabase.

## Supabase setup

Read **`SUPABASE-SETUP.md`**. In short:

1. Create a Supabase project.
2. Run migrations in order:
   - `supabase/migrations/202609210001_initial.sql`
   - `supabase/migrations/202609210002_realtime_multiplayer.sql`
3. Enable Anonymous Sign-Ins if you want Guest mode.
4. Configure Google OAuth if desired.
5. In **Realtime Settings**, disable **Allow public access** so private channel authorization is enforced.
6. Copy the Project URL and **publishable key** into `.env`.

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

## Two-phone realtime test

See `REALTIME-TEST-CHECKLIST.md`.

Minimum useful test:

1. Phone A opens the app and signs in as Guest.
2. Create a 3D room for 2 players.
3. Phone B signs in as Guest and joins using the room code.
4. Both press Ready.
5. Host starts the match.
6. Both see the same target list.
7. Both tap the same target nearly simultaneously.
8. Only one receives the points; the other sees it already claimed after snapshot sync.
9. Scores and claimed target state remain correct after page refresh/reconnect.

## Admin

Open:

```text
http://localhost:5173/?admin=1
```

When the admin creates a match, the admin is registered as a **spectator**, not a participant.

## PWA

`manifest.webmanifest` and service worker are included. For installability and AR, deploy over HTTPS (for example Vercel).

## Project structure

```text
src/
├── data/                 Arabic vocabulary
├── game/
│   ├── HuntEngine.ts             local/demo engine
│   └── RealtimeHuntEngine.ts     database-synced match view
├── scene/                PlayCanvas Student Room + mobile camera
├── services/
│   ├── AuthService.ts
│   ├── MatchService.ts
│   ├── RealtimeRoom.ts
│   ├── realtimeTypes.ts
│   └── supabase.ts
├── ui/                   player mobile UI + admin laptop UI
├── worlds/               Student Room world definition
└── xr/                   WebXR AR placement foundation

supabase/
└── migrations/
    ├── 202609210001_initial.sql
    └── 202609210002_realtime_multiplayer.sql
```

## Verification status

- `tsc --noEmit`: **PASS**.
- `npm install`: attempted in the artifact environment but external package installation timed out, so the final Vite bundle could not be executed here.
- The ZIP therefore includes a TypeScript-checked source tree plus setup/test instructions. Run `npm install && npm run build` locally after extraction.

## Next milestone

**v0.5 — 3D Multiplayer QA + Admin Spectator hardening**

- systematic 2 / 4 / 6 / 8 device tests;
- reconnect and latency simulation;
- duplicate claim race tests;
- player pose smoothing and telemetry sampling;
- host disconnect policy;
- admin match history / persisted analytics views;
- load testing concurrent rooms.

Only after that should the same realtime core be connected to **AR Battle**.
