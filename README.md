# Arabic Hunt Battle v0.4.1 — Admin-Provisioned Username/Password

**PlayCanvas Engine + Vite + TypeScript + Supabase PostgreSQL + Supabase Realtime + WebXR + PWA**

v0.4.1 keeps the v0.4 realtime multiplayer core, but removes Google and Guest login from the player flow. Every account is now created by an administrator and users sign in with **username + password**.

## What changed

- Login screen now contains only `Username` and `Password`.
- Google OAuth button removed.
- Guest / Anonymous login removed.
- Added account roles: `admin` and `player`.
- Added `active` account status.
- Added Admin → **User Accounts** page.
- Admin can create a username/password account.
- Admin can reset a password.
- Admin can activate/deactivate an account.
- Players cannot open admin routes.
- Account creation and password reset happen in a **Supabase Edge Function**, never with a secret/service key in the browser.
- Realtime match, atomic claim, scoring, PWA and Student Room remain from v0.4.0.

## Important implementation detail

Supabase password authentication signs in with email or phone. The UI still exposes **username only**. Internally the app converts:

```text
ahmad01
↓
ahmad01@login.arabichuntbattle.app
```

This synthetic login address is never shown to the player and no real email inbox is required. Accounts are created server-side with email already confirmed.

## Install

```bash
npm install
cp .env.example .env
```

Fill `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Then follow **`SUPABASE-SETUP.md`** and **`ADMIN-ACCOUNT-SETUP.md`**.

Run:

```bash
npm run dev
```

## Required SQL migrations

Run in this order:

```text
supabase/migrations/202609210001_initial.sql
supabase/migrations/202609210002_realtime_multiplayer.sql
supabase/migrations/202609230001_admin_credentials.sql
```

## Required Edge Function

Deploy:

```text
supabase/functions/admin-users/index.ts
```

The Edge Function uses the server-side Supabase secret/service key and checks that the caller has `profiles.role = 'admin'`.

## First admin

The first administrator is bootstrapped once from Supabase Dashboard because there is not yet an administrator who can create another administrator. See `ADMIN-ACCOUNT-SETUP.md`.

After that, all normal users can be created from:

```text
Admin Dashboard
→ User Accounts
→ Buat Akun
```

## Login flow

```text
ADMIN creates account
        ↓
username + password
        ↓
PLAYER opens app
        ↓
username + password
        ↓
Supabase Auth session
        ↓
Home / 3D Battle / Realtime Room
```

An admin account automatically enters the laptop-first Admin Dashboard after login. A player account enters the mobile Home screen.

## Security model

- Browser receives only `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Supabase secret/service role is **never** stored in `.env` for Vite.
- `supabase.auth.admin.createUser()` is called only inside the Edge Function.
- New public signups should be disabled in Supabase Auth configuration.
- Role elevation is never trusted from player metadata.
- Match scoring remains server-authoritative through PostgreSQL RPCs.
- Private Realtime channels remain protected by match membership.

## Realtime test

See `REALTIME-TEST-CHECKLIST.md`.

Recommended first test:

1. Admin creates accounts `player01` and `player02`.
2. Phone A logs in as `player01`.
3. Phone B logs in as `player02`.
4. Phone A creates a 2-player 3D room.
5. Phone B joins using the room code.
6. Both press Ready.
7. Start the match and race for the same target.
8. Only the first atomic server claim receives points.

## Verification

`tsc --noEmit` has been run against this source tree and passes.

## Next milestone

After account provisioning is verified, continue with **v0.5 — 3D Multiplayer QA + Admin Spectator hardening** before connecting multiplayer to AR.
