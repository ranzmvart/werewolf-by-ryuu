# Werewolf by Ryuu v3.0 — Profile, Leaderboard, Points, Shop

Versi final upgrade dengan:

- Login & daftar memakai username unik + PIN.
- Username yang sudah dipakai tidak bisa didaftarkan lagi.
- Profil pemain dengan upload foto.
- Badge, skin, frame/border foto, inventory, equip item.
- Sistem poin setelah game selesai.
- Leaderboard Top 100: poin, overall, team Werewolf, team Village, Seer, Doctor.
- Power item: Seer 2x scan, Werewolf 2 target, vote 3 suara, Doctor 2 protect, Bodyguard 2 guard, Witch 2 ramuan/malam, Lucky Charm, Shadow Cloak.
- Statistik menang/kalah, role win, team win, kill, scan, protect, vote.
- Room list, password lobby, reconnect, musik bersama, YouTube search, voice, Kades x2, auto reset.

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

Kalau ingin poin, akun, skin, inventory, dan leaderboard tidak hilang ketika redeploy/restart besar, tambahkan Railway Volume dan mount ke:

```txt
/app/data
```

Tanpa volume, data tetap bisa dipakai saat server hidup, tetapi dapat hilang jika container dibuat ulang.

## Cara main fitur baru

1. Daftar/Login pakai username + PIN.
2. Upload foto profil opsional.
3. Beli item di Shop memakai poin.
4. Equip skin/frame/badge/power di Inventory.
5. Buat room atau join lobby publik.
6. Setelah game selesai, poin dan statistik otomatis masuk.

