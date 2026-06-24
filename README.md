# Werewolf by Ryuu v4.2 — Hard Reconnect + Kades Fix

Patch fokus:
- Fix crash/loop setelah Vote Kepala Desa.
- Menambahkan handler fase malam yang aman agar server tidak restart saat Kades selesai.
- Auto reconnect tidak lagi spam setelah pemain sudah berhasil kembali.
- Status reconnect kembali Online saat room state diterima.
- Vote Kades satu pemain hanya bisa satu kali per ronde.
- Jika semua pemain sudah vote Kades, fase lanjut ke malam secara paksa/aman.
- Reconnect player/host dibuat idempotent agar tidak log spam dan tidak mengulang state.
- Semua fitur lama tetap dipertahankan.

Upload isi folder ini ke root GitHub repo, bukan folder ZIP-nya.
