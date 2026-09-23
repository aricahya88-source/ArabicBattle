# v0.4.1 Realtime Test Checklist

## Authentication
- [ ] First admin can login with username/password.
- [ ] Google button is absent.
- [ ] Guest button is absent.
- [ ] Admin → User Accounts loads account list.
- [ ] Admin can create `player01` and `player02`.
- [ ] Player account cannot access admin routes.
- [ ] Reset Password works.
- [ ] Deactivated user cannot login through the app.

## Two-phone realtime
- [ ] Phone A logs in as `player01`.
- [ ] Phone B logs in as `player02`.
- [ ] Phone A creates a 2-player room.
- [ ] Phone B joins by room code.
- [ ] Presence updates both users.
- [ ] Ready state syncs.
- [ ] Countdown begins at the same server time.
- [ ] Same seed and target list appear on both phones.
- [ ] Simultaneous claim gives points to only one phone.
- [ ] Wrong tap penalty persists.
- [ ] Score survives refresh/reconnect.

## Admin spectator
- [ ] Admin creates match without consuming player slot.
- [ ] Admin sees live player score.
- [ ] Admin receives pose telemetry.
- [ ] Pause/resume is synchronized.
