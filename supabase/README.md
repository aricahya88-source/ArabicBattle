# Supabase setup
1. Create project.
2. Run `migrations/202609210001_initial.sql` in SQL Editor.
3. Copy `.env.example` to `.env.local` and fill URL + publishable key.
4. Enable Auth providers you want.

## Production TODO
The client ships a Realtime adapter, but **authoritative target claims must be implemented server-side** (RPC or Edge Function with transaction locking) before competitive production use.
Recommended RPC: `claim_target(match_id, target_id, object_id)` which verifies membership, open match, correct object and null `claimed_by`, then atomically sets the winner and score.
