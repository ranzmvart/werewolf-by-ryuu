# Werewolf by Ryuu — Search Music Only Final

Versi ini menghapus playlist bawaan Ryuu Radio dari pilihan lagu. Pemain langsung mencari lagu sendiri lewat YouTube Search, Preview, Radio, atau upload lokal. Host tetap bisa memutar lagu ke seluruh room.

## Perubahan utama

- Playlist bawaan seperti Moon Run, Village Dawn, Wolf Hunt, Seer Vision, Doctor Pulse, Final Vote, dan Victory Fire sudah dihapus dari UI.
- Saat player dibuka, daftar lagu kosong sampai pemain mencari lagu.
- Pencarian utama diarahkan ke YouTube.
- Host tetap bisa klik `Room` pada hasil lagu agar musik didengar bersama.
- Fitur voice, reconnect, auto reset room, Kades x2, animasi role, menang/kalah, dan musik bersama tetap dipertahankan.

## Deploy Railway

Upload isi folder ini ke repo GitHub, lalu Railway akan redeploy. Struktur harus tetap:

```
public/
package.json
railway.json
Dockerfile
server.js
README.md
```
