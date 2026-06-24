# Werewolf by Ryuu v4.5 Room Cleanup Auto Reset Fix

Patch aman dari v4.4.

Yang berubah:
- Room lobby tanpa pemain online langsung hilang dari daftar room.
- Daftar room hanya menampilkan lobby yang benar-benar punya pemain online.
- Setelah game selesai, room otomatis kembali ke lobby lebih cepat dan siap start ronde baru.
- Kalau pemain keluar lalu masuk room lain, server membersihkan slot lama supaya room baru fresh.
- Room aktif yang sedang berjalan tetap disimpan di data/rooms.json agar reconnect/recover Railway tetap aman.

Upload isi folder ini ke repo GitHub, bukan ZIP-nya langsung.


## v4.6 Voice Participants Patch

- Menambahkan daftar pemain yang sedang berada di voice room.
- Daftar voice muncul di kotak Voice Room dengan avatar/nama dan indikator online.
- Tidak mengubah gameplay, role, room cleanup, reset, musik, atau sistem lain.
