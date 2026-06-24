# Werewolf by Ryuu v3.4 — Cinematic Crate + Modern Assets Final

Versi ini melanjutkan v3.3 dan menambahkan polish visual modern:

- Animasi open crate model spinner/case opening seperti game modern.
- Reward reveal dengan rarity Common, Rare, Epic, Legendary, Mythic.
- Notifikasi kanan saat reward masuk inventory.
- Asset SVG 3D-style buatan sendiri di `public/assets/`, bukan emoji.
- Cinematic role/action lebih hidup memakai asset visual: werewolf attack, seer orb, doctor drone, shield, trophy, rarity core.
- Shop dan inventory lebih visual dengan ikon asset.
- Semua fitur lama tetap ada: login PIN, profile, shop, inventory, leaderboard, crate/gacha, friends, invite lobby, room password, reconnect, persistent rooms, music shared, voice, Kades x2, consumable power item.

## Deploy Railway

Upload isi folder ini ke root repo GitHub:

```txt
public/
package.json
railway.json
Dockerfile
README.md
server.js
```

Railway akan redeploy otomatis.

## Persistent Data

Pastikan Railway Volume mount ke:

```txt
/app/data
```

File yang disimpan permanen:

```txt
/app/data/players.json
/app/data/rooms.json
```

## Owner Account

```txt
Username: ryuu
PIN: 291206
```
