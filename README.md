# Werewolf by Ryuu v4.1 - Reconnect/Kades/Assets Fix

Patch ini memperbaiki:

- Bug room baru tiba-tiba masuk fase Kepala Desa sebelum host klik Start.
- Auto reconnect yang terlalu agresif dan menyebabkan loop reconnect.
- Pemulihan auth/socket setelah reconnect tanpa memaksa reconnect saat baru join room.
- Room list hanya menampilkan room lobby yang benar-benar belum mulai.
- Guard server: fase Kades/role reveal tidak bisa berjalan kalau game belum dimulai.
- Path asset TCG yang salah diperbaiki agar tidak muncul teks scene/image atau gambar kosong.
- Layout game room dari v3.9 tetap dipertahankan.

Upload isi folder ini ke root repo GitHub, lalu Railway redeploy.

Struktur:

```
public/
server.js
package.json
railway.json
Dockerfile
README.md
ASSET_CREDITS.md
```
