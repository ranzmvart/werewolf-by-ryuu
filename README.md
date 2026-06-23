# Werewolf by Ryuu — YouTube Music Final

Versi final untuk Railway/Node.js hosting.

## Fitur utama

- Multiplayer realtime dengan Socket.IO
- Room, role rahasia, voting, Kades vote x2
- Animasi role, kill, save, win, lose
- Voice WebRTC untuk pemain
- Reconnect/join ulang ke room
- Auto reset room setelah game selesai
- UI clean untuk HP dan laptop
- Music player:
  - Cari lagu YouTube dari dalam game
  - Pilih hasil seperti playlist
  - Putar lewat embedded YouTube player
  - Preview iTunes/Apple Music
  - Radio online publik
  - Upload lagu lokal dari perangkat

## Deploy Railway

Build command:

```bash
npm install --omit=dev
```

Start command:

```bash
npm start
```

Railway akan memberi variabel PORT otomatis. Server sudah listen ke `0.0.0.0`.

## Catatan musik

YouTube diputar lewat embedded YouTube player, bukan download audio. Beberapa video bisa menolak embed, jadi pilih hasil lain kalau error.
Spotify full-track tidak dimasukkan karena butuh akun Premium/token dan tidak bisa langsung diputar bebas di web.
