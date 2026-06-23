# Werewolf Online Final Upgrade

Project website game Werewolf online realtime menggunakan:

- Node.js
- Express
- Socket.IO
- HTML, CSS, JavaScript
- WebRTC untuk voice chat antar pemain
- Tanpa database eksternal, semua room disimpan sementara di memori server

## Fitur

- Buat room dan join room pakai kode
- Multiplayer realtime
- Role rahasia otomatis
- Animasi reveal role saat game dimulai
- Narasi game di setiap fase
- Opsi suara narasi memakai browser Text-to-Speech
- Vote Kepala Desa sebelum malam pertama
- Kepala Desa memiliki vote x2 saat voting eliminasi selama masih hidup
- Voice room antar pemain dalam satu room menggunakan WebRTC
- Role: Werewolf, Villager, Seer, Doctor, Hunter
- Fase otomatis: Lobby, Vote Kepala Desa, Night, Day, Voting, Hunter Revenge, Game Over
- Timer tiap fase
- Chat publik
- Private log untuk role rahasia
- Channel private Werewolf
- Voting eliminasi
- Win condition otomatis
- Host control: start, skip fase, reset, kick player
- Responsive untuk HP dan PC

## Cara Menjalankan di Laptop / PC

1. Install Node.js dari https://nodejs.org
2. Extract folder project ini
3. Buka terminal/CMD di dalam folder project
4. Jalankan:

```bash
npm install
npm start
```

5. Buka browser:

```text
http://localhost:3000
```

## Cara Main Lokal Beramai-ramai Satu WiFi

Kalau teman satu WiFi:

1. Cari IP laptop/server kamu.
   - Windows CMD:

```bash
ipconfig
```

2. Cari IPv4 Address, contoh:

```text
192.168.1.8
```

3. Teman buka dari HP/browser:

```text
http://192.168.1.8:3000
```

Pastikan firewall Windows mengizinkan Node.js.

## Catatan Voice Chat

Voice chat menggunakan WebRTC. Untuk izin mikrofon:

- Aman di `http://localhost:3000`
- Untuk HP/hosting online, sebaiknya pakai HTTPS
- Kalau dibuka lewat IP lokal seperti `http://192.168.x.x:3000`, beberapa browser HP bisa menolak izin mikrofon. Kalau begitu, jalankan di hosting HTTPS atau pakai browser yang mengizinkan mic di jaringan lokal.
- Untuk jaringan berbeda/online, WebRTC biasanya butuh koneksi internet dan STUN. Project ini sudah memakai STUN publik Google.

## Cara Upload ke Panel Pterodactyl

1. Buat server Node.js di panel.
2. Upload semua file project.
3. Jalankan install command:

```bash
npm install
```

4. Startup command:

```bash
npm start
```

5. Pastikan port panel diarahkan ke port yang diberikan panel.
   Project ini otomatis membaca `process.env.PORT`, jadi cocok untuk panel/hosting.

## Alur Game

1. Host membuat room.
2. Pemain lain join menggunakan kode room.
3. Host klik Mulai Game.
4. Setiap pemain mendapat role rahasia dengan animasi reveal.
5. Semua pemain memilih Kepala Desa.
6. Game masuk fase malam.
7. Werewolf memilih korban, Seer menerawang, Doctor melindungi.
8. Game masuk fase siang untuk diskusi.
9. Game masuk fase voting eliminasi.
10. Kepala Desa memiliki suara x2 saat voting selama masih hidup.
11. Sistem mengecek pemenang otomatis.

## Catatan Penting

- Room akan hilang kalau server restart, karena versi ini memakai memori server.
- Voice chat tidak menyimpan suara apa pun di server. Server hanya membantu signaling koneksi WebRTC.
- Untuk versi lebih besar, bisa ditambah database MongoDB/PostgreSQL agar room, akun, ranking, dan history match tersimpan permanen.
