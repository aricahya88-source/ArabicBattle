# Supabase Setup — Arabic Hunt Battle v0.4.0

## 1. Create project
Create a normal Supabase project. The database is PostgreSQL.

## 2. Run SQL migrations
Open **SQL Editor** and run these files in order:

1. `supabase/migrations/202609210001_initial.sql`
2. `supabase/migrations/202609210002_realtime_multiplayer.sql`

The second migration adds:
- server-authoritative match RPCs;
- Student Room vocabulary/world object seed data;
- admin spectator role;
- private Realtime Authorization policies;
- atomic claim logic;
- ready/start/pause/resume/end logic.

## 3. Auth
For Guest mode:

**Authentication → Providers / Sign In Methods → Anonymous → Enable**

For Google login, configure the Google provider and redirect URLs for your local/deployed site.

## 4. Realtime private channels
Go to **Realtime Settings** and disable **Allow public access**.

v0.4 subscribes with:

```ts
supabase.channel(`match:${matchId}`, {
  config: { private: true, presence: { key: user.id } }
})
```

The migration creates `realtime.messages` policies allowing Broadcast and Presence only when the authenticated user is a member/spectator of that match.

## 5. Environment
Copy:

```bash
cp .env.example .env
```

Fill:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Use the browser-safe **publishable** key, never a Supabase secret key in Vite.

## 6. Start

```bash
npm install
npm run dev
```

## Important security model

The browser never decides the official score.

```text
Tap object
   ↓
claim_hunt_target(match_id, object_id)
   ↓
PostgreSQL validates + atomic first claim
   ↓
score / claim persisted
   ↓
private Broadcast notifies connected clients
   ↓
clients reload official snapshot
```

Even if a malicious client broadcasts a fake `TARGET_CLAIMED` message, other clients reload the authoritative database state instead of trusting that payload for score.
