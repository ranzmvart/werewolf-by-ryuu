# Werewolf by Ryuu Final - Shared Room Music

Versi final untuk Railway/Node.js hosting.

## Fitur Baru 2.4.0

- Host bisa memutar musik bersama untuk semua pemain dalam room.
- Tombol `Room` pada setiap lagu YouTube/Preview/Radio untuk memutar ke semua pemain.
- Tombol `Putar ke Room`, `Pause Room`, dan `Stop Room` khusus host.
- Pemain HP mendapat tombol `Aktifkan di HP` agar audio bisa jalan setelah satu kali tap.
- Musik room tersimpan di state room, jadi pemain yang reconnect/join ulang bisa sync ulang.
- YouTube Music Search tetap tersedia.
- Reconnect, voice room, role, animasi, Kades vote x2, dan auto reset room tetap ada.

## Kenapa HP perlu tombol Aktifkan?

Browser HP sering memblokir audio yang diputar otomatis. Karena itu setiap pemain perlu menekan `Aktifkan di HP` minimal sekali setelah masuk room. Setelah itu, lagu dari host bisa disync lebih lancar.

## Deploy Railway

Upload isi folder ini ke GitHub repo kamu:

```text
public/
package.json
railway.json
Dockerfile
README.md
server.js
```

Railway akan build menggunakan Dockerfile dan Node 22.

## Cara Pakai Musik Bersama

1. Host buat/join room.
2. Host buka player musik bawah.
3. Cari lagu, contoh: `The Cure Boys Don't Cry`.
4. Pilih hasil YouTube.
5. Klik tombol `Room` pada lagu, atau pilih lagu lalu klik `Putar ke Room`.
6. Pemain lain tekan `Aktifkan di HP` jika lagu belum terdengar.

Catatan: lagu lokal dari perangkat tidak bisa diputar bersama karena file hanya ada di perangkat masing-masing. Gunakan YouTube/Preview/Radio untuk musik bersama.
