# v0.4 Realtime Test Checklist

## A. Two-player baseline
- [ ] Phone A Guest login works.
- [ ] Phone B Guest login works.
- [ ] A creates 2-player 3D room.
- [ ] B joins by room code.
- [ ] Presence shows both connected.
- [ ] A toggles Ready.
- [ ] B toggles Ready.
- [ ] Start stays disabled until both ready.
- [ ] Host starts match.
- [ ] Both clients show the same target list.
- [ ] 3-second countdown is synchronized.
- [ ] Timer is derived from server timestamps.

## B. Claim race
- [ ] A and B tap the same target almost simultaneously.
- [ ] Exactly one player receives points.
- [ ] The target shows claimed on both devices.
- [ ] Losing request does not overwrite the claim.
- [ ] Wrong non-target tap subtracts 15.
- [ ] Combo increments only on accepted claims.
- [ ] Wrong tap resets combo.

## C. Reconnect
- [ ] Refresh Phone B mid-match.
- [ ] Session restores.
- [ ] Active match restores from local match id.
- [ ] Claimed targets restore correctly.
- [ ] Score restores correctly.
- [ ] Timer restores from server `ends_at`.
- [ ] Realtime channel reconnects.

## D. Admin spectator
- [ ] Open `?admin=1` on laptop.
- [ ] Admin creates match for 4 players.
- [ ] Admin appears as spectator, not 1/4 player.
- [ ] Four separate players can still join.
- [ ] Admin sees scores update.
- [ ] Admin sees pose markers when players move cameras.
- [ ] Pause freezes official remaining time.
- [ ] Resume assigns a new `ends_at`.

## E. Capacity
Repeat using:
- [ ] 2 players
- [ ] 4 players
- [ ] 6 players
- [ ] 8 players

## F. Adversarial / edge cases
- [ ] Ninth player cannot join an 8-player room.
- [ ] User outside the room cannot subscribe to its private Realtime topic.
- [ ] User outside the room cannot query targets/players due to RLS.
- [ ] Non-host cannot call start/pause/resume successfully.
- [ ] Claims before start are rejected.
- [ ] Claims while paused are rejected.
- [ ] Claims after timer expires are rejected.
- [ ] Duplicate target claims cannot both score.
