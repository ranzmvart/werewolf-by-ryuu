# Werewolf by Ryuu v3.3 Final

Update ini menambahkan:

- Open Crate / Gacha: Moon Crate, Blood Moon Crate, Royal Legend Crate.
- Rarity: Common, Rare, Epic, Legendary, Mythic.
- Reward crate: poin, skin, frame, badge, dan power item sekali pakai.
- Friends system: cari username, add friend, accept request, hapus teman.
- Invite friend ke lobby: teman bisa join dari halaman Friends, password room dibypass khusus invite.
- Persistent rooms: room aktif disimpan ke `/app/data/rooms.json` agar bisa dipulihkan setelah Railway restart/redeploy.
- Reconnect diperkuat: pemain/host dapat kembali memakai akun atau session browser yang sama.

## Persistent data Railway

Pasang Railway Volume ke:

```txt
/app/data
```

File yang disimpan:

```txt
/app/data/players.json
/app/data/rooms.json
```

## Deploy

```bash
npm install
npm start
```

Railway akan memakai:

```txt
Start Command: npm start
```
