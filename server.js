const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const yts = require('yt-search');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 30000
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, name: 'werewolf-by-ryuu' }));

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

function cleanClientId(id) {
  const raw = String(id || '').trim();
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return safe || `p_${nowId()}`;
}

function cleanName(name) {
  const n = String(name || '').replace(/<[^>]*>/g, '').trim();
  return n.slice(0, 18) || 'Player';
}

function newRoom(code, hostPlayerId, hostName) {
  return {
    code,
    hostId: hostPlayerId,
    phase: 'lobby',
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
    voice: new Set(),
    hunterQueue: [],
    gameOver: null,
    createdAt: Date.now(),
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
    avatar: p.avatar
  };
}

function roomPublic(room) {
  return {
    code: room.code,
    phase: room.phase,
    day: room.day,
    settings: room.settings,
    phaseEndsAt: room.phaseEndsAt,
    players: [...room.players.values()].map(p => playerPublic(room, p)),
    logs: room.logs.slice(-60),
    voteState: getVoteState(room),
    mayorState: getMayorVoteState(room),
    gameOver: room.gameOver,
    autoResetAt: room.autoResetAt || null
  };
}

function privateState(room, id) {
  const p = room.players.get(id);
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    roleMeta: p.role ? ROLE_META[p.role] : null,
    alive: p.alive,
    isHost: p.id === room.hostId,
    isMayor: !!p.isMayor,
    witchHealUsed: !!p.witchHealUsed,
    witchPoisonUsed: !!p.witchPoisonUsed,
    lastInfo: p.lastInfo || '',
    actionDone: [...room.nightActions.values()].some(a => a.actor === p.id),
    voteTarget: room.votes.get(p.id) || null,
    mayorVoteTarget: room.mayorVotes.get(p.id) || null
  };
}

function sendState(room) {
  io.to(room.code).emit('room:state', roomPublic(room));
  for (const p of room.players.values()) {
    io.to(p.id).emit('me:state', privateState(room, p.id));
  }
}

function addLog(room, text, type = 'info') {
  room.logs.push({ id: nowId(), text, type, at: Date.now() });
  if (room.logs.length > 100) room.logs.shift();
  io.to(room.code).emit('room:log', room.logs[room.logs.length - 1]);
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
  sendState(room);
  room.timer = setTimeout(() => {
    room.timer = null;
    if (rooms.has(room.code) && room.phase === phase) onEnd?.();
  }, seconds * 1000);
}

function roleDeckFor(count) {
  const wolves = count >= 10 ? 3 : count >= 7 ? 2 : 1;
  const deck = [];
  if (wolves >= 1) deck.push('Alpha Werewolf');
  for (let i = 1; i < wolves; i++) deck.push('Werewolf');
  const specials = ['Seer', 'Doctor', 'Hunter', 'Bodyguard', 'Witch', 'Medium'];
  if (count >= 7) specials.push('Jester');
  for (const role of specials) {
    if (deck.length < count) deck.push(role);
  }
  while (deck.length < count) deck.push('Villager');
  return shuffle(deck).slice(0, count);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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
  room.day = 0;
  room.logs = [];
  room.nightActions.clear();
  room.votes.clear();
  room.mayorVotes.clear();
  room.hunterQueue = [];
  room.gameOver = null;
  for (const p of room.players.values()) {
    p.role = null;
    p.alive = p.connected;
    p.isMayor = false;
    p.publicRole = null;
    p.lastInfo = '';
    p.witchHealUsed = false;
    p.witchPoisonUsed = false;
  }
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
  room.mayorVotes.clear();
  narrative(room, 'Pemilihan Kepala Desa', 'Semua pemain hidup memilih Kades. Saat voting eliminasi, suara Kades bernilai 2.', 'amber');
  setPhase(room, 'mayorVote', room.settings.mayorVoteSec, () => resolveMayorVote(room));
}

function getMayorVoteState(room) {
  const counts = {};
  for (const targetId of room.mayorVotes.values()) counts[targetId] = (counts[targetId] || 0) + 1;
  return { counts, total: room.mayorVotes.size };
}

function resolveMayorVote(room) {
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

function startNight(room) {
  if (checkWin(room)) return;
  room.day += 1;
  room.nightActions.clear();
  room.votes.clear();
  for (const p of room.players.values()) p.lastInfo = '';
  narrative(room, `Malam ${room.day}`, 'Desa menjadi sunyi. Role malam mulai bergerak dalam bayangan.', 'dark');
  for (const p of alivePlayers(room)) {
    const meta = ROLE_META[p.role];
    if (['Werewolf','Alpha Werewolf','Seer','Doctor','Hunter','Bodyguard','Witch','Medium'].includes(p.role)) {
      personalAnim(p.id, 'nightRole', `${meta.emoji} Giliran ${p.role}`, nightHintFor(p), { role: p.role, aura: meta.aura });
    }
  }
  setPhase(room, 'night', room.settings.nightSec, () => resolveNight(room));
}

function nightHintFor(p) {
  switch (p.role) {
    case 'Werewolf':
    case 'Alpha Werewolf': return 'Pilih target untuk dimangsa bersama tim Werewolf.';
    case 'Seer': return 'Pilih satu pemain untuk diterawang.';
    case 'Doctor': return 'Pilih satu pemain untuk dilindungi.';
    case 'Bodyguard': return 'Pilih satu pemain untuk dijaga. Kamu bisa berkorban untuknya.';
    case 'Witch': return 'Pilih aksi heal atau poison. Tiap ramuan hanya bisa dipakai sekali.';
    case 'Medium': return 'Kamu bisa membaca chat pemain mati. Gunakan informasi arwah saat siang.';
    default: return 'Tetap diam dan perhatikan tanda-tanda mencurigakan.';
  }
}

function actionNeeded(p) {
  if (!p.alive) return false;
  return ['Werewolf','Alpha Werewolf','Seer','Doctor','Bodyguard'].includes(p.role) || (p.role === 'Witch' && (!p.witchHealUsed || !p.witchPoisonUsed));
}

function submitNightAction(room, socket, data) {
  const p = getPlayerBySocket(socket.id)?.player;
  if (!p || !p.alive || room.phase !== 'night') return;
  const target = room.players.get(data?.targetId);
  const type = String(data?.type || 'main');

  if (['Werewolf','Alpha Werewolf'].includes(p.role)) {
    if (!target || !target.alive || ROLE_META[target.role]?.team === 'werewolf') return;
    room.nightActions.set(p.id, { actor: p.id, role: p.role, type: 'kill', target: target.id });
    personalAnim(p.id, 'attack', 'Target Ditandai', `${target.name} menjadi target seranganmu malam ini.`, { aura: 'blood' });
    emitWolves(room, 'werewolf:choice', { actorName: p.name, targetName: target.name });
  } else if (p.role === 'Seer') {
    if (!target || !target.alive || target.id === p.id) return;
    room.nightActions.set(p.id, { actor: p.id, role: p.role, type: 'scan', target: target.id });
    const meta = ROLE_META[target.role];
    p.lastInfo = `${target.name} adalah ${target.role} (${meta.team}).`;
    personalAnim(p.id, 'seer', 'Hasil Terawangan', p.lastInfo, { aura: 'violet' });
  } else if (p.role === 'Doctor') {
    if (!target || !target.alive) return;
    room.nightActions.set(p.id, { actor: p.id, role: p.role, type: 'protect', target: target.id });
    personalAnim(p.id, 'heal', 'Perlindungan Diberikan', `${target.name} kamu lindungi malam ini.`, { aura: 'green' });
  } else if (p.role === 'Bodyguard') {
    if (!target || !target.alive || target.id === p.id) return;
    room.nightActions.set(p.id, { actor: p.id, role: p.role, type: 'guard', target: target.id });
    personalAnim(p.id, 'guard', 'Penjagaan Aktif', `Kamu berjaga di dekat ${target.name}.`, { aura: 'blue' });
  } else if (p.role === 'Witch') {
    if (!target || !target.alive) return;
    if (type === 'heal' && !p.witchHealUsed) {
      room.nightActions.set(`${p.id}:heal`, { actor: p.id, role: p.role, type: 'witchHeal', target: target.id });
      p.witchHealUsed = true;
      personalAnim(p.id, 'heal', 'Ramuan Heal Dipakai', `${target.name} akan diselamatkan jika diserang.`, { aura: 'green' });
    }
    if (type === 'poison' && !p.witchPoisonUsed && target.id !== p.id) {
      room.nightActions.set(`${p.id}:poison`, { actor: p.id, role: p.role, type: 'witchPoison', target: target.id });
      p.witchPoisonUsed = true;
      personalAnim(p.id, 'poison', 'Ramuan Poison Dipakai', `${target.name} terkena kutukan racun.`, { aura: 'green' });
    }
  }
  sendState(room);

  const needed = alivePlayers(room).filter(actionNeeded).length;
  const doneActors = new Set([...room.nightActions.values()].map(a => a.actor));
  if (needed > 0 && doneActors.size >= needed) {
    setTimeout(() => {
      if (rooms.has(room.code) && room.phase === 'night') resolveNight(room);
    }, 900);
  }
}

function emitWolves(room, event, payload) {
  for (const p of room.players.values()) {
    if (p.alive && ROLE_META[p.role]?.team === 'werewolf') io.to(p.id).emit(event, payload);
  }
}

function resolveNight(room) {
  clearRoomTimer(room);
  const actions = [...room.nightActions.values()];
  const killCounts = new Map();
  for (const a of actions.filter(a => a.type === 'kill')) killCounts.set(a.target, (killCounts.get(a.target) || 0) + (a.role === 'Alpha Werewolf' ? 2 : 1));
  let wolfTargetId = null;
  let wolfScore = -1;
  for (const [id, score] of killCounts.entries()) {
    if (score > wolfScore) { wolfScore = score; wolfTargetId = id; }
  }

  const protectedIds = new Set(actions.filter(a => a.type === 'protect' || a.type === 'witchHeal').map(a => a.target));
  const guardActions = actions.filter(a => a.type === 'guard');
  const poisonTargets = actions.filter(a => a.type === 'witchPoison').map(a => a.target);
  const deaths = [];
  const saved = [];

  if (wolfTargetId) {
    const guard = guardActions.find(a => a.target === wolfTargetId);
    if (protectedIds.has(wolfTargetId)) {
      saved.push(wolfTargetId);
    } else if (guard) {
      deaths.push({ id: guard.actor, reason: 'berkorban sebagai Bodyguard' });
      saved.push(wolfTargetId);
    } else {
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
      killPlayer(room, target, reason, 'night');
      deadNames.push(target.name);
    }
  }

  if (deadNames.length) {
    narrative(room, 'Korban Malam', `${deadNames.join(', ')} ditemukan tidak bernyawa.`, 'blood');
  } else {
    narrative(room, 'Malam Tanpa Korban', 'Tidak ada pemain yang mati malam ini. Desa masih punya harapan.', 'green');
  }

  if (checkWin(room)) return;
  startDay(room);
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

function getVoteState(room) {
  const counts = {};
  for (const [voterId, targetId] of room.votes.entries()) {
    const voter = room.players.get(voterId);
    const target = room.players.get(targetId);
    if (!voter?.alive || !target?.alive) continue;
    counts[targetId] = (counts[targetId] || 0) + (voter.isMayor ? 2 : 1);
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
    const weight = voter.isMayor ? 2 : 1;
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
    killPlayer(room, target, 'dieliminasi oleh voting desa', 'vote');
    target.publicRole = target.role;
    roomAnim(room, 'execution', 'Eliminasi Desa', `${target.name} dieliminasi. Role-nya: ${target.role}.`, { targetId: target.id, role: target.role });
    if (target.role === 'Jester') {
      return endGame(room, 'jester', `${target.name} adalah Jester dan menang karena berhasil dieliminasi!`);
    }
    if (target.role === 'Hunter') {
      room.hunterQueue.push(target.id);
      return startHunter(room, target.id);
    }
  }
  if (checkWin(room)) return;
  startNight(room);
}

function startHunter(room, hunterId) {
  const hunter = room.players.get(hunterId);
  if (!hunter) return startNight(room);
  narrative(room, 'Hunter Revenge', `${hunter.name} adalah Hunter. Ia boleh menembak satu pemain sebelum gugur sepenuhnya.`, 'amber');
  personalAnim(hunterId, 'hunter', 'Kesempatan Terakhir', 'Pilih satu pemain untuk ditembak.', { aura: 'amber' });
  setPhase(room, 'hunter', room.settings.hunterSec, () => {
    room.hunterQueue.shift();
    if (checkWin(room)) return;
    startNight(room);
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
  if (target.role === 'Hunter') room.hunterQueue.push(target.id);
  if (checkWin(room)) return;
  if (room.hunterQueue.length) return startHunter(room, room.hunterQueue[0]);
  startNight(room);
}

function killPlayer(room, target, reason, source) {
  if (!target.alive) return;
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

function resetRoom(room, options = {}) {
  clearRoomTimer(room);
  clearAutoResetTimer(room);
  room.phase = 'lobby';
  room.day = 0;
  room.nightActions.clear();
  room.votes.clear();
  room.mayorVotes.clear();
  room.hunterQueue = [];
  room.gameOver = null;
  for (const p of room.players.values()) {
    p.role = null;
    p.alive = true;
    p.isMayor = false;
    p.publicRole = null;
    p.lastInfo = '';
    p.witchHealUsed = false;
    p.witchPoisonUsed = false;
  }
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

function reconnectPlayer(socket, room, player, name, cb, source = 'reconnect') {
  leaveCurrentRoom(socket, true);
  const wasDisconnected = !player.connected;
  if (name && room.phase === 'lobby') player.name = cleanName(name);
  bindSocketToPlayer(socket, room, player);
  addLog(room, wasDisconnected ? `${player.name} tersambung kembali.` : `${player.name} membuka ulang koneksi.`, 'info');
  sendState(room);
  personalAnim(player.id, 'reconnect', 'Reconnect Berhasil', `Kamu kembali ke room ${room.code}.`, { aura: 'green' });
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

  if (room.hostId === p.id) {
    const next = [...room.players.values()].find(x => x.connected && x.id !== p.id);
    if (next) {
      room.hostId = next.id;
      addLog(room, `${next.name} menjadi host baru.`, 'info');
    }
  }

  if (![...room.players.values()].some(x => x.connected)) {
    room.lastEmptyAt = Date.now();
    clearRoomTimer(room);
  }

  if (!silent) sendState(room);
}


io.on('connection', socket => {
  socket.on('room:create', ({ name, clientId } = {}, cb) => {
    leaveCurrentRoom(socket, true);
    const code = makeCode();
    const playerId = cleanClientId(clientId);
    const room = newRoom(code, playerId, cleanName(name));
    const p = {
      id: playerId,
      socketId: socket.id,
      name: cleanName(name),
      role: null,
      alive: true,
      connected: true,
      lastDisconnectAt: null,
      isMayor: false,
      publicRole: null,
      avatar: `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(playerId)}`
    };
    room.players.set(playerId, p);
    rooms.set(code, room);
    bindSocketToPlayer(socket, room, p);
    addLog(room, `${p.name} membuat room ${code}.`, 'info');
    sendState(room);
    cb?.({ ok: true, code, playerId });
  });

  socket.on('room:join', ({ code, name, clientId } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return cb?.({ ok: false, error: 'Room tidak ditemukan.' });
    const playerId = cleanClientId(clientId);
    const existing = room.players.get(playerId);
    if (existing) return reconnectPlayer(socket, room, existing, name, cb, 'join-reconnect');
    if (room.phase !== 'lobby') return cb?.({ ok: false, error: 'Game sudah dimulai. Kamu hanya bisa reconnect jika pernah join dari perangkat/browser ini.' });

    leaveCurrentRoom(socket, true);
    const p = {
      id: playerId,
      socketId: socket.id,
      name: cleanName(name),
      role: null,
      alive: true,
      connected: true,
      lastDisconnectAt: null,
      isMayor: false,
      publicRole: null,
      avatar: `https://api.dicebear.com/8.x/bottts-neutral/svg?seed=${encodeURIComponent(playerId)}`
    };
    room.players.set(playerId, p);
    bindSocketToPlayer(socket, room, p);
    addLog(room, `${p.name} bergabung.`, 'info');
    sendState(room);
    cb?.({ ok: true, code: room.code, playerId: p.id });
  });

  socket.on('room:reconnect', ({ code, playerId, name } = {}, cb) => {
    const room = rooms.get(String(code || '').toUpperCase().trim());
    if (!room) return cb?.({ ok: false, error: 'Room reconnect tidak ditemukan.' });
    const player = room.players.get(cleanClientId(playerId));
    if (!player) return cb?.({ ok: false, error: 'Session pemain tidak ditemukan di room ini.' });
    reconnectPlayer(socket, room, player, name, cb, 'reconnect');
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
      if (!room.players.size) rooms.delete(room.code);
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
      return startNight(room);
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
    if (!room || room.phase !== 'mayorVote' || !voter?.alive || !target?.alive) return;
    room.mayorVotes.set(voter.id, targetId);
    sendState(room);
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
    room.votes.set(voter.id, targetId);
    personalAnim(voter.id, 'vote', 'Vote Terkunci', `Kamu memilih ${target.name}.${voter.isMayor ? ' Suaramu bernilai 2.' : ''}`, { aura: 'amber' });
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

setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 60 * 8;
  for (const [code, room] of rooms.entries()) {
    if (![...room.players.values()].some(p => p.connected) && (room.lastEmptyAt || room.createdAt) < Date.now() - RECONNECT_TTL_MS) rooms.delete(code);
    for (const [playerId, player] of room.players.entries()) {
      if (!player.connected && player.lastDisconnectAt && player.lastDisconnectAt < Date.now() - RECONNECT_TTL_MS && room.phase === 'lobby') {
        room.players.delete(playerId);
      }
    }
  }
}, 1000 * 60 * 30);

server.listen(PORT, HOST, () => {
  console.log(`Werewolf Online ready on port ${PORT}`);
});
