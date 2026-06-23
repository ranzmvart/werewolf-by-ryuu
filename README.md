# Werewolf by Ryuu — Final Room Browser + Password Lobby

Versi final ini mempertahankan semua fitur sebelumnya: room realtime, voice WebRTC, reconnect, musik YouTube/search-only, musik bersama dari host, auto reset room, Kades vote x2, animasi role/menang/kalah/mati, guide, dan deploy Railway.

## Update terbaru

- Lobby Publik ditambahkan di menu awal.
- Pemain bisa melihat daftar room yang sudah dibuat.
- Pemain bisa join room orang lain langsung dari list tanpa mengetik kode manual.
- Host bisa memberi nama room.
- Host bisa membuat room dengan password opsional.
- Room berpassword muncul dengan ikon 🔒 dan tetap bisa di-join jika pemain tahu password.
- Tombol Refresh daftar room ditambahkan.
- Join manual pakai kode room tetap tersedia.
- Seer tetap hanya bisa menerawang 1 pemain per malam.
- Semua aksi malam role dikunci 1 kali per malam.
- Musik bersama host, voice, reconnect, guide, role tambahan, dan auto reset tetap dipertahankan.

## Struktur deploy Railway

Struktur repo harus langsung seperti ini:

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

Jangan upload sebagai folder ganda.

Railway akan memakai Dockerfile Node 22. Setelah push ke GitHub, Railway akan redeploy otomatis.

## Cara main singkat

1. Isi nama pemain.
2. Untuk host: isi nama room, opsional isi password, lalu klik Buat Room.
3. Untuk pemain: pilih room dari Lobby Publik lalu klik Join. Kalau room terkunci, masukkan password.
4. Pemain juga bisa join manual dengan kode room.
5. Host klik Start Game.
6. Fase Kades: pilih Kepala Desa. Vote Kades bernilai 2 saat eliminasi.
7. Malam: role aktif memilih 1 aksi. Seer hanya 1 terawangan per malam.
8. Siang: diskusi di chat/voice.
9. Voting: pilih target eliminasi.
10. Setelah game selesai, room otomatis kembali ke lobby.

## Cara musik

1. Buka tombol 🎧.
2. Ketik lagu yang diinginkan, contoh `The Cure Boys Don't Cry`.
3. Tekan Cari YouTube.
4. Pilih lagu dari hasil.
5. Jika host ingin semua pemain dengar bersama, tekan Room / Putar ke Room.
6. Di HP, tekan Aktifkan di HP jika audio belum terdengar.
