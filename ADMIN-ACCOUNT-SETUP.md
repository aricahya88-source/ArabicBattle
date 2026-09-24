# First Admin + User Account Setup

This is a one-time bootstrap. After it is complete, additional accounts are created inside the Arabic Hunt Battle Admin Dashboard.

## A. Create the first Auth user

In Supabase:

```text
Authentication
→ Users
→ Add user
```

Create:

```text
Email: admin@login.arabichuntbattle.app
Password: choose a strong password
```

Use direct **Create user** / confirmed user, not an email invitation. This address is only an internal login identifier; the admin will type `admin` in the app.

## B. Promote that user to administrator

After running all required migrations through v0.6.0, open SQL Editor and run:

```sql
update public.profiles
set
  username = 'admin',
  display_name = 'Administrator',
  role = 'admin',
  active = true
where id = (
  select id
  from auth.users
  where email = 'admin@login.arabichuntbattle.app'
);
```

Verify:

```sql
select id, username, display_name, role, active
from public.profiles
where username = 'admin';
```

Expected:

```text
username = admin
role     = admin
active   = true
```

## C. Login to the app

Use:

```text
Username: admin
Password: the password chosen in Supabase
```

The app automatically opens the Admin Dashboard.

## D. Create player accounts

Open:

```text
Admin Dashboard
→ User Accounts
```

Fill:

```text
Username       player01
Nama Tampilan  Ahmad
Password       ********
Role           Player
```

Click **Buat Akun**.

The player signs in using only:

```text
player01
+ password
```

## E. Account controls

Admin can:

- create Player or Admin accounts;
- reset a user's password;
- deactivate an account;
- reactivate an account.

Passwords are handled by Supabase Auth and are not stored as plaintext in `public.profiles`.
