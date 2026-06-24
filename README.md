# Werewolf by Ryuu v3.9 - Game UI, Reconnect, Asset Fix

Versi ini memperbaiki tampilan saat bermain di HP/laptop, bug reconnect saat vote Kepala Desa, dan fallback asset agar gambar yang gagal load tidak menampilkan teks kosong seperti scene/image.

## Fix utama

- Layout game room HP dibuat tab: Aksi, Role, Pemain, Chat, Log.
- Layout laptop tetap 3 panel rapi dan proporsional.
- Vote Kepala Desa dikunci setelah memilih dan auto resolve jika semua pemain sudah vote.
- Reconnect diberi guard/cooldown agar tidak spam reconnect berulang.
- Mayor vote tidak diulang karena resolve ganda.
- Asset gambar punya fallback otomatis kalau gagal load.
- Alt text gambar scene tidak lagi muncul sebagai teks jika asset gagal.
- Semua fitur lama tetap dipertahankan.

## Deploy Railway

Upload isi folder ini ke root repo GitHub:

```text
public/
package.json
railway.json
Dockerfile
README.md
server.js
```

Pastikan Railway memakai Node 22 dan Volume tetap mount ke `/app/data` agar data akun/room tetap tersimpan.


## v4.0 Auth Room Fix
- Memperbaiki bug setelah login tetapi create/join room dianggap belum login.
- Auth session sekarang otomatis dipulihkan saat Socket.IO reconnect atau Railway restart.
- Create, join, dan reconnect room membawa auth aman dari browser agar tidak gagal.
