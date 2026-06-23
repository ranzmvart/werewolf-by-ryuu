# Werewolf by Ryuu — Online Music + Auto Reset Final

Versi final untuk Railway/hosting Node.js.

## Fitur Utama
- Werewolf online realtime dengan Socket.IO
- Role rahasia, animasi role, animasi menang/kalah/dibunuh/diselamatkan
- Vote Kepala Desa, suara Kades bernilai 2 saat voting eliminasi
- Voice room WebRTC
- Reconnect / join ulang room dari browser yang sama
- UI clean untuk HP dan laptop
- Music player clean dengan playlist bawaan
- Cari lagu online via iTunes/Apple Music preview legal ±30 detik
- Cari radio online publik dan langsung play stream
- Upload lagu lokal dari perangkat sendiri
- Setelah game selesai, room otomatis reset ke lobby dalam 25 detik
- Host bisa reset manual dan langsung start ronde baru

## Catatan Musik
Spotify full-track tidak dipakai karena playback penuh di web membutuhkan OAuth/akun Premium dan tidak bisa langsung diputar bebas tanpa izin. Versi ini memakai iTunes preview, internet radio publik, playlist synth bawaan, dan file lokal agar deploy tetap mudah tanpa API key.

## Deploy Railway
Struktur repo harus langsung seperti ini:

```
public/
package.json
railway.json
README.md
server.js
```

Railway akan menjalankan:

```
npm install --omit=dev
npm start
```

Setelah deploy, masuk Settings → Networking → Generate Domain.
