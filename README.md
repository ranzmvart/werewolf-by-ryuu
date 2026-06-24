# Werewolf by Ryuu v3.1 — Profile Pages, Stable Reconnect, Owner Account

Versi final upgrade dengan fokus pada UI profil yang lebih rapi, reconnect yang lebih stabil, dan akun owner khusus.

## Fitur utama

- Login & daftar memakai username unik + PIN.
- Username yang sudah dipakai tidak bisa didaftarkan lagi.
- Setelah login, kotak login/daftar otomatis hilang dan berubah menjadi profil pemain.
- Halaman/tab terpisah: Profil, Shop, Inventory, Leaderboard.
- Profil pemain dengan upload foto sendiri.
- Badge, skin, frame/border foto, inventory, equip item.
- Sistem poin setelah game selesai.
- Akun owner khusus: `ryuu` dengan PIN `291206` dan poin unlimited.
- Leaderboard Top 100: poin, overall, team Werewolf, team Village, Seer, Doctor.
- Power item: Seer 2x scan, Werewolf 2 target, vote 3 suara, Doctor 2 protect, Bodyguard 2 guard, Witch 2 ramuan/malam, Lucky Charm, Shadow Cloak.
- Statistik menang/kalah, role win, team win, kill, scan, protect, vote.
- Loading screen ringan saat masuk agar tampilan tidak kosong.
- Reconnect lebih stabil: timer game tidak freeze saat host/player disconnect, host tetap host saat reconnect.
- Room list, password lobby, musik bersama, YouTube search, voice, Kades x2, auto reset.

## Deploy Railway

Struktur repo:

```txt
werewolf-by-ryuu/
├── public/
│   ├── index.html
│   ├── style.css
│   └── client.js
├── package.json
├── railway.json
├── Dockerfile
├── README.md
└── server.js
```

Railway akan memakai Dockerfile Node 22. Setelah push ke GitHub, Railway redeploy otomatis.

## Penting untuk data akun permanen

Database pemain disimpan di:

```txt
data/players.json
```

Agar poin, akun, skin, inventory, foto profil, dan leaderboard tidak hilang, tambahkan Railway Volume dan mount ke:

```txt
/app/data
```

## Cara main fitur akun

1. Daftar/Login pakai username + PIN.
2. Setelah login, panel berubah menjadi Profil.
3. Buka Shop untuk membeli skin/item.
4. Buka Inventory untuk equip skin/frame/badge/power.
5. Buka Leaderboard untuk melihat Top 100.
6. Buat room atau join lobby publik.
7. Setelah game selesai, poin dan statistik otomatis masuk.
