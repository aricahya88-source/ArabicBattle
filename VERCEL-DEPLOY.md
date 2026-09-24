# Vercel Deployment — v0.7.0

AR should be tested on the final HTTPS deployment because immersive WebXR requires a secure context on normal mobile browsers.

## Before push
```bash
npm install
npm run typecheck
npm run build
```

## Vercel
1. Push the project to GitHub.
2. Import the repository in Vercel.
3. Framework preset: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
7. Deploy.

`vercel.json` keeps SPA routes working. Do not put Supabase service-role/secret credentials in Vercel variables exposed to Vite.

## Supabase URL configuration
Add your Vercel production URL to the allowed Site/Redirect URLs if your auth configuration requires it. Username/password sign-in in this build does not require Google OAuth.

## AR verification after deployment
Open the Vercel HTTPS URL on a compatible Android WebXR device and test:
- AR Device Check passes.
- Start AR opens immersive camera session from a button tap.
- Reticle appears on a horizontal surface.
- Place Arena locks the miniature world.
- Ready is unavailable before placement.
- Two AR players can join the same AR room.
- First valid claim wins globally.
- Pause/Resume blocks/unblocks claims.
- Admin spectator sees virtual movement/score/activity.
- Refresh/session loss requires re-entering and re-placing AR but preserves official match state from Supabase.
