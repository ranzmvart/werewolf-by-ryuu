# Werewolf by Ryuu v3.2 Final

Versi final ini berisi update sesuai permintaan:

- Login/register hilang setelah pemain login.
- Menu akun berubah menjadi profil pemain ringkas.
- Shop, Inventory, Profil lengkap, dan Leaderboard dibuka sebagai halaman terpisah, bukan menumpuk di menu utama.
- Power item menjadi item konsumsi: beli 1 = stok 1, beli 2 = stok 2.
- Power item hanya aktif satu kali dalam game/situasi yang sesuai, lalu stok berkurang 1.
- Skin, badge, frame, inventory, statistik, leaderboard, dan shop tetap aktif.
- Cinematic role/aksi dibuat lebih keren dengan animasi 3D-style CSS: Werewolf memangsa, Seer vision, heal, death, victory, dan power item.
- Owner account tetap ada:
  - Username: ryuu
  - PIN: 291206
  - Poin: unlimited
- Cocok untuk Railway dengan volume `/app/data` agar data pemain tidak hilang.

## Upload ke GitHub

Upload isi folder ini ke root repo, bukan foldernya sebagai subfolder.

Struktur yang benar:

```text
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

## Railway Volume

Agar akun, PIN, poin, statistik, inventory, dan foto profil tidak hilang, pasang Railway Volume:

```text
Mount path: /app/data
```
