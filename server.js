// Compatibility guard for older Node runtimes and undici-based dependencies.
try {
  const { toUSVString } = require('util');
  const { Blob, File } = require('buffer');
  if (typeof globalThis.Blob === 'undefined') globalThis.Blob = Blob;
  if (typeof globalThis.File === 'undefined') globalThis.File = File;
  if (typeof String.prototype.toWellFormed === 'undefined') {
    String.prototype.toWellFormed = function () { return toUSVString(this); };
  }
  if (typeof String.prototype.isWellFormed === 'undefined') {
    String.prototype.isWellFormed = function () { return toUSVString(this) === this; };
  }
} catch (_) {}

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { Server } = require('socket.io');
const yts = require('yt-search');


const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'players.json');
const ROOMS_FILE = process.env.ROOMS_FILE || path.join(DATA_DIR, 'rooms.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const SHOP_ITEMS = [
  { id: 'skin_shadow_wolf', type: 'skin', emoji: '🐺', name: 'Shadow Wolf', price: 600, desc: 'Skin profil gelap dengan aura werewolf.', className: 'skin-shadow' },
  { id: 'skin_mystic_seer', type: 'skin', emoji: '🔮', name: 'Mystic Seer', price: 650, desc: 'Skin ungu bercahaya untuk pemain visioner.', className: 'skin-mystic' },
  { id: 'skin_neon_doctor', type: 'skin', emoji: '💉', name: 'Neon Doctor', price: 650, desc: 'Skin hijau neon medical support.', className: 'skin-neon' },
  { id: 'skin_blood_moon', type: 'skin', emoji: '🩸', name: 'Blood Moon', price: 900, desc: 'Skin merah premium dengan vibe malam berdarah.', className: 'skin-blood' },
  { id: 'frame_gold', type: 'frame', emoji: '🏆', name: 'Gold Border', price: 900, desc: 'Border foto emas untuk profil.', className: 'frame-gold' },
  { id: 'frame_wolf', type: 'frame', emoji: '🐺', name: 'Wolf Fang Border', price: 1100, desc: 'Border taring serigala.', className: 'frame-wolf' },
  { id: 'frame_crystal', type: 'frame', emoji: '💎', name: 'Crystal Border', price: 1300, desc: 'Border kristal biru mewah.', className: 'frame-crystal' },
  { id: 'badge_founder', type: 'badge', emoji: '⭐', name: 'Founder Badge', price: 500, desc: 'Badge pendiri awal Ryuu Village.' },
  { id: 'badge_wolf_hunter', type: 'badge', emoji: '🏹', name: 'Wolf Hunter', price: 800, desc: 'Badge pemburu werewolf.' },
  { id: 'badge_mastermind', type: 'badge', emoji: '🧠', name: 'Mastermind', price: 1000, desc: 'Badge pemain strategi.' },
  { id: 'power_seer_double', type: 'power', emoji: '🔮', name: 'Double Vision Lens', price: 2200, desc: 'Sekali pakai: jika kamu Seer, bisa menerawang 2 pemain pada satu malam.' },
  { id: 'power_wolf_double', type: 'power', emoji: '🐺', name: 'Double Fang', price: 2600, desc: 'Sekali pakai: jika kamu Werewolf, tim bisa menyerang hingga 2 target pada satu malam.' },
  { id: 'power_vote_triple', type: 'power', emoji: '🗳️', name: 'Royal Ballot', price: 2000, desc: 'Sekali pakai: vote eliminasi kamu pada satu hari bernilai 3 suara.' },
  { id: 'power_doctor_double', type: 'power', emoji: '💉', name: 'Emergency Kit', price: 2100, desc: 'Sekali pakai: jika kamu Doctor, bisa melindungi 2 target pada satu malam.' },
  { id: 'power_bodyguard_double', type: 'power', emoji: '🛡️', name: 'Twin Guard Oath', price: 1900, desc: 'Sekali pakai: jika kamu Bodyguard, bisa menjaga 2 target pada satu malam.' },
  { id: 'power_witch_dual', type: 'power', emoji: '🧪', name: 'Dual Vial Belt', price: 2300, desc: 'Sekali pakai: jika kamu Witch, bisa memakai heal dan poison pada malam yang sama.' },
  { id: 'power_lucky_charm', type: 'power', emoji: '🍀', name: 'Lucky Charm', price: 2400, desc: 'Sekali pakai: kamu bisa selamat dari satu serangan malam.' },
  { id: 'power_shadow_cloak', type: 'power', emoji: '🌑', name: 'Shadow Cloak', price: 2500, desc: 'Sekali pakai: hasil terawangan Seer terhadapmu tersamarkan sebagai Village.' }
];


// Extra crate-exclusive cosmetics and badges. They can also appear in gacha rewards.
SHOP_ITEMS.push(
  { id: 'skin_abyss_king', type: 'skin', rarity: 'legendary', emoji: '👑', name: 'Abyss King', price: 3600, desc: 'Legendary skin dengan aura raja kegelapan.', className: 'skin-blood' },
  { id: 'skin_star_seer', type: 'skin', rarity: 'epic', emoji: '🌌', name: 'Star Seer', price: 2600, desc: 'Epic skin bercahaya bintang untuk Seer.', className: 'skin-mystic' },
  { id: 'skin_emerald_guardian', type: 'skin', rarity: 'rare', emoji: '🟢', name: 'Emerald Guardian', price: 1500, desc: 'Rare skin hijau untuk pelindung desa.', className: 'skin-neon' },
  { id: 'frame_dragon_flame', type: 'frame', rarity: 'legendary', emoji: '🐉', name: 'Dragon Flame Frame', price: 3900, desc: 'Legendary frame api naga di foto profil.', className: 'frame-wolf' },
  { id: 'frame_void_crystal', type: 'frame', rarity: 'epic', emoji: '💠', name: 'Void Crystal Frame', price: 2700, desc: 'Epic frame kristal void.', className: 'frame-crystal' },
  { id: 'badge_crate_legend', type: 'badge', rarity: 'legendary', emoji: '💫', name: 'Crate Legend', price: 3200, desc: 'Badge pemain beruntung dari crate.' },
  { id: 'badge_epic_luck', type: 'badge', rarity: 'epic', emoji: '✨', name: 'Epic Luck', price: 2100, desc: 'Badge epic untuk pembuka crate.' },
  { id: 'badge_village_vip', type: 'badge', rarity: 'rare', emoji: '🎖️', name: 'Village VIP', price: 1200, desc: 'Badge rare untuk warga ternama.' }
);

const RARITY_META = {
  common: { label: 'Common', emoji: '⚪', color: '#94a3b8' },
  rare: { label: 'Rare', emoji: '🔵', color: '#38bdf8' },
  epic: { label: 'Epic', emoji: '🟣', color: '#c084fc' },
  legendary: { label: 'Legendary', emoji: '🟡', color: '#facc15' },
  mythic: { label: 'Mythic', emoji: '🔴', color: '#fb7185' }
};

const CRATE_DEFS = [
  {
    id: 'crate_moon', emoji: '🌙', name: 'Moon Crate', price: 450,
    desc: 'Crate murah berisi poin, power kecil, badge, dan rare cosmetic.',
    weights: { common: 62, rare: 27, epic: 9, legendary: 2, mythic: 0 },
    rewards: [
      { rarity: 'common', type: 'points', amount: 120, name: '120 Poin' },
      { rarity: 'common', type: 'item', itemId: 'power_vote_triple', qty: 1 },
      { rarity: 'common', type: 'item', itemId: 'power_seer_double', qty: 1 },
      { rarity: 'rare', type: 'item', itemId: 'badge_village_vip', qty: 1 },
      { rarity: 'rare', type: 'item', itemId: 'skin_emerald_guardian', qty: 1 },
      { rarity: 'epic', type: 'item', itemId: 'badge_epic_luck', qty: 1 },
      { rarity: 'epic', type: 'item', itemId: 'frame_void_crystal', qty: 1 },
      { rarity: 'legendary', type: 'item', itemId: 'badge_crate_legend', qty: 1 }
    ]
  },
  {
    id: 'crate_blood', emoji: '🩸', name: 'Blood Moon Crate', price: 1300,
    desc: 'Crate premium dengan peluang Epic dan Legendary lebih besar.',
    weights: { common: 32, rare: 38, epic: 22, legendary: 7, mythic: 1 },
    rewards: [
      { rarity: 'common', type: 'points', amount: 350, name: '350 Poin' },
      { rarity: 'rare', type: 'item', itemId: 'power_wolf_double', qty: 1 },
      { rarity: 'rare', type: 'item', itemId: 'power_doctor_double', qty: 1 },
      { rarity: 'rare', type: 'item', itemId: 'frame_gold', qty: 1 },
      { rarity: 'epic', type: 'item', itemId: 'skin_star_seer', qty: 1 },
      { rarity: 'epic', type: 'item', itemId: 'frame_void_crystal', qty: 1 },
      { rarity: 'legendary', type: 'item', itemId: 'skin_abyss_king', qty: 1 },
      { rarity: 'legendary', type: 'item', itemId: 'frame_dragon_flame', qty: 1 },
      { rarity: 'mythic', type: 'points', amount: 5000, name: 'Jackpot 5000 Poin' }
    ]
  },
  {
    id: 'crate_royal', emoji: '👑', name: 'Royal Legend Crate', price: 2800,
    desc: 'Crate mahal untuk pemburu Legendary/Mythic. Hadiah kosmetik dan power item terbaik.',
    weights: { common: 10, rare: 30, epic: 36, legendary: 20, mythic: 4 },
    rewards: [
      { rarity: 'rare', type: 'item', itemId: 'power_lucky_charm', qty: 1 },
      { rarity: 'rare', type: 'item', itemId: 'power_shadow_cloak', qty: 1 },
      { rarity: 'epic', type: 'item', itemId: 'power_witch_dual', qty: 2 },
      { rarity: 'epic', type: 'item', itemId: 'skin_star_seer', qty: 1 },
      { rarity: 'epic', type: 'item', itemId: 'badge_mastermind', qty: 1 },
      { rarity: 'legendary', type: 'item', itemId: 'skin_abyss_king', qty: 1 },
      { rarity: 'legendary', type: 'item', itemId: 'frame_dragon_flame', qty: 1 },
      { rarity: 'legendary', type: 'item', itemId: 'badge_crate_legend', qty: 1 },
      { rarity: 'mythic', type: 'points', amount: 12000, name: 'Mythic Jackpot 12000 Poin' }
    ]
  }
];

const SHOP_BY_ID = new Map(SHOP_ITEMS.map(item => [item.id, item]));
const authSessions = new Map(); // socket.id -> usernameKey
let db = loadDb();
const ADMIN_USERNAME = 'ryuu';
const ADMIN_PIN = '291206';
const ADMIN_POINTS = 999999999;
ensureAdminUser();
let saveTimer = null;

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return { users: parsed.users || {} };
    }
  } catch (error) {
    console.error('[DB] Gagal baca database pemain:', error.message);
  }
  return { users: {} };
}
function saveDbSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
    catch (error) { console.error('[DB] Gagal simpan database pemain:', error.message); }
  }, 250);
}
function cleanUsername(username) {
  return String(username || '').replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ').slice(0, 18);
}
function usernameKey(username) { return cleanUsername(username).toLowerCase(); }
function pinHash(pin, salt) {
  return crypto.createHash('sha256').update(`${salt}:${String(pin || '')}`).digest('hex');
}
function validPin(pin) { return /^\d{4,8}$/.test(String(pin || '')); }
function createStats() {
  return {
    games: 0, wins: 0, losses: 0, winStreak: 0, bestStreak: 0,
    teamWins: { werewolf: 0, village: 0, jester: 0 },
    teamGames: { werewolf: 0, village: 0, jester: 0 },
    roleWins: {}, roleGames: {},
    kills: 0, scans: 0, protects: 0, votesCast: 0, mayorWins: 0, mvp: 0
  };
}
function createUser(username, pin, avatar = '') {
  const salt = crypto.randomBytes(12).toString('hex');
  return {
    username: cleanUsername(username),
    pinHash: pinHash(pin, salt), salt,
    avatar: sanitizeAvatar(avatar) || '',
    points: 500,
    inventory: { badge_founder: 1 },
    equipped: { skin: null, frame: null, badge: 'badge_founder', power: null },
    stats: createStats(),
    friends: {},
    friendRequests: {},
    sentFriendRequests: {},
    roomInvites: [],
    cratesOpened: 0,
    createdAt: Date.now(), updatedAt: Date.now(), lastLoginAt: Date.now()
  };
}

function ensureAdminUser() {
  const key = usernameKey(ADMIN_USERNAME);
  const existing = db.users[key];
  if (existing) {
    existing.username = ADMIN_USERNAME;
    existing.isAdmin = true;
    existing.points = ADMIN_POINTS;
    existing.inventory = existing.inventory || {};
    for (const item of SHOP_ITEMS) existing.inventory[item.id] = item.type === 'power' ? 99 : 1;
    existing.equipped = existing.equipped || { skin: null, frame: null, badge: null, power: null };
    existing.updatedAt = Date.now();
    // Reset the PIN to the requested owner PIN so the owner account is always recoverable.
    existing.pinHash = pinHash(ADMIN_PIN, existing.salt || (existing.salt = crypto.randomBytes(12).toString('hex')));
  } else {
    const admin = createUser(ADMIN_USERNAME, ADMIN_PIN, '');
    admin.isAdmin = true;
    admin.points = ADMIN_POINTS;
    for (const item of SHOP_ITEMS) admin.inventory[item.id] = item.type === 'power' ? 99 : 1;
    admin.equipped = { skin: 'skin_blood_moon', frame: 'frame_gold', badge: 'badge_founder', power: 'power_vote_triple' };
    db.users[key] = admin;
  }
  try { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); } catch (error) { console.error('[DB] Gagal seed akun owner:', error.message); }
}

function sanitizeAvatar(data) {
  const raw = String(data || '');
  if (!raw) return '';
  if (!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(raw)) return '';
  if (raw.length > 420000) return '';
  return raw;
}
function getUserByKey(key) { return db.users[String(key || '').toLowerCase()] || null; }
function publicProfile(user) {
  if (!user) return null;
  normalizeUser(user);
  validateEquippedPower(user);
  const inv = user.inventory || {};
  return {
    username: user.username,
    avatar: user.avatar || `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(user.username)}`,
    points: user.isAdmin ? ADMIN_POINTS : Number(user.points || 0),
    isAdmin: !!user.isAdmin,
    displayPoints: user.isAdmin ? '∞' : String(Number(user.points || 0)),
    inventory: inv,
    equipped: user.equipped || {},
    stats: user.stats || createStats(),
    cratesOpened: Number(user.cratesOpened || 0),
    friendsCount: Object.keys(user.friends || {}).length,
    pendingRequests: Object.keys(user.friendRequests || {}).length,
    pendingInvites: (user.roomInvites || []).length,
    ownedCount: Object.keys(inv).length
  };
}
function publicShop() { return SHOP_ITEMS; }
function publicCrates() { return CRATE_DEFS.map(c => ({ id: c.id, emoji: c.emoji, name: c.name, price: c.price, desc: c.desc, weights: c.weights })); }
function normalizeUser(user) {
  if (!user) return null;
  user.inventory = user.inventory || {};
  user.equipped = user.equipped || {};
  user.stats = user.stats || createStats();
  user.friends = user.friends || {};
  user.friendRequests = user.friendRequests || {};
  user.sentFriendRequests = user.sentFriendRequests || {};
  user.roomInvites = Array.isArray(user.roomInvites) ? user.roomInvites.slice(-20) : [];
  user.cratesOpened = Number(user.cratesOpened || 0);
  return user;
}
function isUserOnline(key) {
  const k = String(key || '').toLowerCase();
  for (const sessionKey of authSessions.values()) if (String(sessionKey || '').toLowerCase() === k) return true;
  return false;
}
function emitToAccount(key, event, payload) {
  const k = String(key || '').toLowerCase();
  for (const [socketId, sessionKey] of authSessions.entries()) {
    if (String(sessionKey || '').toLowerCase() === k) io.to(socketId).emit(event, payload);
  }
}
function publicSocial(user) {
  normalizeUser(user);
  if (!user) return { friends: [], requests: [], sent: [], roomInvites: [] };
  const friends = Object.keys(user.friends || {}).map(key => { const u = getUserByKey(key); return u ? { username: u.username, avatar: u.avatar || '', online: isUserOnline(key), since: user.friends[key] } : null; }).filter(Boolean);
  const requests = Object.keys(user.friendRequests || {}).map(key => { const u = getUserByKey(key); return u ? { username: u.username, avatar: u.avatar || '', at: user.friendRequests[key] } : null; }).filter(Boolean);
  const sent = Object.keys(user.sentFriendRequests || {}).map(key => { const u = getUserByKey(key); return u ? { username: u.username, avatar: u.avatar || '', at: user.sentFriendRequests[key] } : null; }).filter(Boolean);
  const roomInvites = (user.roomInvites || []).slice(-10).reverse();
  return { friends, requests, sent, roomInvites };
}
function isPowerItem(itemId) { return SHOP_BY_ID.get(String(itemId || ''))?.type === 'power'; }
function hasOwned(user, itemId) { return Number(user?.inventory?.[itemId] || 0) > 0; }
function getItemCount(user, itemId) { return Number(user?.inventory?.[itemId] || 0); }
function equippedItem(user, type) { return user?.equipped?.[type] || null; }
function profileForAccount(accountKey) { return accountKey ? getUserByKey(accountKey) : null; }
function hasPower(player, id) { return hasActivePower(player, id); }
function hasActivePower(player, id) {
  if (!player || player.powerConsumed || player.power !== id) return false;
  const user = profileForAccount(player.accountKey);
  if (!user) return false;
  return !!user.isAdmin || getItemCount(user, id) > 0;
}
function validateEquippedPower(user) {
  if (!user?.equipped?.power) return;
  if (!SHOP_BY_ID.has(user.equipped.power) || !hasOwned(user, user.equipped.power)) user.equipped.power = null;
}
function consumePowerItem(player, id, room, label = 'Power Item') {
  if (!hasActivePower(player, id)) return false;
  const user = profileForAccount(player.accountKey);
  if (!user) return false;
  if (!user.isAdmin) {
    user.inventory[id] = Math.max(0, Number(user.inventory?.[id] || 0) - 1);
    if (user.inventory[id] <= 0) {
      delete user.inventory[id];
      if (user.equipped?.power === id) user.equipped.power = null;
    }
  }
  player.powerConsumed = true;
  player.power = null;
  player.consumedPowerId = id;
  user.updatedAt = Date.now();
  saveDbSoon();
  notifyProfile(player.socketId || player.id, player.accountKey);
  personalAnim(player.id, 'powerItem', 'Item Terpakai', `${label} dipakai dan stoknya berkurang 1.`, { aura: 'amber' });
  if (room) addLog(room, `${player.name} memakai item ${SHOP_BY_ID.get(id)?.name || id}.`, 'power');
  return true;
}
function canEquipPower(user, itemId) {
  const item = SHOP_BY_ID.get(String(itemId || ''));
  if (!item || item.type !== 'power') return false;
  return !!user?.isAdmin || Number(user?.inventory?.[itemId] || 0) > 0;
}
function applyProfileToPlayer(p) {
  const user = profileForAccount(p.accountKey);
  if (!user) return;
  p.name = user.username;
  p.avatar = user.avatar || `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(user.username)}`;
  p.skin = user.equipped?.skin || null;
  p.frame = user.equipped?.frame || null;
  p.badge = user.equipped?.badge || null;
  validateEquippedPower(user);
  // Jangan reset konsumsi power di tengah game. Power hanya di-refresh penuh saat start game baru.
  if (!p.role || !p.powerConsumed) p.power = user.equipped?.power || null;
  if (typeof p.powerConsumed === 'undefined') p.powerConsumed = false;
  if (typeof p.consumedPowerId === 'undefined') p.consumedPowerId = null;
}
function notifyProfile(socketOrId, key) {
  const user = getUserByKey(key);
  if (!user) return;
  normalizeUser(user);
  const payload = { profile: publicProfile(user), shop: publicShop(), crates: publicCrates(), social: publicSocial(user), leaderboards: buildLeaderboards() };
  if (typeof socketOrId === 'string') io.to(socketOrId).emit('profile:update', payload);
  else socketOrId.emit('profile:update', payload);
}
function buildLeaderboards() {
  const users = Object.values(db.users || {});
  const base = (u) => ({ username: u.username, avatar: u.avatar || '', points: u.points || 0, equipped: u.equipped || {}, stats: u.stats || createStats() });
  const top = (fn) => users.map(base).sort(fn).slice(0, 100);
  return {
    points: top((a,b) => b.points - a.points || (b.stats.wins||0) - (a.stats.wins||0)),
    overall: top((a,b) => (b.stats.wins||0) - (a.stats.wins||0) || b.points - a.points),
    werewolf: top((a,b) => ((b.stats.teamWins?.werewolf)||0) - ((a.stats.teamWins?.werewolf)||0) || b.points - a.points),
    village: top((a,b) => ((b.stats.teamWins?.village)||0) - ((a.stats.teamWins?.village)||0) || b.points - a.points),
    seer: top((a,b) => ((b.stats.roleWins?.Seer)||0) - ((a.stats.roleWins?.Seer)||0) || (b.stats.scans||0) - (a.stats.scans||0)),
    doctor: top((a,b) => ((b.stats.roleWins?.Doctor)||0) - ((a.stats.roleWins?.Doctor)||0) || (b.stats.protects||0) - (a.stats.protects||0))
  };
}
function defaultRoundStats() { return { scans: 0, protects: 0, killsAttempted: 0, kills: 0, votesCast: 0, savedByCharm: 0 }; }
function grantPoints(user, amount, reason) {
  if (user?.isAdmin) {
    user.points = ADMIN_POINTS;
    user.updatedAt = Date.now();
    return { amount: 0, reason: 'Admin unlimited points' };
  }
  user.points = Math.max(0, Number(user.points || 0) + amount);
  user.updatedAt = Date.now();
  return { amount, reason };
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 30000
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, name: 'werewolf-by-ryuu', version: '3.4.0-cinematic-crates-modern-assets' }));

app.get('/api/music/youtube', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 120);
  if (!q) return res.status(400).json({ ok: false, error: 'Query kosong.' });
  try {
    const result = await yts(q);
    const videos = (result.videos || [])
      .filter(v => v.videoId && !v.isLive)
      .slice(0, 18)
      .map(v => ({
        id: v.videoId,
        videoId: v.videoId,
        title: v.title || 'YouTube Video',
        artist: v.author?.name || 'YouTube',
        duration: v.timestamp || '',
        views: v.views || 0,
        thumbnail: v.thumbnail || '',
        url: v.url || `https://www.youtube.com/watch?v=${v.videoId}`
      }));
    res.json({ ok: true, query: q, results: videos });
  } catch (error) {
    console.error('[YouTube Search Error]', error?.message || error);
    res.status(500).json({ ok: false, error: 'Gagal mencari lagu YouTube.' });
  }
});


const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const rooms = new Map();
const socketIndex = new Map(); // socket.id -> { code, playerId }
const RECONNECT_TTL_MS = 1000 * 60 * 30;

const ROLE_META = {
  'Alpha Werewolf': {
    team: 'werewolf', emoji: '🐺👑', aura: 'blood',
    desc: 'Pemimpin werewolf. Saat malam ikut memilih korban bersama Werewolf.'
  },
  Werewolf: {
    team: 'werewolf', emoji: '🐺', aura: 'blood',
    desc: 'Saat malam pilih korban bersama tim Werewolf. Menang jika jumlah werewolf >= warga hidup.'
  },
  Villager: {
    team: 'village', emoji: '🌾', aura: 'sun',
    desc: 'Tidak punya skill malam, tapi kuat di diskusi dan voting.'
  },
  Seer: {
    team: 'village', emoji: '🔮', aura: 'violet',
    desc: 'Setiap malam bisa menerawang satu pemain untuk melihat role/team.'
  },
  Doctor: {
    team: 'village', emoji: '💉', aura: 'green',
    desc: 'Setiap malam bisa melindungi satu pemain dari serangan.'
  },
  Hunter: {
    team: 'village', emoji: '🏹', aura: 'amber',
    desc: 'Jika mati karena voting atau dibunuh, dapat kesempatan menembak satu pemain.'
  },
  Bodyguard: {
    team: 'village', emoji: '🛡️', aura: 'blue',
    desc: 'Setiap malam bisa menjaga satu pemain. Jika target diserang, Bodyguard yang berkorban.'
  },
  Witch: {
    team: 'village', emoji: '🧪', aura: 'green',
    desc: 'Punya satu ramuan heal dan satu ramuan poison untuk dipakai saat malam.'
  },
  Medium: {
    team: 'village', emoji: '🕯️', aura: 'violet',
    desc: 'Bisa membaca chat pemain mati dan membantu warga dari informasi arwah.'
  },
  Jester: {
    team: 'jester', emoji: '🃏', aura: 'pink',
    desc: 'Tujuan rahasia: menang sendiri jika berhasil dieliminasi lewat voting.'
  },
  'Cursed Villager': {
    team: 'village', emoji: '🌘', aura: 'blood',
    desc: 'Warga terkutuk. Jika dimangsa Werewolf, tidak langsung mati dan berubah menjadi Werewolf sekali.'
  },
  Prince: {
    team: 'village', emoji: '👑', aura: 'amber',
    desc: 'Punya perlindungan bangsawan: sekali saja selamat dari eliminasi voting dan role-nya terbuka.'
  },
  Priest: {
    team: 'village', emoji: '⛪', aura: 'blue',
    desc: 'Sekali per game bisa memberi Holy Shield kepada satu pemain saat malam.'
  },
  Lycan: {
    team: 'village', emoji: '🐺🌾', aura: 'blood',
    desc: 'Warga yang terlihat seperti Werewolf jika diterawang Seer.'
  },
  Sorcerer: {
    team: 'werewolf', emoji: '🧙‍♂️', aura: 'violet',
    desc: 'Tim Werewolf tanpa gigitan kuat, bisa ikut chat/strategi Werewolf dan menang bersama Werewolf.'
  },
  'Tough Guy': {
    team: 'village', emoji: '💪', aura: 'amber',
    desc: 'Warga keras kepala dengan mental kuat. Tidak punya aksi aktif, tapi cocok untuk bluffing.'
  }
};

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function nowId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cleanRoomName(name) {
  const n = String(name || '').replace(/<[^>]*>/g, '').trim();
  return n.slice(0, 28) || 'Lobby Werewolf';
}

function cleanPassword(password) {
  return String(password || '').trim().slice(0, 64);
}

function hashPassword(password) {
  const pass = cleanPassword(password);
  if (!pass) return null;
  return crypto.createHash('sha256').update(pass).digest('hex');
}

function verifyRoomPassword(room, password) {
  if (!room?.passwordHash) return true;
  return hashPassword(password) === room.passwordHash;
}

function roomSummary(room) {
  const players = [...room.players.values()];
  const connected = players.filter(p => p.connected).length;
  const alive = players.filter(p => p.alive).length;
  return {
    code: room.code,
    name: room.name || 'Lobby Werewolf',
    phase: room.phase,
    gameStarted: !!room.gameStarted,
    day: room.day || 0,
    playerCount: players.length,
    connectedCount: connected,
    aliveCount: alive,
    maxPlayers: room.maxPlayers || 16,
    hasPassword: !!room.passwordHash,
    hostName: room.players.get(room.hostId)?.name || 'Host',
    createdAt: room.createdAt,
    updatedAt: room.updatedAt || room.createdAt
  };
}

function getPublicRooms() {
  return [...rooms.values()]
    .filter(room => room.phase === 'lobby' && !room.gameStarted)
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 50)
    .map(roomSummary);
}

function emitRoomList() {
  io.emit('rooms:list', getPublicRooms());
}

function publicMusic(music = {}) {
  return {
    status: music.status || 'stopped',
    song: music.song || null,
    startedAt: music.startedAt || null,
    positionSec: Number(music.positionSec || 0),
    updatedAt: music.updatedAt || Date.now(),
    by: music.by || null
  };
}

function sanitizeMusicSong(song = {}) {
  const source = String(song.source || '').slice(0, 20);
  const allowed = new Set(['youtube', 'online', 'radio']);
  if (!allowed.has(source)) return null;
  const safe = {
    source,
    id: String(song.id || song.videoId || song.url || '').slice(0, 160),
    emoji: String(song.emoji || (source === 'youtube' ? '▶' : '🎵')).slice(0, 4),
    title: String(song.title || 'Unknown Song').replace(/<[^>]*>/g, '').trim().slice(0, 120),
    artist: String(song.artist || source).replace(/<[^>]*>/g, '').trim().slice(0, 90),
    mood: String(song.mood || '').replace(/<[^>]*>/g, '').trim().slice(0, 120),
    duration: String(song.duration || '').slice(0, 20),
    thumbnail: String(song.thumbnail || '').slice(0, 300)
  };
  if (source === 'youtube') {
    const videoId = String(song.videoId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
    if (!videoId) return null;
    safe.videoId = videoId;
    safe.watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    return safe;
  }
  if (source === 'online' || source === 'radio') {
    const url = String(song.url || '');
    if (!/^https?:\/\//i.test(url)) return null;
    safe.url = url.slice(0, 600);
    return safe;
  }
  return null;
}

function emitRoomMusic(room) {
  io.to(room.code).emit('music:room-state', publicMusic(room.music));
}

function setRoomMusic(room, music) {
  room.music = {
    status: music.status || 'stopped',
    song: music.song || null,
    startedAt: music.startedAt || null,
    positionSec: Number(music.positionSec || 0),
    updatedAt: Date.now(),
    by: music.by || null
  };
  emitRoomMusic(room);
  saveRoomsSoon();
}

function cleanClientId(id) {
  const raw = String(id || '').trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return safe || `p_${nowId()}`;
}

function cleanName(name) {
  const n = String(name || '').replace(/<[^>]*>/g, '').trim();
  return n.slice(0, 18) || 'Player';
}

function newRoom(code, hostPlayerId, hostName, options = {}) {
  return {
    code,
    name: cleanRoomName(options.roomName || `${cleanName(hostName)}'s Room`),
    passwordHash: hashPassword(options.password || ''),
    maxPlayers: 16,
    hostId: hostPlayerId,
    phase: 'lobby',
    gameStarted: false,
    roundId: null,
    day: 0,
    timer: null,
    autoResetTimer: null,
    phaseEndsAt: null,
    settings: {
      roleRevealSec: 10,
      mayorVoteSec: 45,
      nightSec: 70,
      daySec: 120,
      voteSec: 50,
      hunterSec: 35
    },
    players: new Map(),
    logs: [],
    nightActions: new Map(),
    votes: new Map(),
    mayorVotes: new Map(),
    mayorResolved: false,
    voice: new Set(),
    invitedAccounts: new Set(),
    music: {
      status: 'stopped',
      song: null,
      startedAt: null,
      positionSec: 0,
      updatedAt: Date.now(),
      by: null
    },
    hunterQueue: [],
    hunterNext: null,
    gameOver: null,
    nightEvent: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastEmptyAt: null
  };
}

function playerPublic(room, p) {
  return {
    id: p.id,
    name: p.name,
    alive: p.alive,
    connected: p.connected,
    isHost: p.id === room.hostId,
    isMayor: !!p.isMayor,
    voice: room.voice.has(p.id),
    revealedRole: room.phase === 'gameOver' ? p.role : (p.publicRole || null),
    avatar: p.avatar,
    accountName: p.accountKey || null,
    skin: p.skin || null,
    frame: p.frame || null,
    badge: p.badge || null,
    power: p.power || null
  };
}

function roomPublic(room) {
  return {
    code: room.code,
    name: room.name || 'Lobby Werewolf',
    hasPassword: !!room.passwordHash,
    maxPlayers: room.maxPlayers || 16,
    phase: room.phase,
    gameStarted: !!room.gameStarted,
    day: room.day,
    settings: room.settings,
    phaseEndsAt: room.phaseEndsAt,
    players: [...room.players.values()].map(p => playerPublic(room, p)),
    logs: room.logs.slice(-60),
    voteState: getVoteState(room),
    mayorState: getMayorVoteState(room),
    gameOver: room.gameOver,
    autoResetAt: room.autoResetAt || null,
    nightEvent: room.nightEvent || null,
    music: publicMusic(room.music)
  };
}

function privateState(room, id) {
  const p = room.players.get(id);
  if (!p) return null;
  // Hard guard: role must NEVER leak before the host starts the game.
  // Some restored/persisted rooms can still have old role values in player objects;
  // the client must only receive role data after gameStarted is true and phase is not lobby.
  const roleVisible = !!(room.gameStarted && room.phase !== 'lobby' && p.role);
  const visibleRole = roleVisible ? p.role : null;
  return {
    id: p.id,
    name: p.name,
    role: visibleRole,
    roleMeta: visibleRole ? ROLE_META[visibleRole] : null,
    alive: p.alive,
    isHost: p.id === room.hostId,
    isMayor: !!p.isMayor,
    witchHealUsed: roleVisible ? !!p.witchHealUsed : false,
    witchPoisonUsed: roleVisible ? !!p.witchPoisonUsed : false,
    priestBlessUsed: roleVisible ? !!p.priestBlessUsed : false,
    princeShieldUsed: roleVisible ? !!p.princeShieldUsed : false,
    cursedTurned: roleVisible ? !!p.cursedTurned : false,
    lastInfo: roleVisible ? (p.lastInfo || '') : '',
    actionDone: roleVisible ? [...room.nightActions.values()].some(a => a.actor === p.id) : false,
    wolfTeamIds: ROLE_META[visibleRole]?.team === 'werewolf' ? [...room.players.values()].filter(x => x.alive && ROLE_META[x.role]?.team === 'werewolf').map(x => x.id) : [],
    nightEvent: roleVisible ? (room.nightEvent || null) : null,
    voteTarget: room.votes.get(p.id) || null,
    mayorVoteTarget: room.mayorVotes.get(p.id) || null,
    profile: publicProfile(profileForAccount(p.accountKey)),
    equippedPower: p.power || null,
    remainingActions: roleVisible ? remainingNightActions(room, p) : {},
    actionLimits: roleVisible ? getActionLimits(room, p) : {},
    voteWeight: voteWeight(p, room)
  };
}

function sendState(room) {
  sanitizeLobbyState(room);
  room.updatedAt = Date.now();
  io.to(room.code).emit('room:state', roomPublic(room));
  for (const p of room.players.values()) {
    io.to(p.id).emit('me:state', privateState(room, p.id));
  }
  emitRoomList();
  saveRoomsSoon();
}

function addLog(room, text, type = 'info') {
  room.logs.push({ id: nowId(), text, type, at: Date.now() });
  if (room.logs.length > 100) room.logs.shift();
  io.to(room.code).emit('room:log', room.logs[room.logs.length - 1]);
  saveRoomsSoon();
}

function narrative(room, title, text, mood = 'dark') {
  const payload = { title, text, mood, at: Date.now() };
  io.to(room.code).emit('game:narrative', payload);
  addLog(room, `${title}: ${text}`, mood);
}

function personalAnim(playerId, type, title, text, extra = {}) {
  io.to(playerId).emit('game:animation', { type, title, text, ...extra, at: Date.now() });
}

function roomAnim(room, type, title, text, extra = {}) {
  io.to(room.code).emit('game:animation', { type, title, text, ...extra, at: Date.now() });
}

function clearRoomTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.phaseEndsAt = null;
}

function clearAutoResetTimer(room) {
  if (room.autoResetTimer) clearTimeout(room.autoResetTimer);
  room.autoResetTimer = null;
  room.autoResetAt = null;
}

function alivePlayers(room) {
  return [...room.players.values()].filter(p => p.alive);
}

function allAliveMayorVotesSubmitted(room) {
  if (!room || room.phase !== 'mayorVote' || room.mayorResolved) return false;
  const alive = alivePlayers(room);
  if (!alive.length) return false;
  return alive.every(p => room.mayorVotes && room.mayorVotes.has(p.id));
}

function scheduleMayorVoteWatchdog(room, delay = 250) {
  if (!room || room.phase !== 'mayorVote' || room.mayorResolved) return;
  setTimeout(() => {
    if (rooms.has(room.code) && allAliveMayorVotesSubmitted(room)) resolveMayorVote(room);
  }, delay);
}

function aliveByTeam(room, team) {
  return alivePlayers(room).filter(p => ROLE_META[p.role]?.team === team);
}

function nonWolvesAlive(room) {
  return alivePlayers(room).filter(p => ROLE_META[p.role]?.team !== 'werewolf');
}

function setPhase(room, phase, seconds, onEnd) {
  clearRoomTimer(room);
  room.phase = phase;
  room.phaseEndsAt = Date.now() + seconds * 1000;
  if (phase === 'mayorVote') room.mayorResolved = false;
  sendState(room);
  if (phase === 'mayorVote') scheduleMayorVoteWatchdog(room, 650);
  room.timer = setTimeout(() => {
    room.timer = null;
    if (rooms.has(room.code) && room.phase === phase) onEnd?.();
  }, seconds * 1000);
}

function roleDeckFor(count) {
  const wolves = count >= 12 ? 3 : count >= 7 ? 2 : 1;
  const deck = [];
  if (wolves >= 1) deck.push('Alpha Werewolf');
  for (let i = 1; i < wolves; i++) deck.push('Werewolf');

  const specials = ['Seer', 'Doctor'];
  if (count >= 5) specials.push('Hunter');
  if (count >= 6) specials.push('Bodyguard');
  if (count >= 7) specials.push('Jester');
  if (count >= 8) specials.push('Witch');
  if (count >= 9) specials.push('Medium');
  if (count >= 10) specials.push('Cursed Villager');
  if (count >= 11) specials.push('Prince');
  if (count >= 12) specials.push('Priest');
  if (count >= 13) specials.push('Lycan');
  if (count >= 14) specials.push('Sorcerer');
  if (count >= 15) specials.push('Tough Guy');

  for (const role of specials) {
    if (deck.length < count) deck.push(role);
  }
  while (deck.length < count) deck.push('Villager');
  return shuffle(deck).slice(0, count);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    // Use crypto-backed randomness so role distribution is less predictable than Math.random().
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startGame(room) {
  clearAutoResetTimer(room);
  const players = [...room.players.values()].filter(p => p.connected);
  if (players.length < 4) {
    addLog(room, 'Minimal 4 pemain untuk mulai.', 'warn');
    return;
  }
  clearRoomTimer(room);
  room.gameStarted = true;
  room.roundId = nowId();
  room.day = 0;
  room.logs = [];
  room.nightActions.clear();
  room.votes.clear();
  room.mayorVotes.clear();
  room.mayorResolved = false;
  room.hunterQueue = [];
  room.hunterNext = null;
  room.gameOver = null;
  room.rewardsGranted = false;
  for (const p of room.players.values()) {
    clearPlayerRoundRoleState(p, false);
    p.alive = p.connected;
  }
  room.nightEvent = null;
  const deck = roleDeckFor(players.length);
  shuffle(players).forEach((p, i) => {
    p.role = deck[i];
    p.alive = true;
    const meta = ROLE_META[p.role];
    personalAnim(p.id, 'roleReveal', `${meta.emoji} Kamu adalah ${p.role}`, meta.desc, { role: p.role, aura: meta.aura });
  });
  narrative(room, 'Takdir Dibagikan', 'Setiap pemain telah menerima role rahasia. Ingat: kepercayaan adalah senjata, kebohongan adalah racun.', 'violet');
  setPhase(room, 'roleReveal', room.settings.roleRevealSec, () => startMayorVote(room));
}

function startMayorVote(room) {
  clearRoomTimer(room);
  if (!rooms.has(room.code) || room.phase === 'gameOver') return;
  if (!room.gameStarted) {
    room.phase = 'lobby';
    room.mayorVotes.clear();
    room.mayorResolved = false;
    addLog(room, 'Vote Kades dibatalkan karena game belum dimulai.', 'warn');
    sendState(room);
    return;
  }
  room.mayorVotes.clear();
  room.mayorResolved = false;
  narrative(room, 'Pemilihan Kepala Desa', 'Semua pemain hidup memilih Kades. Saat voting eliminasi, suara Kades bernilai 2.', 'amber');
  setPhase(room, 'mayorVote', room.settings.mayorVoteSec, () => resolveMayorVote(room));
}

function getMayorVoteState(room) {
  const counts = {};
  for (const targetId of room.mayorVotes.values()) counts[targetId] = (counts[targetId] || 0) + 1;
  return { counts, total: room.mayorVotes.size };
}

function resolveMayorVote(room) {
  if (!room || room.mayorResolved || room.phase !== 'mayorVote') return;
  if (!room.gameStarted) {
    room.phase = 'lobby';
    room.mayorVotes.clear();
    room.mayorResolved = false;
    sendState(room);
    return;
  }
  room.mayorResolved = true;
  clearRoomTimer(room);
  const alive = alivePlayers(room);
  if (!alive.length) return;
  const counts = new Map();
  for (const [voter, target] of room.mayorVotes.entries()) {
    const vp = room.players.get(voter);
    const tp = room.players.get(target);
    if (vp?.alive && tp?.alive) counts.set(target, (counts.get(target) || 0) + 1);
  }
  let chosen = null;
  let high = -1;
  const randomized = shuffle(alive.map(p => p.id));
  for (const id of randomized) {
    const c = counts.get(id) || 0;
    if (c > high) { high = c; chosen = id; }
  }
  for (const p of room.players.values()) p.isMayor = false;
  const mayor = room.players.get(chosen || alive[0].id);
  if (mayor) {
    mayor.isMayor = true;
    roomAnim(room, 'mayor', 'Kepala Desa Terpilih', `${mayor.name} menjadi Kades. Suaranya bernilai 2 saat voting.`, { targetId: mayor.id });
    personalAnim(mayor.id, 'mayor', 'Kamu Menjadi Kades', 'Suaramu sekarang bernilai 2 saat voting eliminasi.', { aura: 'amber' });
    addLog(room, `${mayor.name} terpilih menjadi Kepala Desa.`, 'mayor');
  }
  startNight(room);
}


function rollNightEvent(day) {
  if (day <= 1) return null;
  const r = Math.random();
  if (r < 0.18) return { id: 'mist', emoji: '🌫️', name: 'Kabut Tebal', desc: 'Seer hanya melihat tim, bukan role detail, pada malam ini.' };
  if (r < 0.32) return { id: 'bloodMoon', emoji: '🩸', name: 'Blood Moon', desc: 'Serangan Werewolf menembus perlindungan biasa Doctor. Holy Shield, Witch, dan Bodyguard tetap kuat.' };
  if (r < 0.46) return { id: 'holyNight', emoji: '✨', name: 'Holy Night', desc: 'Kekuatan desa akan menyelamatkan satu korban pertama malam ini.' };
  return null;
}


function countActorActions(room, actorId, type = null) {
  return [...room.nightActions.values()].filter(a => a.actor === actorId && (!type || a.type === type)).length;
}
function hasActorTargeted(room, actorId, type, targetId) {
  return [...room.nightActions.values()].some(a => a.actor === actorId && a.type === type && a.target === targetId);
}
function getActionLimits(room, p) {
  if (!p?.alive || room.phase !== 'night') return {};
  const limits = {};
  if (['Werewolf','Alpha Werewolf','Sorcerer'].includes(p.role)) limits.kill = (hasPower(p, 'power_wolf_double') || p.wolfDoubleDay === room.day) ? 2 : 1;
  if (p.role === 'Seer') limits.scan = hasPower(p, 'power_seer_double') ? 2 : 1;
  if (p.role === 'Doctor') limits.protect = hasPower(p, 'power_doctor_double') ? 2 : 1;
  if (p.role === 'Bodyguard') limits.guard = hasPower(p, 'power_bodyguard_double') ? 2 : 1;
  if (p.role === 'Priest' && !p.priestBlessUsed) limits.bless = 1;
  if (p.role === 'Witch') {
    const maxWitchPerNight = hasPower(p, 'power_witch_dual') ? 2 : 1;
    if (!p.witchHealUsed) limits.witchHeal = maxWitchPerNight;
    if (!p.witchPoisonUsed) limits.witchPoison = maxWitchPerNight;
  }
  return limits;
}
function remainingNightActions(room, p) {
  const limits = getActionLimits(room, p);
  let remaining = 0;
  if (p.role === 'Witch') {
    const usedTotal = countActorActions(room, p.id);
    const maxTotal = hasPower(p, 'power_witch_dual') ? 2 : 1;
    const possible = Object.keys(limits).length;
    remaining = Math.max(0, Math.min(maxTotal - usedTotal, possible));
  } else {
    for (const [type, limit] of Object.entries(limits)) remaining += Math.max(0, limit - countActorActions(room, p.id, type));
  }
  return remaining;
}
function canUseAction(room, p, type, targetId) {
  if (p.role === 'Witch') {
    const maxTotal = hasPower(p, 'power_witch_dual') ? 2 : 1;
    if (countActorActions(room, p.id) >= maxTotal) return { ok: false, reason: 'Aksi Witch malam ini sudah habis.' };
  }
  const limits = getActionLimits(room, p);
  const limit = limits[type] || 0;
  if (limit <= 0) return { ok: false, reason: 'Item/role kamu tidak mengizinkan aksi ini sekarang.' };
  if (countActorActions(room, p.id, type) >= limit) return { ok: false, reason: 'Limit aksi ini sudah habis untuk malam ini.' };
  if (hasActorTargeted(room, p.id, type, targetId)) return { ok: false, reason: 'Target ini sudah kamu pilih untuk aksi yang sama.' };
  return { ok: true };
}
function rejectNightAction(player, title = 'Aksi Ditolak', text = 'Aksi role kamu untuk malam ini sudah terkunci.') {
  personalAnim(player.id, 'blocked', title, text, { aura: 'amber' });
}
function actionNeeded(p, room = null) {
  if (!p.alive) return false;
  if (!room) return ['Werewolf','Alpha Werewolf','Sorcerer','Seer','Doctor','Bodyguard'].includes(p.role) || (p.role === 'Priest' && !p.priestBlessUsed) || (p.role === 'Witch' && (!p.witchHealUsed || !p.witchPoisonUsed));
  return remainingNightActions(room, p) > 0;
}

function scanResultFor(room, seer, target) {
  const meta = ROLE_META[target.role] || { team: 'unknown' };
  if (hasActivePower(target, 'power_shadow_cloak') && !target.powerUsedCloak) {
    target.powerUsedCloak = true;
    consumePowerItem(target, 'power_shadow_cloak', room, 'Shadow Cloak');
    return `${target.name} terlihat berada di sisi Village. Aura gelap menutupi kebenaran.`;
  }
  if (target.role === 'Lycan') return `${target.name} terlihat seperti Werewolf karena kutukan Lycan.`;
  if (room.nightEvent?.id === 'mist') {
    const teamLabel = meta.team === 'werewolf' ? 'Werewolf' : meta.team === 'jester' ? 'Netral/Jester' : 'Village';
    return `${target.name} berada di sisi ${teamLabel}. Kabut menutupi role detailnya.`;
  }
  return `${target.name} adalah ${target.role} (${meta.team}).`;
}

function submitNightAction(room, socket, data) {
  const p = getPlayerBySocket(socket.id)?.player;
  if (!p || !p.alive || room.phase !== 'night') return;
  const target = room.players.get(data?.targetId);
  const typeRaw = String(data?.type || 'main');
  const type = typeRaw === 'heal' ? 'witchHeal' : typeRaw === 'poison' ? 'witchPoison' : typeRaw;

  if (['Werewolf','Alpha Werewolf','Sorcerer'].includes(p.role)) {
    if (type !== 'kill') return rejectNightAction(p, 'Aksi Tidak Valid', 'Tim Werewolf hanya bisa memilih target serangan.');
    if (!target || !target.alive || target.id === p.id || ROLE_META[target.role]?.team === 'werewolf') return rejectNightAction(p, 'Target Tidak Valid', 'Werewolf tidak bisa menarget diri sendiri atau sesama tim Werewolf.');
    const check = canUseAction(room, p, 'kill', target.id);
    if (!check.ok) return rejectNightAction(p, 'Aksi Ditolak', check.reason);
    if (hasActivePower(p, 'power_wolf_double')) {
      consumePowerItem(p, 'power_wolf_double', room, 'Double Fang');
      p.wolfDoubleDay = room.day;
    }
    room.nightActions.set(`${p.id}:kill:${target.id}:${nowId()}`, { actor: p.id, role: p.role, type: 'kill', target: target.id });
    p.roundStats.killsAttempted += 1;
    personalAnim(p.id, 'attack', 'Target Terkunci', `${target.name} menjadi target seranganmu malam ini.`, { aura: 'blood' });
    emitWolves(room, 'werewolf:choice', { actorName: p.name, targetName: target.name });
  } else if (p.role === 'Seer') {
    if (type !== 'scan') return rejectNightAction(p, 'Aksi Tidak Valid', 'Seer hanya bisa menerawang.');
    if (!target || !target.alive || target.id === p.id) return rejectNightAction(p, 'Target Tidak Valid', 'Seer harus menerawang pemain lain yang masih hidup.');
    const check = canUseAction(room, p, 'scan', target.id);
    if (!check.ok) return rejectNightAction(p, 'Aksi Ditolak', check.reason);
    if (countActorActions(room, p.id, 'scan') >= 1) consumePowerItem(p, 'power_seer_double', room, 'Double Vision Lens');
    room.nightActions.set(`${p.id}:scan:${target.id}:${nowId()}`, { actor: p.id, role: p.role, type: 'scan', target: target.id });
    p.roundStats.scans += 1;
    p.lastInfo = scanResultFor(room, p, target);
    personalAnim(p.id, 'seer', 'Hasil Terawangan', p.lastInfo, { aura: 'violet' });
  } else if (p.role === 'Doctor') {
    if (type !== 'protect') return rejectNightAction(p, 'Aksi Tidak Valid', 'Doctor hanya bisa protect.');
    if (!target || !target.alive) return rejectNightAction(p, 'Target Tidak Valid', 'Doctor hanya bisa melindungi pemain hidup.');
    const check = canUseAction(room, p, 'protect', target.id);
    if (!check.ok) return rejectNightAction(p, 'Aksi Ditolak', check.reason);
    if (countActorActions(room, p.id, 'protect') >= 1) consumePowerItem(p, 'power_doctor_double', room, 'Emergency Kit');
    room.nightActions.set(`${p.id}:protect:${target.id}:${nowId()}`, { actor: p.id, role: p.role, type: 'protect', target: target.id });
    p.roundStats.protects += 1;
    personalAnim(p.id, 'heal', 'Perlindungan Terkunci', `${target.name} kamu lindungi malam ini.`, { aura: 'green' });
  } else if (p.role === 'Bodyguard') {
    if (type !== 'guard') return rejectNightAction(p, 'Aksi Tidak Valid', 'Bodyguard hanya bisa guard.');
    if (!target || !target.alive || target.id === p.id) return rejectNightAction(p, 'Target Tidak Valid', 'Bodyguard harus menjaga pemain lain yang masih hidup.');
    const check = canUseAction(room, p, 'guard', target.id);
    if (!check.ok) return rejectNightAction(p, 'Aksi Ditolak', check.reason);
    if (countActorActions(room, p.id, 'guard') >= 1) consumePowerItem(p, 'power_bodyguard_double', room, 'Twin Guard Oath');
    room.nightActions.set(`${p.id}:guard:${target.id}:${nowId()}`, { actor: p.id, role: p.role, type: 'guard', target: target.id });
    p.roundStats.protects += 1;
    personalAnim(p.id, 'guard', 'Penjagaan Terkunci', `Kamu berjaga di dekat ${target.name}.`, { aura: 'blue' });
  } else if (p.role === 'Priest') {
    if (type !== 'bless') return rejectNightAction(p, 'Aksi Tidak Valid', 'Priest hanya bisa Holy Shield.');
    if (p.priestBlessUsed) return rejectNightAction(p, 'Holy Shield Habis', 'Priest hanya punya satu Holy Shield per game.');
    if (!target || !target.alive) return rejectNightAction(p, 'Target Tidak Valid', 'Priest hanya bisa memberi Holy Shield kepada pemain hidup.');
    const check = canUseAction(room, p, 'bless', target.id);
    if (!check.ok) return rejectNightAction(p, 'Aksi Ditolak', check.reason);
    room.nightActions.set(`${p.id}:bless:${target.id}:${nowId()}`, { actor: p.id, role: p.role, type: 'bless', target: target.id });
    p.priestBlessUsed = true;
    p.roundStats.protects += 1;
    personalAnim(p.id, 'bless', 'Holy Shield Terkunci', `${target.name} mendapat perlindungan suci malam ini.`, { aura: 'blue' });
  } else if (p.role === 'Witch') {
    if (!target || !target.alive) return rejectNightAction(p, 'Target Tidak Valid', 'Witch hanya bisa menarget pemain hidup.');
    if (type === 'witchHeal') {
      if (p.witchHealUsed) return rejectNightAction(p, 'Ramuan Heal Habis', 'Ramuan heal hanya bisa dipakai satu kali per game.');
      const check = canUseAction(room, p, 'witchHeal', target.id);
      if (!check.ok) return rejectNightAction(p, 'Aksi Ditolak', check.reason);
      if (countActorActions(room, p.id) >= 1) consumePowerItem(p, 'power_witch_dual', room, 'Dual Vial Belt');
      room.nightActions.set(`${p.id}:witchHeal:${target.id}:${nowId()}`, { actor: p.id, role: p.role, type: 'witchHeal', target: target.id });
      p.witchHealUsed = true;
      p.roundStats.protects += 1;
      personalAnim(p.id, 'heal', 'Ramuan Heal Terkunci', `${target.name} akan diselamatkan jika diserang.`, { aura: 'green' });
    } else if (type === 'witchPoison') {
      if (p.witchPoisonUsed) return rejectNightAction(p, 'Ramuan Poison Habis', 'Ramuan poison hanya bisa dipakai satu kali per game.');
      if (target.id === p.id) return rejectNightAction(p, 'Target Tidak Valid', 'Witch tidak bisa poison diri sendiri.');
      const check = canUseAction(room, p, 'witchPoison', target.id);
      if (!check.ok) return rejectNightAction(p, 'Aksi Ditolak', check.reason);
      if (countActorActions(room, p.id) >= 1) consumePowerItem(p, 'power_witch_dual', room, 'Dual Vial Belt');
      room.nightActions.set(`${p.id}:witchPoison:${target.id}:${nowId()}`, { actor: p.id, role: p.role, type: 'witchPoison', target: target.id });
      p.witchPoisonUsed = true;
      personalAnim(p.id, 'poison', 'Ramuan Poison Terkunci', `${target.name} terkena kutukan racun.`, { aura: 'green' });
    } else return rejectNightAction(p, 'Pilih Ramuan', 'Pilih mode Heal atau Poison dulu.');
  } else {
    return rejectNightAction(p, 'Tidak Ada Aksi', 'Role kamu tidak punya aksi aktif pada malam ini.');
  }
  sendState(room);

  const active = alivePlayers(room).filter(x => actionNeeded(x, room));
  if (active.length === 0) {
    setTimeout(() => { if (rooms.has(room.code) && room.phase === 'night') resolveNight(room); }, 900);
  }
}

function emitWolves(room, event, payload) {
  for (const p of room.players.values()) {
    if (p.alive && ROLE_META[p.role]?.team === 'werewolf') io.to(p.id).emit(event, payload);
  }
}


function startNight(room) {
  if (!room || !rooms.has(room.code) || room.phase === 'gameOver') return;
  clearRoomTimer(room);
  room.day = Math.max(0, Number(room.day || 0)) + 1;
  room.nightActions.clear();
  room.votes.clear();

  for (const p of room.players.values()) {
    p.lastInfo = p.lastInfo || '';
    // Reset only per-night helper flags. Per-game flags stay untouched.
    if (p.powerVoteDay !== room.day) p.powerVoteDay = null;
  }

  room.nightEvent = rollNightEvent(room.day);
  const eventText = room.nightEvent ? ` Event malam ini: ${room.nightEvent.name} — ${room.nightEvent.desc}` : '';
  narrative(room, `Malam ${room.day}`, `Desa tertidur. Role malam memilih aksi masing-masing.${eventText}`, room.nightEvent?.id === 'bloodMoon' ? 'blood' : 'dark');
  setPhase(room, 'night', room.settings.nightSec, () => resolveNight(room));

  const active = alivePlayers(room).filter(x => actionNeeded(x, room));
  if (active.length === 0) {
    setTimeout(() => { if (rooms.has(room.code) && room.phase === 'night') resolveNight(room); }, 1200);
  }
}


function resolveNight(room) {
  clearRoomTimer(room);
  const actions = [...room.nightActions.values()];
  const killCounts = new Map();
  for (const a of actions.filter(a => a.type === 'kill')) killCounts.set(a.target, (killCounts.get(a.target) || 0) + (a.role === 'Alpha Werewolf' ? 2 : 1));
  const maxWolfTargets = alivePlayers(room).some(p => ROLE_META[p.role]?.team === 'werewolf' && (hasActivePower(p, 'power_wolf_double') || p.wolfDoubleDay === room.day)) ? 2 : 1;
  const wolfTargetIds = [...killCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, maxWolfTargets).map(([id]) => id);

  const doctorProtected = new Set(actions.filter(a => a.type === 'protect').map(a => a.target));
  const holyProtected = new Set(actions.filter(a => a.type === 'bless' || a.type === 'witchHeal').map(a => a.target));
  const guardActions = actions.filter(a => a.type === 'guard');
  const poisonTargets = actions.filter(a => a.type === 'witchPoison').map(a => a.target);
  const deaths = [];
  const saved = [];
  const transformed = [];
  let holyNightUsed = false;

  for (const wolfTargetId of wolfTargetIds) {
    const wolfTarget = room.players.get(wolfTargetId);
    if (!wolfTarget?.alive) continue;
    const guard = guardActions.find(a => a.target === wolfTargetId && room.players.get(a.actor)?.alive);
    const doctorWorks = doctorProtected.has(wolfTargetId) && room.nightEvent?.id !== 'bloodMoon';
    const holyWorks = holyProtected.has(wolfTargetId);
    if (guard) {
      deaths.push({ id: guard.actor, reason: 'berkorban sebagai Bodyguard' });
      saved.push(wolfTargetId);
    } else if (holyWorks) {
      saved.push(wolfTargetId);
    } else if (doctorWorks) {
      saved.push(wolfTargetId);
    } else if (room.nightEvent?.id === 'holyNight' && !holyNightUsed) {
      holyNightUsed = true;
      saved.push(wolfTargetId);
    } else if (wolfTarget.role === 'Cursed Villager' && !wolfTarget.cursedTurned) {
      transformCursed(room, wolfTarget);
      transformed.push(wolfTargetId);
    } else {
      if (room.nightEvent?.id === 'bloodMoon' && doctorProtected.has(wolfTargetId)) addLog(room, 'Blood Moon menembus perlindungan Doctor biasa.', 'blood');
      deaths.push({ id: wolfTargetId, reason: 'dimangsa Werewolf' });
    }
  }
  for (const id of poisonTargets) deaths.push({ id, reason: 'terkena poison Witch' });

  const uniqueDeaths = new Map();
  for (const d of deaths) uniqueDeaths.set(d.id, d.reason);

  for (const id of saved) {
    const target = room.players.get(id);
    if (target?.alive) {
      personalAnim(id, 'saved', 'Kamu Selamat', 'Ada kekuatan yang menyelamatkanmu malam ini.', { aura: 'green' });
      roomAnim(room, 'saved', 'Seseorang Selamat', 'Malam ini ada target yang berhasil diselamatkan.', { targetId: id });
    }
  }

  const deadNames = [];
  for (const [id, reason] of uniqueDeaths.entries()) {
    const target = room.players.get(id);
    if (target && target.alive) {
      const died = killPlayer(room, target, reason, 'night');
      if (died) {
        deadNames.push(target.name);
        for (const a of actions.filter(a => a.type === 'kill' && a.target === id)) {
          const actor = room.players.get(a.actor);
          if (actor?.roundStats) actor.roundStats.kills += 1;
        }
      }
    }
  }

  if (deadNames.length) narrative(room, 'Korban Malam', `${deadNames.join(', ')} ditemukan tidak bernyawa.`, 'blood');
  else if (transformed.length) narrative(room, 'Kutukan Bangkit', 'Tidak ada mayat ditemukan, tetapi sesuatu di dalam desa telah berubah.', 'blood');
  else narrative(room, 'Malam Tanpa Korban', 'Tidak ada pemain yang mati malam ini. Desa masih punya harapan.', 'green');

  room.nightEvent = null;
  if (checkWin(room)) return;
  if (room.hunterQueue.length) return startHunter(room, room.hunterQueue[0], 'day');
  startDay(room);
}

function transformCursed(room, target) {
  target.role = 'Werewolf';
  target.cursedTurned = true;
  target.lastInfo = 'Kutukanmu bangkit. Kamu sekarang menjadi Werewolf.';
  personalAnim(target.id, 'cursed', 'Kutukan Bangkit', 'Kamu diserang Werewolf, tetapi kutukan mengubahmu menjadi Werewolf.', { aura: 'blood', role: target.role });
  roomAnim(room, 'cursed', 'Kutukan Bangkit', `${target.name} selamat dari malam, tetapi kegelapan bertambah kuat.`, { targetId: target.id });
  addLog(room, `${target.name} tidak mati. Kutukan Cursed Villager telah bangkit.`, 'blood');
}

function startDay(room) {
  narrative(room, `Siang ${room.day}`, 'Semua pemain berdiskusi. Cari kebohongan, lindungi yang benar, dan jangan salah tuduh.', 'sun');
  setPhase(room, 'day', room.settings.daySec, () => startVoting(room));
}

function startVoting(room) {
  room.votes.clear();
  narrative(room, 'Voting Eliminasi', 'Pilih pemain yang paling mencurigakan. Suara Kades dihitung 2.', 'amber');
  setPhase(room, 'voting', room.settings.voteSec, () => resolveVoting(room));
}

function voteWeight(player, room = null) {
  if (!player) return 1;
  if (room && player.powerVoteDay === room.day) return 3;
  return player.isMayor ? 2 : 1;
}

function getVoteState(room) {
  const counts = {};
  for (const [voterId, targetId] of room.votes.entries()) {
    const voter = room.players.get(voterId);
    const target = room.players.get(targetId);
    if (!voter?.alive || !target?.alive) continue;
    counts[targetId] = (counts[targetId] || 0) + voteWeight(voter, room);
  }
  return { counts, total: room.votes.size };
}

function resolveVoting(room) {
  clearRoomTimer(room);
  const counts = new Map();
  for (const [voterId, targetId] of room.votes.entries()) {
    const voter = room.players.get(voterId);
    const target = room.players.get(targetId);
    if (!voter?.alive || !target?.alive) continue;
    const weight = voteWeight(voter, room);
    counts.set(targetId, (counts.get(targetId) || 0) + weight);
  }
  if (!counts.size) {
    narrative(room, 'Tidak Ada Eliminasi', 'Desa ragu-ragu. Tidak ada yang dieliminasi.', 'dark');
    if (checkWin(room)) return;
    return startNight(room);
  }
  let high = -1;
  let tied = [];
  for (const [id, score] of counts.entries()) {
    if (score > high) { high = score; tied = [id]; }
    else if (score === high) tied.push(id);
  }
  if (tied.length > 1) {
    narrative(room, 'Voting Seri', 'Tidak ada mayoritas jelas. Tidak ada yang dieliminasi.', 'amber');
    if (checkWin(room)) return;
    return startNight(room);
  }
  const target = room.players.get(tied[0]);
  if (target?.alive) {
    const died = killPlayer(room, target, 'dieliminasi oleh voting desa', 'vote');
    target.publicRole = target.role;
    if (!died) {
      if (checkWin(room)) return;
      return startNight(room);
    }
    roomAnim(room, 'execution', 'Eliminasi Desa', `${target.name} dieliminasi. Role-nya: ${target.role}.`, { targetId: target.id, role: target.role });
    if (target.role === 'Jester') {
      return endGame(room, 'jester', `${target.name} adalah Jester dan menang karena berhasil dieliminasi!`);
    }
    if (target.role === 'Hunter') {
      return startHunter(room, target.id, 'night');
    }
  }
  if (checkWin(room)) return;
  startNight(room);
}

function startHunter(room, hunterId, nextPhase = 'night') {
  const hunter = room.players.get(hunterId);
  if (!hunter) return nextPhase === 'day' ? startDay(room) : startNight(room);
  room.hunterNext = nextPhase;
  narrative(room, 'Hunter Revenge', `${hunter.name} adalah Hunter. Ia boleh menembak satu pemain sebelum gugur sepenuhnya.`, 'amber');
  personalAnim(hunterId, 'hunter', 'Kesempatan Terakhir', 'Pilih satu pemain untuk ditembak.', { aura: 'amber' });
  setPhase(room, 'hunter', room.settings.hunterSec, () => {
    room.hunterQueue.shift();
    if (checkWin(room)) return;
    if (room.hunterQueue.length) return startHunter(room, room.hunterQueue[0], room.hunterNext || nextPhase);
    const next = room.hunterNext || nextPhase;
    room.hunterNext = null;
    return next === 'day' ? startDay(room) : startNight(room);
  });
}

function hunterShoot(room, socket, targetId) {
  if (room.phase !== 'hunter') return;
  const hunterId = room.hunterQueue[0];
  const actor = getPlayerBySocket(socket.id)?.player;
  if (!actor || actor.id !== hunterId) return;
  const target = room.players.get(targetId);
  if (!target || !target.alive) return;
  killPlayer(room, target, 'ditembak Hunter', 'hunter');
  target.publicRole = target.role;
  roomAnim(room, 'hunterShot', 'Tembakan Hunter', `${target.name} tertembak. Role-nya: ${target.role}.`, { targetId: target.id, role: target.role });
  room.hunterQueue.shift();
  if (target.role === 'Hunter' && !room.hunterQueue.includes(target.id)) room.hunterQueue.push(target.id);
  if (checkWin(room)) return;
  const next = room.hunterNext || 'night';
  if (room.hunterQueue.length) return startHunter(room, room.hunterQueue[0], next);
  room.hunterNext = null;
  return next === 'day' ? startDay(room) : startNight(room);
}

function killPlayer(room, target, reason, source) {
  if (!target.alive) return false;

  if (source === 'night' && hasActivePower(target, 'power_lucky_charm') && !target.powerUsedLucky) {
    target.powerUsedLucky = true;
    consumePowerItem(target, 'power_lucky_charm', room, 'Lucky Charm');
    target.roundStats.savedByCharm = (target.roundStats.savedByCharm || 0) + 1;
    personalAnim(target.id, 'saved', 'Lucky Charm Aktif', 'Jimat keberuntungan menyelamatkanmu dari kematian malam ini.', { aura: 'green' });
    roomAnim(room, 'saved', 'Lucky Charm Menyala', `${target.name} lolos dari serangan malam karena Lucky Charm.`, { targetId: target.id });
    addLog(room, `${target.name} selamat karena Lucky Charm.`, 'green');
    sendState(room);
    return false;
  }

  if (source === 'vote' && target.role === 'Prince' && !target.princeShieldUsed) {
    target.princeShieldUsed = true;
    target.publicRole = target.role;
    personalAnim(target.id, 'prince', 'Royal Immunity', 'Kamu adalah Prince. Sekali ini kamu selamat dari voting desa.', { aura: 'amber' });
    roomAnim(room, 'prince', 'Prince Selamat', `${target.name} ternyata Prince dan selamat dari eliminasi voting satu kali.`, { targetId: target.id });
    addLog(room, `${target.name} selamat dari voting karena Royal Immunity Prince.`, 'mayor');
    sendState(room);
    return false;
  }

  target.alive = false;
  if (target.isMayor) {
    target.isMayor = false;
    const candidate = alivePlayers(room)[0];
    if (candidate) {
      candidate.isMayor = true;
      roomAnim(room, 'mayor', 'Kades Baru', `${candidate.name} mengambil alih jabatan Kades.`, { targetId: candidate.id });
    }
  }
  personalAnim(target.id, 'death', 'Kamu Gugur', `Kamu ${reason}.`, { role: target.role, source });
  addLog(room, `${target.name} ${reason}.`, 'death');
  if (target.role === 'Hunter' && !room.hunterQueue.includes(target.id)) room.hunterQueue.push(target.id);
  sendState(room);
  return true;
}


function awardEndGame(room, winningTeam) {
  if (room.rewardsGranted) return;
  room.rewardsGranted = true;
  for (const p of room.players.values()) {
    const user = profileForAccount(p.accountKey);
    if (!user) continue;
    const stats = user.stats || (user.stats = createStats());
    const team = ROLE_META[p.role]?.team || 'village';
    const won = team === winningTeam || (winningTeam === 'jester' && p.role === 'Jester');
    stats.games = (stats.games || 0) + 1;
    stats.roleGames[p.role] = (stats.roleGames[p.role] || 0) + 1;
    stats.teamGames[team] = (stats.teamGames[team] || 0) + 1;
    if (won) {
      stats.wins = (stats.wins || 0) + 1;
      stats.winStreak = (stats.winStreak || 0) + 1;
      stats.bestStreak = Math.max(stats.bestStreak || 0, stats.winStreak || 0);
      stats.teamWins[winningTeam] = (stats.teamWins[winningTeam] || 0) + 1;
      stats.roleWins[p.role] = (stats.roleWins[p.role] || 0) + 1;
      if (p.isMayor) stats.mayorWins = (stats.mayorWins || 0) + 1;
    } else {
      stats.losses = (stats.losses || 0) + 1;
      stats.winStreak = 0;
    }
    const rs = p.roundStats || defaultRoundStats();
    stats.kills = (stats.kills || 0) + (rs.kills || 0);
    stats.scans = (stats.scans || 0) + (rs.scans || 0);
    stats.protects = (stats.protects || 0) + (rs.protects || 0);
    stats.votesCast = (stats.votesCast || 0) + (rs.votesCast || 0);
    let points = won ? (team === 'werewolf' ? 160 : 130) : 35;
    points += Math.min(120, (rs.kills || 0) * 35 + (rs.scans || 0) * 20 + (rs.protects || 0) * 20 + (p.isMayor && won ? 30 : 0));
    if ((stats.winStreak || 0) >= 3 && won) points += 60;
    grantPoints(user, points, won ? 'win' : 'participation');
    user.updatedAt = Date.now();
    if (p.socketId) io.to(p.id).emit('reward:summary', { points, won, winningTeam, stats, profile: publicProfile(user) });
  }
  saveDbSoon();
}

function checkWin(room) {
  if (room.gameOver) return true;
  const wolves = aliveByTeam(room, 'werewolf');
  const others = nonWolvesAlive(room);
  if (wolves.length === 0) {
    endGame(room, 'village', 'Semua Werewolf telah dikalahkan. Desa menang!');
    return true;
  }
  if (wolves.length >= others.length) {
    endGame(room, 'werewolf', 'Werewolf menguasai desa. Kegelapan menang!');
    return true;
  }
  return false;
}

function endGame(room, winningTeam, reason) {
  clearRoomTimer(room);
  room.phase = 'gameOver';
  room.gameOver = { winningTeam, reason, at: Date.now() };
  awardEndGame(room, winningTeam);
  room.autoResetAt = Date.now() + 25000;
  for (const p of room.players.values()) p.publicRole = p.role;
  for (const p of room.players.values()) {
    const team = ROLE_META[p.role]?.team;
    const won = team === winningTeam || (winningTeam === 'jester' && p.role === 'Jester');
    personalAnim(p.id, won ? 'victory' : 'defeat', won ? 'Kemenangan!' : 'Kekalahan...', won ? 'Tim/tujuanmu berhasil menang.' : 'Tujuanmu gagal kali ini.', { winningTeam, role: p.role });
  }
  roomAnim(room, winningTeam === 'werewolf' ? 'wolfWin' : winningTeam === 'jester' ? 'jesterWin' : 'villageWin', 'Game Selesai', reason, { winningTeam });
  addLog(room, `Game selesai: ${reason}`, 'gameOver');
  addLog(room, 'Room akan otomatis kembali ke lobby dalam 25 detik. Host juga bisa klik Reset Room untuk mulai ulang lebih cepat.', 'info');
  sendState(room);
  room.autoResetTimer = setTimeout(() => {
    if (!rooms.has(room.code) || room.phase !== 'gameOver') return;
    resetRoom(room, { auto: true });
  }, 25000);
}


function clearPlayerRoundRoleState(p, keepAlive = true) {
  if (!p) return;
  p.role = null;
  if (keepAlive) p.alive = true;
  p.isMayor = false;
  p.publicRole = null;
  p.lastInfo = '';
  p.witchHealUsed = false;
  p.witchPoisonUsed = false;
  p.priestBlessUsed = false;
  p.princeShieldUsed = false;
  p.cursedTurned = false;
  p.roundStats = defaultRoundStats();
  p.powerUsedLucky = false;
  p.powerUsedCloak = false;
  p.powerConsumed = false;
  p.consumedPowerId = null;
  p.powerVoteDay = null;
  p.wolfDoubleDay = null;
  applyProfileToPlayer(p);
}

function sanitizeLobbyState(room) {
  if (!room) return;
  if (room.phase !== 'lobby' && room.gameStarted) return;
  room.phase = 'lobby';
  room.gameStarted = false;
  room.roundId = null;
  room.day = 0;
  room.mayorResolved = false;
  room.gameOver = null;
  room.hunterQueue = [];
  room.hunterNext = null;
  room.nightEvent = null;
  room.votes?.clear?.();
  room.mayorVotes?.clear?.();
  room.nightActions?.clear?.();
  for (const player of room.players.values()) clearPlayerRoundRoleState(player, true);
}

function resetRoom(room, options = {}) {
  clearRoomTimer(room);
  clearAutoResetTimer(room);
  room.phase = 'lobby';
  room.gameStarted = false;
  room.roundId = null;
  room.day = 0;
  room.nightActions.clear();
  room.votes.clear();
  room.mayorVotes.clear();
  room.mayorResolved = false;
  room.hunterQueue = [];
  room.hunterNext = null;
  room.gameOver = null;
  room.rewardsGranted = false;
  for (const p of room.players.values()) clearPlayerRoundRoleState(p, true);
  room.nightEvent = null;
  addLog(room, options.auto ? 'Game selesai. Room otomatis kembali ke lobby dan siap dimainkan lagi.' : 'Room direset ke lobby.', 'info');
  narrative(room, 'Lobby Dibuka Lagi', 'Pemain tetap berada di room. Host bisa langsung klik Start Game untuk ronde berikutnya.', 'green');
  sendState(room);
}


function findRoomBySocket(socketId) {
  const ref = socketIndex.get(socketId);
  if (!ref) return null;
  return rooms.get(ref.code) || null;
}

function getPlayerBySocket(socketId) {
  const ref = socketIndex.get(socketId);
  if (!ref) return null;
  const room = rooms.get(ref.code);
  if (!room) return null;
  const player = room.players.get(ref.playerId);
  if (!player) return null;
  return { room, player };
}

function bindSocketToPlayer(socket, room, player) {
  // Remove previous socket binding for this player if it still exists.
  if (player.socketId && player.socketId !== socket.id) {
    socketIndex.delete(player.socketId);
    const oldSocket = io.sockets.sockets.get(player.socketId);
    if (oldSocket) {
      oldSocket.leave(room.code);
      oldSocket.leave(player.id);
    }
  }
  player.socketId = socket.id;
  player.connected = true;
  player.lastDisconnectAt = null;
  room.lastEmptyAt = null;
  socketIndex.set(socket.id, { code: room.code, playerId: player.id });
  socket.join(room.code);
  socket.join(player.id); // personal room for private state, animations, and voice signaling
}


function findReconnectCandidate(room, playerId, accountKey, name) {
  const key = accountKey ? String(accountKey).toLowerCase() : '';

  // Login account is the strongest identity. This prevents a different account on the
  // same browser/device from accidentally reconnecting as the old host/player because
  // localStorage clientId is shared.
  if (key) {
    const byAccount = [...room.players.values()].find(p => String(p.accountKey || '').toLowerCase() === key);
    if (byAccount) return byAccount;
  }

  const cleanedId = playerId ? cleanClientId(playerId) : '';
  if (cleanedId && room.players.has(cleanedId)) {
    const byId = room.players.get(cleanedId);
    // Only trust raw clientId when the room player has no account, or when it belongs
    // to the same account. Never let account B take account A's slot.
    if (!key || !byId.accountKey || String(byId.accountKey || '').toLowerCase() === key) return byId;
  }

  const nameKey = usernameKey(name || '');
  if (nameKey) {
    const byName = [...room.players.values()].find(p => usernameKey(p.name || '') === nameKey && (!key || String(p.accountKey || '').toLowerCase() === key));
    if (byName) return byName;
  }
  return null;
}

function reconnectPlayer(socket, room, player, name, cb, source = 'reconnect') {
  const current = socketIndex.get(socket.id);
  const alreadyBound = current && current.code === room.code && current.playerId === player.id && player.socketId === socket.id && player.connected;
  if (alreadyBound) {
    io.to(player.id).emit('me:state', privateState(room, player.id));
    cb?.({ ok: true, code: room.code, playerId: player.id, phase: room.phase, source: 'already-bound' });
    return;
  }
  if (!current || current.code !== room.code || current.playerId !== player.id) leaveCurrentRoom(socket, true);
  const wasDisconnected = !player.connected;
  if (name && room.phase === 'lobby') player.name = cleanName(name);
  bindSocketToPlayer(socket, room, player);
  if (wasDisconnected) addLog(room, `${player.name} tersambung kembali.`, 'info');
  sendState(room);
  if (wasDisconnected) personalAnim(player.id, 'reconnect', 'Reconnect Berhasil', `Kamu kembali ke room ${room.code}.`, { aura: 'green' });
  cb?.({ ok: true, code: room.code, playerId: player.id, phase: room.phase, source });
}

function leaveCurrentRoom(socket, silent = false) {
  const ref = socketIndex.get(socket.id);
  if (!ref) return;
  const room = rooms.get(ref.code);
  const p = room?.players.get(ref.playerId);
  if (!room || !p) {
    socketIndex.delete(socket.id);
    return;
  }

  socket.leave(room.code);
  socket.leave(p.id);
  socketIndex.delete(socket.id);
  room.voice.delete(p.id);
  io.to(room.code).emit('voice:peer-left', { peerId: p.id });

  if (p.socketId === socket.id) {
    p.connected = false;
    p.socketId = null;
    p.lastDisconnectAt = Date.now();
    addLog(room, `${p.name} terputus. Ia bisa reconnect/join ulang ke room ini.`, 'warn');
  }

  // Host is not transferred on temporary disconnect. This keeps the original host able to reconnect as host.
  // Host transfer only happens when the host actually leaves/kicked in lobby.

  if (![...room.players.values()].some(x => x.connected)) {
    room.lastEmptyAt = Date.now();
    // Do not clear the game timer here. Timers must keep running so a reconnect does not freeze the game.
  }

  if (!silent) sendState(room);
}



function chooseWeightedRarity(weights = {}) {
  const entries = Object.entries(weights).filter(([, w]) => Number(w) > 0);
  const total = entries.reduce((sum, [, w]) => sum + Number(w), 0) || 1;
  let roll = Math.random() * total;
  for (const [rarity, weight] of entries) {
    roll -= Number(weight);
    if (roll <= 0) return rarity;
  }
  return entries[entries.length - 1]?.[0] || 'common';
}
function openCrateForUser(user, crateId) {
  normalizeUser(user);
  const crate = CRATE_DEFS.find(c => c.id === crateId) || CRATE_DEFS[0];
  if (!crate) return { ok: false, error: 'Crate tidak ditemukan.' };
  if (!user.isAdmin && Number(user.points || 0) < crate.price) return { ok: false, error: 'Poin tidak cukup untuk open crate ini.' };
  if (!user.isAdmin) user.points -= crate.price; else user.points = ADMIN_POINTS;
  const rarity = chooseWeightedRarity(crate.weights);
  const pool = crate.rewards.filter(r => r.rarity === rarity);
  const reward = (pool.length ? pool : crate.rewards)[Math.floor(Math.random() * (pool.length ? pool.length : crate.rewards.length))];
  const meta = RARITY_META[reward.rarity] || RARITY_META.common;
  let result = { rarity: reward.rarity, rarityLabel: meta.label, rarityEmoji: meta.emoji, crate: { id: crate.id, name: crate.name, emoji: crate.emoji } };
  if (reward.type === 'points') {
    const amount = Number(reward.amount || 0);
    user.points = user.isAdmin ? ADMIN_POINTS : Number(user.points || 0) + amount;
    result.type = 'points';
    result.amount = amount;
    result.name = reward.name || `${amount} Poin`;
    result.emoji = '💎';
  } else {
    const item = SHOP_BY_ID.get(reward.itemId);
    if (!item) return { ok: false, error: 'Reward item tidak valid.' };
    const qty = Math.max(1, Number(reward.qty || 1));
    user.inventory[item.id] = Number(user.inventory[item.id] || 0) + qty;
    result.type = 'item';
    result.item = item;
    result.qty = qty;
    result.name = item.name;
    result.emoji = item.emoji;
  }
  user.cratesOpened = Number(user.cratesOpened || 0) + 1;
  user.updatedAt = Date.now();
  saveDbSoon();
  return { ok: true, crate: { id: crate.id, name: crate.name, emoji: crate.emoji }, reward: result, profile: publicProfile(user) };
}
function getAuthenticatedUser(socket) {
  const key = authSessions.get(socket.id);
  return { key, user: getUserByKey(key) };
}

// Safe auth restore: Socket.IO gets a new socket.id after reconnect/redeploy,
// so the browser can include saved username+PIN in room actions.
// This prevents the server from saying "Belum login" even though the UI is already logged in.
function authenticateSocket(socket, auth = {}) {
  let key = authSessions.get(socket.id);
  let user = getUserByKey(key);
  if (user) return { key, user };

  const username = auth?.username;
  const pin = auth?.pin;
  if (!username || !pin) return { key: null, user: null };

  const tryKey = usernameKey(username);
  const tryUser = getUserByKey(tryKey);
  if (!tryUser) return { key: null, user: null };
  if (pinHash(pin, tryUser.salt) !== tryUser.pinHash) return { key: null, user: null };

  normalizeUser(tryUser);
  tryUser.lastLoginAt = Date.now();
  tryUser.updatedAt = Date.now();
  authSessions.set(socket.id, tryKey);
  saveDbSoon();
  return { key: tryKey, user: tryUser };
}
function socialPush(key) {
  const user = getUserByKey(key);
  if (!user) return;
  emitToAccount(key, 'social:update', { social: publicSocial(user), profile: publicProfile(user) });
}

io.on('connection', socket => {
  socket.emit('rooms:list', getPublicRooms());
  socket.emit('shop:catalog', { shop: publicShop(), crates: publicCrates(), leaderboards: buildLeaderboards() });

  socket.on('auth:register', ({ username, pin, avatar } = {}, cb) => {
    const clean = cleanUsername(username);
    const key = usernameKey(clean);
    if (!clean || clean.length < 3) return cb?.({ ok: false, error: 'Nama minimal 3 karakter.' });
    if (!validPin(pin)) return cb?.({ ok: false, error: 'PIN harus angka 4-8 digit.' });
    if (db.users[key]) return cb?.({ ok: false, error: 'Nama sudah dipakai. Pilih nama lain atau login.' });
    const user = createUser(clean, pin, avatar);
    db.users[key] = user;
    authSessions.set(socket.id, key);
    saveDbSoon();
    normalizeUser(user);
    cb?.({ ok: true, profile: publicProfile(user), shop: publicShop(), crates: publicCrates(), social: publicSocial(user), leaderboards: buildLeaderboards() });
  });

  socket.on('auth:login', ({ username, pin } = {}, cb) => {
    const key = usernameKey(username);
    const user = getUserByKey(key);
    if (!user) return cb?.({ ok: false, error: 'Akun tidak ditemukan. Daftar dulu.' });
    if (pinHash(pin, user.salt) !== user.pinHash) return cb?.({ ok: false, error: 'PIN salah.' });
    user.lastLoginAt = Date.now();
    user.updatedAt = Date.now();
    authSessions.set(socket.id, key);
    saveDbSoon();
    normalizeUser(user);
    cb?.({ ok: true, profile: publicProfile(user), shop: publicShop(), crates: publicCrates(), social: publicSocial(user), leaderboards: buildLeaderboards() });
  });

  socket.on('auth:profile', (_data = {}, cb) => {
    const key = authSessions.get(socket.id);
    const user = getUserByKey(key);
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    normalizeUser(user);
    cb?.({ ok: true, profile: publicProfile(user), shop: publicShop(), crates: publicCrates(), social: publicSocial(user), leaderboards: buildLeaderboards() });
  });

  socket.on('auth:avatar', ({ avatar } = {}, cb) => {
    const key = authSessions.get(socket.id);
    const user = getUserByKey(key);
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    const safe = sanitizeAvatar(avatar);
    if (!safe) return cb?.({ ok: false, error: 'Avatar tidak valid / terlalu besar. Gunakan gambar kecil.' });
    user.avatar = safe;
    user.updatedAt = Date.now();
    saveDbSoon();
    for (const room of rooms.values()) for (const p of room.players.values()) if (p.accountKey === key) { applyProfileToPlayer(p); sendState(room); }
    notifyProfile(socket, key);
    cb?.({ ok: true, profile: publicProfile(user) });
  });

  socket.on('shop:buy', ({ itemId } = {}, cb) => {
    const key = authSessions.get(socket.id);
    const user = getUserByKey(key);
    const item = SHOP_BY_ID.get(String(itemId || ''));
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    if (!item) return cb?.({ ok: false, error: 'Item tidak ditemukan.' });
    const alreadyOwned = hasOwned(user, item.id);
    if (item.type !== 'power' && alreadyOwned) return cb?.({ ok: false, error: 'Item kosmetik sudah dimiliki.' });
    if (!user.isAdmin && (user.points || 0) < item.price) return cb?.({ ok: false, error: 'Poin belum cukup.' });
    if (!user.isAdmin) user.points -= item.price;
    else user.points = ADMIN_POINTS;
    user.inventory[item.id] = Number(user.inventory[item.id] || 0) + 1;
    user.updatedAt = Date.now();
    saveDbSoon();
    notifyProfile(socket, key);
    cb?.({ ok: true, profile: publicProfile(user), item });
  });

  socket.on('shop:equip', ({ itemId } = {}, cb) => {
    const key = authSessions.get(socket.id);
    const user = getUserByKey(key);
    const item = SHOP_BY_ID.get(String(itemId || ''));
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    if (!item) return cb?.({ ok: false, error: 'Item tidak ditemukan.' });
    if (!hasOwned(user, item.id)) return cb?.({ ok: false, error: 'Kamu belum punya item ini.' });
    if (item.type === 'power' && !canEquipPower(user, item.id)) return cb?.({ ok: false, error: 'Stok item power ini sudah habis.' });
    user.equipped = user.equipped || {};
    user.equipped[item.type] = item.id;
    user.updatedAt = Date.now();
    saveDbSoon();
    for (const room of rooms.values()) for (const p of room.players.values()) if (p.accountKey === key) { applyProfileToPlayer(p); sendState(room); }
    notifyProfile(socket, key);
    cb?.({ ok: true, profile: publicProfile(user), item });
  });



  socket.on('crate:open', ({ crateId } = {}, cb) => {
    const { key, user } = getAuthenticatedUser(socket);
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    const result = openCrateForUser(user, String(crateId || 'crate_moon'));
    if (!result.ok) return cb?.(result);
    notifyProfile(socket, key);
    cb?.({ ok: true, ...result, crates: publicCrates(), leaderboards: buildLeaderboards() });
  });

  socket.on('social:search', ({ query } = {}, cb) => {
    const { key, user } = getAuthenticatedUser(socket);
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    const q = usernameKey(query || '');
    if (!q || q.length < 2) return cb?.({ ok: true, users: [] });
    const users = Object.entries(db.users || {})
      .filter(([k]) => k !== key && k.includes(q))
      .slice(0, 12)
      .map(([k, u]) => ({ username: u.username, avatar: u.avatar || '', online: isUserOnline(k), isFriend: !!user.friends?.[k], requested: !!user.sentFriendRequests?.[k], pending: !!user.friendRequests?.[k] }));
    cb?.({ ok: true, users });
  });

  socket.on('social:request', ({ username } = {}, cb) => {
    const { key, user } = getAuthenticatedUser(socket);
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    normalizeUser(user);
    const targetKey = usernameKey(username);
    const target = getUserByKey(targetKey);
    if (!target || targetKey === key) return cb?.({ ok: false, error: 'Pemain tidak ditemukan.' });
    normalizeUser(target);
    if (user.friends[targetKey]) return cb?.({ ok: false, error: 'Sudah berteman.' });
    const at = Date.now();
    user.sentFriendRequests[targetKey] = at;
    target.friendRequests[key] = at;
    user.updatedAt = target.updatedAt = at;
    saveDbSoon();
    socialPush(targetKey); socialPush(key);
    cb?.({ ok: true, social: publicSocial(user) });
  });

  socket.on('social:accept', ({ username } = {}, cb) => {
    const { key, user } = getAuthenticatedUser(socket);
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    normalizeUser(user);
    const otherKey = usernameKey(username);
    const other = getUserByKey(otherKey);
    if (!other || !user.friendRequests?.[otherKey]) return cb?.({ ok: false, error: 'Request tidak ditemukan.' });
    normalizeUser(other);
    const at = Date.now();
    user.friends[otherKey] = at;
    other.friends[key] = at;
    delete user.friendRequests[otherKey];
    delete other.sentFriendRequests[key];
    user.updatedAt = other.updatedAt = at;
    saveDbSoon();
    socialPush(otherKey); socialPush(key);
    cb?.({ ok: true, social: publicSocial(user) });
  });

  socket.on('social:remove', ({ username } = {}, cb) => {
    const { key, user } = getAuthenticatedUser(socket);
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    const otherKey = usernameKey(username);
    const other = getUserByKey(otherKey);
    normalizeUser(user); normalizeUser(other);
    delete user.friends[otherKey]; delete user.friendRequests[otherKey]; delete user.sentFriendRequests[otherKey];
    if (other) { delete other.friends[key]; delete other.friendRequests[key]; delete other.sentFriendRequests[key]; other.updatedAt = Date.now(); }
    user.updatedAt = Date.now();
    saveDbSoon();
    if (other) socialPush(otherKey); socialPush(key);
    cb?.({ ok: true, social: publicSocial(user) });
  });

  socket.on('social:list', (_data = {}, cb) => {
    const { user } = getAuthenticatedUser(socket);
    if (!user) return cb?.({ ok: false, error: 'Belum login.' });
    cb?.({ ok: true, social: publicSocial(user) });
  });

  socket.on('social:invite-room', ({ username } = {}, cb) => {
    const { key, user } = getAuthenticatedUser(socket);
    const ctx = getPlayerBySocket(socket.id);
    if (!user || !ctx?.room || !ctx?.player) return cb?.({ ok: false, error: 'Kamu harus login dan berada di lobby/room.' });
    const targetKey = usernameKey(username);
    const target = getUserByKey(targetKey);
    normalizeUser(user); normalizeUser(target);
    if (!target || !user.friends?.[targetKey]) return cb?.({ ok: false, error: 'Pemain harus menjadi temanmu dulu.' });
    const room = ctx.room;
    room.invitedAccounts = room.invitedAccounts || new Set();
    room.invitedAccounts.add(targetKey);
    const invite = { id: nowId(), from: user.username, code: room.code, roomName: room.name, hasPassword: !!room.passwordHash, at: Date.now() };
    target.roomInvites = (target.roomInvites || []).filter(x => x.code !== room.code || x.from !== user.username).slice(-20);
    target.roomInvites.push(invite);
    target.updatedAt = Date.now();
    saveDbSoon(); saveRoomsSoon();
    emitToAccount(targetKey, 'social:room-invite', invite);
    socialPush(targetKey);
    cb?.({ ok: true, invite });
  });

  socket.on('leaderboard:get', (_data = {}, cb) => cb?.({ ok: true, leaderboards: buildLeaderboards() }));

  socket.on('rooms:list-request', (_data = {}, cb) => {
    const list = getPublicRooms();
    socket.emit('rooms:list', list);
    cb?.({ ok: true, rooms: list });
  });

  socket.on('room:create', ({ name, roomName, password, clientId, auth } = {}, cb) => {
    const { key: accountKey, user: profile } = authenticateSocket(socket, auth);
    if (!profile) return cb?.({ ok: false, error: 'Login / daftar dulu sebelum membuat room.' });
    leaveCurrentRoom(socket, true);
    const code = makeCode();
    const playerId = accountKey || cleanClientId(clientId);
    const room = newRoom(code, playerId, profile.username, { roomName, password });
    const p = {
      id: playerId,
      socketId: socket.id,
      name: profile.username,
      role: null,
      alive: true,
      connected: true,
      lastDisconnectAt: null,
      isMayor: false,
      publicRole: null,
      witchHealUsed: false,
      witchPoisonUsed: false,
      priestBlessUsed: false,
      princeShieldUsed: false,
      cursedTurned: false,
      avatar: profile.avatar || `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(profile.username)}`,
      accountKey,
      skin: profile.equipped?.skin || null,
      frame: profile.equipped?.frame || null,
      badge: profile.equipped?.badge || null,
      power: profile.equipped?.power || null,
      roundStats: defaultRoundStats(),
      powerConsumed: false,
      consumedPowerId: null,
      powerVoteDay: null,
      wolfDoubleDay: null
    };
    room.players.set(playerId, p);
    rooms.set(code, room);
    bindSocketToPlayer(socket, room, p);
    addLog(room, `${p.name} membuat room ${code}${room.passwordHash ? ' dengan password' : ''}.`, 'info');
    sendState(room);
    emitRoomList();
    cb?.({ ok: true, code, playerId });
  });

  socket.on('room:join', ({ code, name, password, clientId, auth } = {}, cb) => {
    const { key: accountKey, user: profile } = authenticateSocket(socket, auth);
    if (!profile) return cb?.({ ok: false, error: 'Login / daftar dulu sebelum join room.' });
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return cb?.({ ok: false, error: 'Room tidak ditemukan.' });
    const playerId = accountKey || cleanClientId(clientId);
    const existing = findReconnectCandidate(room, playerId, accountKey, profile.username);
    if (existing) return reconnectPlayer(socket, room, existing, name, cb, 'join-reconnect');
    const invitedByFriend = room.invitedAccounts && room.invitedAccounts.has(accountKey);
    if (!invitedByFriend && !verifyRoomPassword(room, password)) return cb?.({ ok: false, error: 'Password room salah.' });
    if ((room.players.size || 0) >= (room.maxPlayers || 16)) return cb?.({ ok: false, error: 'Room sudah penuh.' });
    if (room.phase !== 'lobby') return cb?.({ ok: false, error: 'Game sudah dimulai. Login akun yang sama lalu tekan Reconnect untuk masuk ulang.' });

    leaveCurrentRoom(socket, true);
    const p = {
      id: playerId,
      socketId: socket.id,
      name: profile.username,
      role: null,
      alive: true,
      connected: true,
      lastDisconnectAt: null,
      isMayor: false,
      publicRole: null,
      witchHealUsed: false,
      witchPoisonUsed: false,
      priestBlessUsed: false,
      princeShieldUsed: false,
      cursedTurned: false,
      avatar: profile.avatar || `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(profile.username)}`,
      accountKey,
      skin: profile.equipped?.skin || null,
      frame: profile.equipped?.frame || null,
      badge: profile.equipped?.badge || null,
      power: profile.equipped?.power || null,
      roundStats: defaultRoundStats(),
      powerConsumed: false,
      consumedPowerId: null,
      powerVoteDay: null,
      wolfDoubleDay: null
    };
    room.players.set(playerId, p);
    bindSocketToPlayer(socket, room, p);
    addLog(room, `${p.name} bergabung.`, 'info');
    sendState(room);
    cb?.({ ok: true, code: room.code, playerId: p.id });
  });

  socket.on('room:reconnect', ({ code, playerId, name, auth } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return cb?.({ ok: false, error: 'Room reconnect tidak ditemukan. Jika Railway baru restart/redeploy, room lama memang hilang.' });
    const { key: accountKey, user: profile } = authenticateSocket(socket, auth);
    const player = findReconnectCandidate(room, playerId, accountKey, profile?.username || name);
    if (!player) return cb?.({ ok: false, error: 'Session pemain tidak ditemukan. Login akun yang sama atau join ulang jika game masih lobby.' });
    reconnectPlayer(socket, room, player, profile?.username || name, cb, 'reconnect');
  });

  socket.on('room:leave', ({ clear = false } = {}) => {
    const ref = socketIndex.get(socket.id);
    const room = ref ? rooms.get(ref.code) : null;
    const p = room?.players.get(ref.playerId);
    if (!room || !p) return;
    if (clear || room.phase === 'lobby') {
      addLog(room, `${p.name} keluar dari room.`, 'warn');
      room.voice.delete(p.id);
      room.players.delete(p.id);
      socket.leave(room.code);
      socket.leave(p.id);
      socketIndex.delete(socket.id);
      io.to(room.code).emit('voice:peer-left', { peerId: p.id });
      if (room.hostId === p.id) {
        const next = [...room.players.values()].find(x => x.connected);
        if (next) room.hostId = next.id;
      }
      if (!room.players.size) { rooms.delete(room.code); emitRoomList(); }
      else sendState(room);
    } else {
      leaveCurrentRoom(socket);
    }
  });

  socket.on('room:settings', (settings = {}) => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const player = ctx?.player;
    if (!room || !player || room.hostId !== player.id || room.phase !== 'lobby') return;
    for (const key of Object.keys(room.settings)) {
      const val = Number(settings[key]);
      if (Number.isFinite(val)) room.settings[key] = Math.max(8, Math.min(600, Math.floor(val)));
    }
    sendState(room);
  });

  socket.on('game:start', () => {
    const ctx = getPlayerBySocket(socket.id);
    if (!ctx || ctx.room.hostId !== ctx.player.id) return;
    if (ctx.room.phase === 'gameOver') {
      resetRoom(ctx.room);
      return;
    }
    if (ctx.room.phase !== 'lobby') return;
    startGame(ctx.room);
  });

  socket.on('game:reset', () => {
    const ctx = getPlayerBySocket(socket.id);
    if (!ctx || ctx.room.hostId !== ctx.player.id) return;
    resetRoom(ctx.room);
  });

  socket.on('game:skip', () => {
    const ctx = getPlayerBySocket(socket.id);
    if (!ctx || ctx.room.hostId !== ctx.player.id) return;
    const room = ctx.room;
    if (room.phase === 'roleReveal') return startMayorVote(room);
    if (room.phase === 'mayorVote') return resolveMayorVote(room);
    if (room.phase === 'night') return resolveNight(room);
    if (room.phase === 'day') return startVoting(room);
    if (room.phase === 'voting') return resolveVoting(room);
    if (room.phase === 'hunter') {
      room.hunterQueue.shift();
      if (checkWin(room)) return;
      const next = room.hunterNext || 'night';
      if (room.hunterQueue.length) return startHunter(room, room.hunterQueue[0], next);
      room.hunterNext = null;
      return next === 'day' ? startDay(room) : startNight(room);
    }
  });

  socket.on('game:kick', ({ playerId } = {}) => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    if (!room || room.hostId !== ctx.player.id || playerId === room.hostId) return;
    const target = room.players.get(playerId);
    if (!target) return;
    io.to(target.id).emit('room:kicked');
    if (target.socketId) {
      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.leave(room.code);
        targetSocket.leave(target.id);
        socketIndex.delete(target.socketId);
      }
    }
    room.voice.delete(target.id);
    room.players.delete(playerId);
    addLog(room, `${target.name} dikeluarkan dari room.`, 'warn');
    sendState(room);
  });

  socket.on('mayor:vote', ({ targetId } = {}) => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const voter = ctx?.player;
    const target = room?.players.get(targetId);
    if (!room || room.phase !== 'mayorVote' || room.mayorResolved || !voter?.alive || !target?.alive) return;
    if (room.mayorVotes.has(voter.id)) return; // satu pemain hanya satu kali vote Kades per ronde
    room.mayorVotes.set(voter.id, targetId);
    personalAnim(voter.id, 'vote', 'Vote Kades Terkunci', `Kamu memilih ${target.name} sebagai Kepala Desa.`, { aura: 'amber' });
    sendState(room);
    if (allAliveMayorVotesSubmitted(room)) scheduleMayorVoteWatchdog(room, 180);
  });

  socket.on('night:action', data => {
    const room = findRoomBySocket(socket.id);
    if (room) submitNightAction(room, socket, data);
  });

  socket.on('vote:cast', ({ targetId } = {}) => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const voter = ctx?.player;
    const target = room?.players.get(targetId);
    if (!room || room.phase !== 'voting' || !voter?.alive || !target?.alive || targetId === voter.id) return;
    if (!voter.powerVoteDay && hasActivePower(voter, 'power_vote_triple')) {
      consumePowerItem(voter, 'power_vote_triple', room, 'Royal Ballot');
      voter.powerVoteDay = room.day;
    }
    room.votes.set(voter.id, targetId);
    voter.roundStats = voter.roundStats || defaultRoundStats();
    voter.roundStats.votesCast += 1;
    personalAnim(voter.id, 'vote', 'Vote Terkunci', `Kamu memilih ${target.name}. Suaramu bernilai ${voteWeight(voter, room)}.`, { aura: 'amber' });
    sendState(room);
    if (room.votes.size >= alivePlayers(room).length) {
      setTimeout(() => { if (room.phase === 'voting') resolveVoting(room); }, 800);
    }
  });

  socket.on('hunter:shoot', ({ targetId } = {}) => {
    const room = findRoomBySocket(socket.id);
    if (room) hunterShoot(room, socket, targetId);
  });

  socket.on('chat:send', ({ text, channel } = {}) => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const p = ctx?.player;
    if (!room || !p) return;
    const msg = String(text || '').replace(/<[^>]*>/g, '').trim().slice(0, 300);
    if (!msg) return;
    let targetRoom = room.code;
    let scope = 'public';
    if (channel === 'wolf' && ROLE_META[p.role]?.team === 'werewolf') scope = 'wolf';
    if (channel === 'dead' && (!p.alive || p.role === 'Medium')) scope = 'dead';
    const payload = { id: nowId(), from: p.name, fromId: p.id, text: msg, scope, at: Date.now(), alive: p.alive };
    if (scope === 'wolf') {
      for (const x of room.players.values()) if (ROLE_META[x.role]?.team === 'werewolf') io.to(x.id).emit('chat:message', payload);
    } else if (scope === 'dead') {
      for (const x of room.players.values()) if (!x.alive || x.role === 'Medium') io.to(x.id).emit('chat:message', payload);
    } else {
      io.to(targetRoom).emit('chat:message', payload);
    }
  });


  socket.on('music:room-play', ({ song, positionSec = 0 } = {}, cb) => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const player = ctx?.player;
    if (!room || !player || room.hostId !== player.id) return cb?.({ ok: false, error: 'Hanya host yang bisa memutar musik bersama.' });
    const safeSong = sanitizeMusicSong(song);
    if (!safeSong) return cb?.({ ok: false, error: 'Lagu tidak valid untuk diputar bersama.' });
    setRoomMusic(room, {
      status: 'playing',
      song: safeSong,
      startedAt: Date.now(),
      positionSec: Math.max(0, Number(positionSec || 0)),
      by: player.name
    });
    addLog(room, `🎧 Host memutar musik lobby: ${safeSong.title} — ${safeSong.artist}`, 'music');
    cb?.({ ok: true, music: publicMusic(room.music) });
  });

  socket.on('music:room-pause', ({ positionSec = 0 } = {}, cb) => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const player = ctx?.player;
    if (!room || !player || room.hostId !== player.id) return cb?.({ ok: false, error: 'Hanya host yang bisa pause musik bersama.' });
    if (!room.music?.song) return cb?.({ ok: false, error: 'Belum ada musik bersama.' });
    setRoomMusic(room, {
      status: 'paused',
      song: room.music.song,
      startedAt: null,
      positionSec: Math.max(0, Number(positionSec || 0)),
      by: player.name
    });
    cb?.({ ok: true, music: publicMusic(room.music) });
  });

  socket.on('music:room-stop', (_data = {}, cb) => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const player = ctx?.player;
    if (!room || !player || room.hostId !== player.id) return cb?.({ ok: false, error: 'Hanya host yang bisa stop musik bersama.' });
    setRoomMusic(room, { status: 'stopped', song: null, startedAt: null, positionSec: 0, by: player.name });
    cb?.({ ok: true });
  });

  socket.on('music:room-request', (_data = {}, cb) => {
    const room = findRoomBySocket(socket.id);
    if (!room) return cb?.({ ok: false, error: 'Belum berada di room.' });
    socket.emit('music:room-state', publicMusic(room.music));
    cb?.({ ok: true, music: publicMusic(room.music) });
  });

  socket.on('voice:join', () => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const p = ctx?.player;
    if (!room || !p) return;
    const peers = [...room.voice].filter(id => id !== p.id && room.players.get(id)?.connected);
    room.voice.add(p.id);
    socket.emit('voice:peers', { peers });
    for (const peerId of peers) io.to(peerId).emit('voice:peer-joined', { peerId: p.id, name: p.name });
    sendState(room);
  });

  socket.on('voice:leave', () => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const p = ctx?.player;
    if (!room || !p) return;
    room.voice.delete(p.id);
    io.to(room.code).emit('voice:peer-left', { peerId: p.id });
    sendState(room);
  });

  socket.on('voice:signal', ({ to, signal } = {}) => {
    const ctx = getPlayerBySocket(socket.id);
    const room = ctx?.room;
    const p = ctx?.player;
    if (!room || !p || !room.voice.has(p.id) || !room.voice.has(to)) return;
    io.to(to).emit('voice:signal', { from: p.id, signal });
  });

  socket.on('disconnect', () => leaveCurrentRoom(socket));
});

let saveRoomsTimer = null;


function serializeRoom(room) {
  return {
    code: room.code,
    name: room.name,
    passwordHash: room.passwordHash || null,
    maxPlayers: room.maxPlayers || 16,
    hostId: room.hostId,
    phase: room.phase,
    gameStarted: !!room.gameStarted,
    day: room.day || 0,
    phaseEndsAt: room.phaseEndsAt || null,
    autoResetAt: room.autoResetAt || null,
    settings: room.settings,
    players: [...room.players.values()].map(p => ({ ...p, socketId: null, connected: false, lastDisconnectAt: p.lastDisconnectAt || Date.now() })),
    logs: room.logs || [],
    nightActions: [...(room.nightActions || new Map()).entries()],
    votes: [...(room.votes || new Map()).entries()],
    mayorVotes: [...(room.mayorVotes || new Map()).entries()],
    mayorResolved: !!room.mayorResolved,
    invitedAccounts: [...(room.invitedAccounts || new Set()).values()],
    music: room.music || {},
    hunterQueue: room.hunterQueue || [],
    hunterNext: room.hunterNext || null,
    gameOver: room.gameOver || null,
    nightEvent: room.nightEvent || null,
    rewardsGranted: !!room.rewardsGranted,
    createdAt: room.createdAt || Date.now(),
    updatedAt: room.updatedAt || Date.now(),
    lastEmptyAt: room.lastEmptyAt || Date.now()
  };
}
function hydrateRoom(raw) {
  const room = newRoom(raw.code, raw.hostId, 'Host', { roomName: raw.name || 'Lobby Werewolf' });
  room.passwordHash = raw.passwordHash || null;
  room.maxPlayers = raw.maxPlayers || 16;
  room.hostId = raw.hostId;
  room.phase = raw.phase || 'lobby';
  room.gameStarted = !!raw.gameStarted;
  room.roundId = raw.roundId || null;
  if (!room.gameStarted && room.phase !== 'lobby') room.phase = 'lobby';
  room.day = raw.day || 0;
  room.phaseEndsAt = raw.phaseEndsAt || null;
  room.autoResetAt = raw.autoResetAt || null;
  room.settings = { ...room.settings, ...(raw.settings || {}) };
  room.players = new Map((raw.players || []).map(p => [p.id, { ...p, socketId: null, connected: false, lastDisconnectAt: Date.now() }]));
  // If a room is restored as lobby/not-started, wipe any stale role state from older versions.
  if (!room.gameStarted || room.phase === 'lobby') {
    room.phase = 'lobby';
    room.gameStarted = false;
    for (const player of room.players.values()) clearPlayerRoundRoleState(player, true);
  }
  room.logs = Array.isArray(raw.logs) ? raw.logs.slice(-100) : [];
  room.nightActions = new Map(raw.nightActions || []);
  room.votes = new Map(raw.votes || []);
  room.mayorVotes = new Map(raw.mayorVotes || []);
  room.mayorResolved = !!raw.mayorResolved;
  room.invitedAccounts = new Set(raw.invitedAccounts || []);
  room.voice = new Set();
  room.music = raw.music || room.music;
  room.hunterQueue = raw.hunterQueue || [];
  room.hunterNext = raw.hunterNext || null;
  room.gameOver = raw.gameOver || null;
  room.nightEvent = raw.nightEvent || null;
  room.rewardsGranted = !!raw.rewardsGranted;
  room.createdAt = raw.createdAt || Date.now();
  room.updatedAt = raw.updatedAt || Date.now();
  room.lastEmptyAt = Date.now();
  room.timer = null;
  room.autoResetTimer = null;
  return room;
}
function saveRoomsSoon() {
  clearTimeout(saveRoomsTimer);
  saveRoomsTimer = setTimeout(() => {
    try {
      const payload = { savedAt: Date.now(), rooms: [...rooms.values()].map(serializeRoom) };
      fs.writeFileSync(ROOMS_FILE, JSON.stringify(payload, null, 2));
    } catch (error) { console.error('[ROOMS] Gagal simpan rooms:', error.message); }
  }, 250);
}
function loadPersistedRooms() {
  try {
    if (!fs.existsSync(ROOMS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf8'));
    const list = Array.isArray(raw.rooms) ? raw.rooms : [];
    for (const item of list) {
      if (!item?.code || rooms.has(item.code)) continue;
      const room = hydrateRoom(item);
      rooms.set(room.code, room);
    }
    for (const room of rooms.values()) resumeRoomTimers(room, true);
    if (rooms.size) console.log(`[ROOMS] Loaded ${rooms.size} persisted room(s).`);
  } catch (error) { console.error('[ROOMS] Gagal load persisted rooms:', error.message); }
}
function resumeRoomTimers(room, fromBoot = false) {
  clearRoomTimer(room);
  if (!room.gameStarted && room.phase !== 'gameOver') {
    room.phase = 'lobby';
    room.mayorVotes?.clear?.();
    room.mayorResolved = false;
    for (const player of room.players.values()) clearPlayerRoundRoleState(player, true);
  }
  if (room.phase === 'lobby') { sendState(room); return; }
  if (!room.gameStarted || ![...room.players.values()].some(p => p.role)) {
    room.phase = 'lobby';
    room.gameStarted = false;
    room.roundId = null;
    sendState(room);
    return;
  }
  const now = Date.now();
  const graceMs = 20000;
  if (room.phase === 'gameOver') {
    if (!room.autoResetAt || room.autoResetAt <= now) room.autoResetAt = now + graceMs;
    room.autoResetTimer = setTimeout(() => { if (rooms.has(room.code) && room.phase === 'gameOver') resetRoom(room, { auto: true }); }, Math.max(1000, room.autoResetAt - now));
    sendState(room);
    return;
  }
  if (!room.phaseEndsAt || room.phaseEndsAt <= now) {
    room.phaseEndsAt = now + graceMs;
    room.logs.push({ id: nowId(), text: 'Server baru pulih. Timer diberi waktu 20 detik agar pemain bisa reconnect.', type: 'warn', at: now });
  }
  if (room.phase === 'mayorVote' && allAliveMayorVotesSubmitted(room)) {
    return setTimeout(() => { if (rooms.has(room.code)) resolveMayorVote(room); }, fromBoot ? 1200 : 250);
  }
  const phase = room.phase;
  const delay = Math.max(1000, room.phaseEndsAt - Date.now());
  room.timer = setTimeout(() => {
    room.timer = null;
    if (!rooms.has(room.code) || room.phase !== phase) return;
    if (phase === 'roleReveal') return startMayorVote(room);
    if (phase === 'mayorVote') return resolveMayorVote(room);
    if (phase === 'night') return resolveNight(room);
    if (phase === 'day') return startVoting(room);
    if (phase === 'voting') return resolveVoting(room);
    if (phase === 'hunter') {
      room.hunterQueue.shift();
      if (checkWin(room)) return;
      const next = room.hunterNext || 'night';
      if (room.hunterQueue.length) return startHunter(room, room.hunterQueue[0], next);
      room.hunterNext = null;
      return next === 'day' ? startDay(room) : startNight(room);
    }
  }, delay);
  sendState(room);
}

loadPersistedRooms();

setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 60 * 8;
  let changedRoomList = false;
  for (const [code, room] of rooms.entries()) {
    if (![...room.players.values()].some(p => p.connected) && (room.lastEmptyAt || room.createdAt) < Date.now() - RECONNECT_TTL_MS) { rooms.delete(code); changedRoomList = true; continue; }
    for (const [playerId, player] of room.players.entries()) {
      if (!player.connected && player.lastDisconnectAt && player.lastDisconnectAt < Date.now() - RECONNECT_TTL_MS && room.phase === 'lobby') {
        room.players.delete(playerId);
        changedRoomList = true;
      }
    }
  }
  if (changedRoomList) { emitRoomList(); saveRoomsSoon(); }
}, 1000 * 60 * 30);

process.on('SIGTERM', () => { try { fs.writeFileSync(ROOMS_FILE, JSON.stringify({ savedAt: Date.now(), rooms: [...rooms.values()].map(serializeRoom) }, null, 2)); } catch (_) {} process.exit(0); });
process.on('SIGINT', () => { try { fs.writeFileSync(ROOMS_FILE, JSON.stringify({ savedAt: Date.now(), rooms: [...rooms.values()].map(serializeRoom) }, null, 2)); } catch (_) {} process.exit(0); });

server.listen(PORT, HOST, () => {
  console.log(`Werewolf Online ready on port ${PORT}`);
});
