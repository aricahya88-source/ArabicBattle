# Realtime + AR QA Checklist — v0.7.0

## 3D regression
- [ ] 2 players create/join/ready/start/end
- [ ] correct target updates score globally
- [ ] wrong target = -15
- [ ] duplicate simultaneous claim only rewards one player
- [ ] pause/resume works
- [ ] reconnect restores match state

## AR device/session
- [ ] Vercel HTTPS URL
- [ ] WebXR preflight passes on compatible Android device
- [ ] Start AR only begins after explicit user tap
- [ ] hit-test reticle appears on table/floor
- [ ] Place Arena locks miniature world
- [ ] optional anchor shows Anchored when supported
- [ ] Reset clears placement
- [ ] rotate left/right changes orientation but not scale
- [ ] ending AR session before start automatically clears Ready

## AR multiplayer
- [ ] Admin creates mode=AR
- [ ] 2 AR players join same room
- [ ] each player independently places the identical miniature world
- [ ] Ready disabled until placement
- [ ] admin cannot start until >=2 players and all participants Ready
- [ ] synchronized countdown
- [ ] AR select/tap claims correct object
- [ ] same target cannot score twice across devices
- [ ] score/activity changes live on admin laptop
- [ ] virtual pose markers move in admin spectator
- [ ] Pause blocks AR claims; Resume restores claims
- [ ] AR session loss during running shows setup overlay and allows re-entry/re-placement
- [ ] match end shows result and contributes to AR leaderboard

## Scale tests
Repeat AR multiplayer with 2, 4, 6 and 8 players. Test slow connection, refresh, host disconnect, duplicate claim and wrong-tap spam.
