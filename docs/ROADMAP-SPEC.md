targetnya sampai **aplikasi benar-benar jadi, stabil, bisa dipakai banyak pemain, ada mode 3D, mode AR, admin, ranking, dan banyak world**, jalurnya memang cukup panjang. Saya sarankan kita anggap ini sebagai proyek bertahap, bukan langsung “buat semua fitur”.

Urutan besarnya seperti ini:

1. **Kunci konsep game** 
   -  Nama: **Arabic Hunt Battle** 
   -  Mode kompetitif dipisahkan: 
     -  🎮 3D Battle 
     -  📱 AR Battle 
   -  Pemain 2–8 orang 
   -  Semua pemain dalam match mencari daftar benda yang sama 
   -  Setiap target hanya bisa diklaim sekali 
   -  Ada timer, skor, penalti salah, bonus difficulty, combo 
   -  Admin bertindak sebagai host/spectator 
   -  Admin bisa melihat pergerakan virtual, target, salah klik, skor, status pemain 
   -  World pertama: **Student Room** 
2. **Bangun fondasi project**
   -  PlayCanvas Engine 
   -  Vite 
   -  TypeScript 
   -  WebXR 
   -  Supabase 
   -  Struktur folder modular 
   -  Event system 
   -  Game state machine 
   -  Asset manager 
   -  World manager 
   -  UI manager 
   -  Audio manager 
   -  Networking manager 
   Target fase ini:
   ```
   ```
   ```
   npm install
   npm run dev
   ```
   lalu project bisa boot tanpa error.
3. **Bangun World System**

   Jangan membuat Student Room sebagai kasus khusus.

   Struktur:
   ```
   ```
   ```
   WorldManager
      │
      ├── Student Room
      ├── Kitchen
      ├── Classroom
      ├── Market
      ├── Hospital
      └── Airport
   ```
   Setiap world harus punya:
   -  config 
   -  model 
   -  vocabulary 
   -  interactive objects 
   -  spawn points 
   -  target points 
   -  difficulty 
   -  AR scale 
   -  thumbnail 
   -  ambience 
4. **Bangun Student Room versi produksi**

   Ini fase besar pertama.

   Bukan lagi primitive cube sederhana.

   Isi:
   -  bed 
   -  pillow 
   -  blanket 
   -  desk 
   -  chair 
   -  wardrobe 
   -  bookshelf 
   -  books 
   -  computer 
   -  monitor 
   -  keyboard 
   -  mouse 
   -  lamp 
   -  drawer 
   -  curtain 
   -  window 
   -  door 
   -  rug 
   -  plant 
   -  bag 
   -  pen 
   -  pencil 
   -  cup 
   -  bottle 
   -  key 
   -  boxes 
   -  dekorasi 
   Target:
   ```
   ```
   ```
   50–80 benda terlihat
   35–45 benda vocabulary
   10–15 benda interaktif
   ```
5. **Bangun Object Metadata System**

   Setiap benda punya identitas.

   Contoh:
   ```
   ```
   ```
   {
     objectId: "book_red_01",
     vocabularyId: "book",
     arabic: "كِتَابٌ",
     color: "red",
     category: "school",
     difficulty: 1
   }
   ```
   Ini penting karena game nantinya harus bisa membedakan:
   -  buku merah 
   -  buku biru 
   -  buku di atas meja 
   -  buku di bawah tempat tidur 
6. **Bangun Interaction System**

   Semua object menggunakan sistem yang sama:
   -  hover 
   -  tap 
   -  raycast 
   -  highlight 
   -  correct 
   -  wrong 
   -  open 
   -  close 
   -  toggle 
   -  drag 
   -  place 
   Contoh:
   ```
   ```
   ```
   Door
   CLOSED
      ↓
   OPENING
      ↓
   OPEN
   ```
   Jangan membuat script khusus satu-satu kalau bisa direuse.
7. **Bangun Vocabulary & Learning Data**

   Database vocabulary global.

   Misalnya:
   ```
   ```
   ```
   كتاب
   كِتَابٌ
   kitābun
   buku
   book
   audio
   category
   difficulty
   ```
   Kemudian satu vocabulary bisa muncul di banyak world.

   `كتاب` bisa muncul di:
   -  Student Room 
   -  Classroom 
   -  Library 
   -  Office 
8. **Bangun Target List / Hunt Engine**

   Ini inti game Anda.

   Contoh match:
   ```
   ```
   ```
   03:00

   FIND:

   ☐ كتاب أحمر
   ☐ مصباح
   ☐ حقيبة
   ☐ قلم
   ☐ مفتاح
   ☐ كرة تحت السرير
   ☐ دفتر أزرق
   ☐ كرسي
   ```
   World boleh punya 70 benda, tapi server memilih 12–20 target.

   Target bisa:
   -  noun 
   -  noun + color 
   -  noun + location 
   -  action 
   -  listening 
9. **Bangun sistem claim**

   Begitu pemain menemukan benda:
   ```
   ```
   ```
   Player
      ↓
   submit object
      ↓
   SERVER VALIDATION
      ↓
   first valid claim
      ↓
   claimed
   ```
   Semua pemain langsung melihat:
   ```
   ```
   ```
   ✅ مِصْبَاحٌ — Ahmad
   ```
   Pemain lain tidak bisa mengambil poin target itu lagi.
10. **Bangun scoring**

    Saya sarankan:
    ```
    ```
    ```
    Easy target      +40–60
    Medium target    +70–90
    Hard target      +100–140

    Wrong object     -15
    Combo            bonus
    ```
    Jangan hanya menghitung jumlah benda.

    Pemain yang menemukan 5 target sulit bisa mengalahkan pemain yang menemukan 7 target mudah.
11. **Bangun 3D Battle dahulu**

    Ini harus selesai sebelum AR multiplayer.

    Semua pemain 3D:
    -  camera sama 
    -  FOV sama 
    -  zoom limit sama 
    -  world seed sama 
    -  target sama 
    -  posisi benda sama 
    Kalau **3D Battle belum stabil, jangan masuk AR multiplayer dulu**.
12. **Supabase Authentication**

    Baru mulai backend akun:
    -  Google 
    -  email 
    -  guest optional 
    Tables:
    ```
    ```
    ```
    profiles
    worlds
    vocabulary
    world_vocabulary
    matches
    match_players
    match_targets
    claims
    rankings
    progress
    achievements
    ```
13. **Multiplayer Room System**

    Admin/host membuat match:
    ```
    ```
    ```
    Game:
    3D Battle

    World:
    Student Room

    Players:
    4

    Targets:
    15

    Time:
    3 minutes

    Difficulty:
    Intermediate
    ```
    Sistem menghasilkan:
    ```
    ```
    ```
    ROOM CODE
    A7K92
    ```
    Peserta join.
14. **Realtime multiplayer**

    Gunakan:
    -  Presence → online/ready/disconnected 
    -  Broadcast → game events 
    -  database → hasil permanen 
    Event misalnya:
    ```
    ```
    ```
    PLAYER_READY
    MATCH_START
    TARGET_CLAIM
    CLAIM_REJECTED
    SCORE_UPDATE
    PLAYER_POSE
    MATCH_END
    ```
15. **Server-authoritative validation**

    Ini wajib sebelum multiplayer dianggap serius.

    Jangan percaya browser:
    ```
    ```
    ```
    client:
    "Saya dapat 100 poin"
    ```
    Tidak boleh.

    Client hanya kirim:
    ```
    ```
    ```
    objectId
    matchId
    targetId
    ```
    Server menentukan:
    -  benar/salah 
    -  sudah diklaim belum 
    -  siapa pertama 
    -  poin 
    -  ranking 
16. **Admin Dashboard**

    Ini menjadi aplikasi kontrol pertandingan.

    Admin melihat:
    ```
    ```
    ```
    Ahmad   340
    Budi    290
    Zahra   260
    Citra   210
    ```
    serta map:
    ```
    ```
    ```
    Student Room

    Ahmad ● → desk
    Budi  ● → wardrobe
    Zahra ● → bookshelf
    Citra ● → bed
    ```
    Admin juga bisa:
    -  start 
    -  pause 
    -  resume 
    -  end 
    -  skip target 
    -  remove player 
    -  lihat connection 
    -  lihat wrong taps 
17. **3D telemetry**

    Kirim posisi player/camera secara ringan.

    Misalnya:
    ```
    ```
    ```
    5–10 update/detik
    ```
    Jangan 60 update/detik.

    Admin bisa mengetahui:
    -  posisi 
    -  arah pandang 
    -  target ray 
    -  object yang sedang dipilih 
18. **3D Battle QA**
     Sebelum AR: 
    -  2 players 
    -  4 players 
    -  6 players 
    -  8 players 
    -  koneksi lambat 
    -  reconnect 
    -  dua pemain klik target bersamaan 
    -  refresh browser 
    -  host disconnect 
    -  duplicate claim 
    -  wrong tap spam 
19. **Bangun AR Mode**

    Baru setelah 3D battle stabil.

    Flow:
    ```
    ```
    ```
    ENTER AR
       ↓
    detect surface
       ↓
    reticle
       ↓
    tap to place
       ↓
    anchor
       ↓
    scale
       ↓
    rotate
       ↓
    LOCK ARENA
    ```
20. **AR Device Check**

    Sebelum pemain masuk AR match:
    ```
    ```
    ```
    ✓ WebXR
    ✓ AR session
    ✓ Hit test
    ✓ supported device
    ✓ camera access
    ```
    Kalau gagal:
    ```
    ```
    ```
    AR unavailable
    ```
    tetapi jangan otomatis memasukkannya ke AR match.
21. **AR Battle terpisah**

    Sesuai keputusan kita:
    ```
    ```
    ```
    AR PLAYER
    VS
    AR PLAYER
    ```
    Tidak ada:
    ```
    ```
    ```
    AR
    VS
    3D
    ```
    Ranking juga terpisah.
22. **AR fairness**

    Semua pemain:
    -  ukuran arena sama 
    -  seed sama 
    -  posisi benda sama 
    -  target sama 
    -  minimal device check sama 
    Pertandingan tidak mulai sampai:
    ```
    ```
    ```
    Ahmad    ✓
    Budi     ✓
    Citra    ✓
    Zahra    ✓

    ALL AR READY
    ```
23. **AR spectator**

    Admin tetap tidak perlu menerima video kamera.

    Admin hanya menerima koordinat virtual:
    ```
    ```
    ```
    position
    orientation
    target
    state
    ```
    Jadi privasi dan bandwidth lebih baik.
24. **Result screen**

    Setelah match:
    ```
    ```
    ```
    🥇 Ahmad
    920 pts

    Objects claimed: 7
    Wrong taps: 2
    Accuracy: 88%
    Best streak: 4
    ```
    Lalu:
    ```
    ```
    ```
    REVIEW WORDS
    ```
25. **Learning analytics**

    Ini akan menjadi nilai tambah besar.

    Guru/admin bisa melihat:
    ```
    ```
    ```
    ثلاجة
    accuracy 42%

    مصباح
    accuracy 74%

    كتاب
    accuracy 91%
    ```
    Juga:
    -  rata-rata waktu mencari 
    -  benda paling sering salah 
    -  vocabulary mastery 
    -  world mastery 
26. **Progression system**

    Pemain mendapatkan:
    -  XP 
    -  level 
    -  achievements 
    -  mastery 
    -  badges 
    Misalnya:
    ```
    ```
    ```
    Student Room 82%
    Kitchen 47%
    Classroom 16%
    ```
27. **Leaderboard**

    Pisahkan:
    ```
    ```
    ```
    3D Ranking
    AR Ranking
    ```
    Bisa punya:
    -  daily 
    -  weekly 
    -  all-time 
    -  class ranking 
28. **Tambah Kitchen**

    Jangan tambah Kitchen sebelum Student Room dan sistem multiplayer matang.

    Kitchen menjadi tes pertama apakah arsitektur benar-benar reusable.
29. **Tambah world berikutnya**

    Urutan yang saya sarankan:
    ```
    ```
    ```
    01 Student Room
    02 Kitchen
    03 Classroom
    04 Market
    05 Hospital
    06 Airport
    07 Park
    ```
30. **Asset pipeline profesional**
     Pada titik ini primitive object diganti GLB asli: 
    -  Blender 
    -  GLB 
    -  optimized meshes 
    -  shared materials 
    -  texture atlas 
    -  compressed textures 
    -  LOD jika perlu 
31. **Mobile optimization**

    Wajib tes:
    -  Android low-end 
    -  Android mid-range 
    -  Android flagship 
    -  laptop 
    -  tablet 
    Target:
    ```
    ```
    ```
    3D: ~60 FPS preferred
    AR: ~30–60 FPS acceptable
    ```
32. **Audio production**

    Jangan mengandalkan browser TTS selamanya.

    Siapkan audio native speaker:
    ```
    ```
    ```
    كتاب.mp3
    قلم.mp3
    مصباح.mp3
    ...
    ```
    Dengan pronunciation yang konsisten.
33. **UI/UX production pass**
     Finalisasi: 
    -  app icon yang tadi dipilih 
    -  splash screen 
    -  home 
    -  mode cards 
    -  world cards 
    -  lobby 
    -  hunt HUD 
    -  admin dashboard 
    -  results 
    -  progress 
    -  settings 
34. **Security**
     Cek: 
    -  RLS 
    -  private room 
    -  user cannot edit score 
    -  user cannot claim twice 
    -  user cannot impersonate other player 
    -  admin permission 
    -  rate limiting 
    -  sanitization 
35. **Testing besar**

    Lakukan sesi:
    ```
    ```
    ```
    2 players
    4 players
    8 players
    ```
    lalu:
    ```
    ```
    ```
    10 concurrent matches
    25 concurrent matches
    ...
    ```
36. **Deployment**

    Frontend:
    ```
    ```
    ```
    Vercel
    ```
    Backend:
    ```
    ```
    ```
    Supabase
    ```
    Assets bisa:
    ```
    ```
    ```
    Supabase Storage
    atau CDN/static hosting
    ```
37. **PWA**

    Saya sangat menyarankan nantinya dibuat PWA:
    ```
    ```
    ```
    Add to Home Screen
    ```
    Jadi terasa seperti aplikasi tanpa harus langsung Play Store.
38. **Beta**

    Jangan langsung publik.

    Tahap:
    ```
    ```
    ```
    Internal Alpha
    ↓
    Small Classroom Test
    ↓
    Closed Beta
    ↓
    Public Beta
    ```
39. **Observasi pemain nyata**

    Ini penting sekali.

    Lihat:
    -  apakah daftar target terbaca? 
    -  apakah orang spam tap? 
    -  world terlalu penuh? 
    -  target terlalu tersembunyi? 
    -  AR bikin pusing? 
    -  3 menit terlalu panjang? 
    -  15 target terlalu banyak? 
40. **Release v1.0**

    Menurut saya jangan menunggu tujuh world.

    **v1.0 sudah layak** kalau punya:
    ```
    ```
    ```
    ✓ Login
    ✓ Student Room
    ✓ Kitchen
    ✓ 3D Battle
    ✓ AR Battle
    ✓ 2–8 players
    ✓ Admin Dashboard
    ✓ Rankings
    ✓ Progress
    ✓ Stable multiplayer
    ```

Kalau saya yang mengelola proyek ini, saya akan membaginya menjadi milestone yang lebih mudah diikuti:

```
```

```
v0.1  Foundation
v0.2  Student Room Visual
v0.3  Hunt Gameplay
v0.4  3D Multiplayer
v0.5  Admin Spectator
v0.6  AR Mode
v0.7  AR Multiplayer
v0.8  Analytics + Progress
v0.9  Kitchen + Polish
v1.0  Production Release
```

Dan **langkah kita sekarang** seharusnya masih di:

> **v0.2 → Student Room Visual + object metadata**, lalu segera masuk ke **v0.3 → Hunt Gameplay**.

Saya akan menahan diri dulu dari membuat AR multiplayer atau Kitchen terlalu cepat. **Core Hunt harus terasa seru di 3D terlebih dahulu.** Setelah gameplay 3D-nya sudah membuat orang ingin main lagi, baru kita investasikan tenaga besar ke AR.