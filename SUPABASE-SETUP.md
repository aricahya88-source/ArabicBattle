# Supabase Setup — Arabic Hunt Battle v0.4.1

## 1. Environment

Frontend `.env` contains browser-safe values only:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

Never put a Supabase secret/service-role key in a `VITE_...` variable.

## 2. Run SQL migrations

In Supabase **SQL Editor**, run:

1. `supabase/migrations/202609210001_initial.sql`
2. `supabase/migrations/202609210002_realtime_multiplayer.sql`
3. `supabase/migrations/202609230001_admin_credentials.sql`

The third migration adds:

- `profiles.username`
- `profiles.role`
- `profiles.active`
- admin/active authorization helpers
- account profile trigger upgrade

## 3. Auth configuration

Go to:

```text
Authentication → Sign In / Providers
```

Keep **Email/password authentication enabled**, because Supabase Auth uses an internal synthetic email identity behind each username.

Recommended:

```text
Allow new users to sign up = OFF
Allow anonymous sign-ins = OFF
Google = OFF / not required
```

Users never type an email in this application.

## 4. Bootstrap the first admin

Follow `ADMIN-ACCOUNT-SETUP.md`.

## 5. Deploy admin-users Edge Function

The source is:

```text
supabase/functions/admin-users/index.ts
```

Using Supabase CLI:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-users
```

The function expects a server-side secret. Supabase Edge Functions commonly expose the service-role secret automatically. The function also supports a secret named `SUPABASE_SECRET_KEY` if you choose to add one in Edge Function secrets.

Do **not** add that secret to the Vite `.env`.

## 6. Realtime private channels

In Realtime settings, disable public channel access if required by your project configuration. Match channels use:

```text
match:<uuid>
```

and the SQL migration authorizes Broadcast/Presence only for active members of that match.

## 7. Start app

```bash
npm install
npm run dev
```

Login with the first admin username/password, then open:

```text
User Accounts
```

and create player accounts.
