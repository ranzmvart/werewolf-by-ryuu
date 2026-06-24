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


## v3.5 TCG Role/Skin Asset Update

Versi ini menambahkan asset visual TCG-style untuk role, skin, dan effect skill:

- Role cards: Werewolf, Alpha Werewolf, Villager, Seer, Doctor, Hunter, Bodyguard, Witch, Medium, Jester, Cursed Villager, Prince, Priest, Lycan, Sorcerer, Tough Guy.
- Skin cards: Nocturne Wolf, Blood Moon Alpha, Silver Fang, Village Guardian, Royal Villager, Astral Seer, Neon Medic, Void Witch, Raven Hunter, dan lainnya.
- Effect cards: Werewolf Maul, Seer Vision, Doctor Pulse, Guard Wall, Witch Poison, Hunter Shot, Mayor Crown, Blood Moon, Double Vision, Death Smoke, Victory Nova.

Asset ada di:

```text
public/assets/tcg/
```

Manifest asset ada di:

```text
public/assets/tcg/asset-manifest.json
```

Role card di UI sudah diganti dari emoji menjadi kartu visual TCG-style.
