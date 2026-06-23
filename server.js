const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 30000,
  pingInterval: 10000,
});

const PORT = process.env.PORT || 3000;
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true, rooms: rooms.size }));

const ROLE_INFO = {
  werewolf: {
    name: 'Werewolf',
    team: 'Werewolf',
    emoji: '🐺',
    desc: 'Saat malam, pilih korban bersama Werewolf lain. Menang jika jumlah Werewolf sama atau lebih banyak dari warga.',
  },
  villager: {
    name: 'Villager',
    team: 'Village',
    emoji: '🧑',
    desc: 'Tidak punya skill malam. Gunakan diskusi dan voting untuk menemukan Werewolf.',
  },
  seer: {
    name: 'Seer',
    team: 'Village',
    emoji: '🔮',
    desc: 'Saat malam, cek satu pemain untuk mengetahui apakah dia Werewolf atau bukan.',
  },
  doctor: {
    name: 'Doctor',
    team: 'Village',
    emoji: '🩺',
    desc: 'Saat malam, lindungi satu pemain agar tidak mati jika diserang Werewolf.',
  },
  hunter: {
    name: 'Hunter',
    team: 'Village',
    emoji: '🏹',
    desc: 'Jika mati, kamu mendapat kesempatan terakhir untuk menembak satu pemain.',
  },
};

function makeRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return rooms.has(code) ? makeRoomCode() : code;
}

function safeName(name) {
  return String(name || '').trim().slice(0, 18).replace(/[<>]/g, '') || 'Player';
}

function makePlayer(clientId, socketId, name) {
  return {
    clientId,
    socketId,
    name: safeName(name),
    connected: true,
    alive: true,
    role: null,
    lastSeen: Date.now(),
    isReady: false,
    isMayor: false,
  };
}

function defaultSettings() {
  return {
    werewolfCount: 1,
    seerCount: 1,
    doctorCount: 1,
    hunterCount: 0,
    mayorSeconds: 35,
    nightSeconds: 45,
    daySeconds: 120,
    voteSeconds: 45,
    hunterSeconds: 25,
    autoPreset: true,
  };
}

function createRoom(hostClientId, hostSocketId, hostName) {
  const code = makeRoomCode();
  const host = makePlayer(hostClientId, hostSocketId, hostName);
  const room = {
    code,
    hostClientId,
    phase: 'lobby',
    dayNumber: 0,
    players: new Map([[hostClientId, host]]),
    messages: [],
    privateMessages: new Map(),
    settings: defaultSettings(),
    timer: null,
    timerEndsAt: null,
    nightActions: {},
    votes: {},
    mayorVotes: {},
    revealed: [],
    lastKilled: null,
    hunterPendingClientId: null,
    afterHunterPhase: null,
    endedReason: '',
    mayorClientId: null,
    currentNarration: null,
    voiceUsers: new Map(),
  };
  rooms.set(code, room);
  return room;
}

function findPlayerBySocket(socketId) {
  for (const room of rooms.values()) {
    for (const player of room.players.values()) {
      if (player.socketId === socketId) return { room, player };
    }
  }
  return null;
}

function getConnectedSocket(clientId, room) {
  const p = room.players.get(clientId);
  if (!p || !p.socketId) return null;
  return io.sockets.sockets.get(p.socketId) || null;
}

function emitToPlayer(room, clientId, event, payload) {
  const sock = getConnectedSocket(clientId, room);
  if (sock) sock.emit(event, payload);
}

function systemLog(room, text, important = false, type = 'system', name = 'System') {
  room.messages.push({
    id: Date.now() + Math.random(),
    type,
    name,
    text,
    important,
    at: Date.now(),
  });
  if (room.messages.length > 160) room.messages.shift();
}

function narrate(room, text) {
  room.currentNarration = { text, at: Date.now() };
  systemLog(room, text, true, 'narrator', 'Narator');
}

function privateLog(room, clientId, text) {
  if (!room.privateMessages.has(clientId)) room.privateMessages.set(clientId, []);
  const arr = room.privateMessages.get(clientId);
  arr.push({ id: Date.now() + Math.random(), type: 'private', name: 'Secret', text, at: Date.now() });
  if (arr.length > 70) arr.shift();
}

function wolfLog(room, text) {
  for (const p of room.players.values()) {
    if (p.role === 'werewolf') privateLog(room, p.clientId, text);
  }
}

function publicPlayers(room, viewerClientId) {
  const ended = room.phase === 'ended';
  const viewer = room.players.get(viewerClientId);
  return [...room.players.values()].map(p => {
    const revealRole = ended || p.clientId === viewerClientId || !p.alive || (viewer?.role === 'werewolf' && p.role === 'werewolf');
    return {
      clientId: p.clientId,
      name: p.name,
      connected: p.connected,
      alive: p.alive,
      isHost: p.clientId === room.hostClientId,
      isMe: p.clientId === viewerClientId,
      role: revealRole ? p.role : null,
      roleInfo: revealRole ? ROLE_INFO[p.role] : null,
      isReady: p.isReady,
      isMayor: p.isMayor,
      inVoice: room.voiceUsers.has(p.clientId),
      voiceMuted: room.voiceUsers.get(p.clientId)?.muted || false,
    };
  });
}

function roleCounts(room) {
  const counts = { werewolf: 0, villager: 0, seer: 0, doctor: 0, hunter: 0 };
  for (const p of room.players.values()) if (p.role) counts[p.role] = (counts[p.role] || 0) + 1;
  return counts;
}

function sanitizeSettings(input, playerCount) {
  const s = defaultSettings();
  const clamp = (v, min, max, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
  };
  s.autoPreset = Boolean(input.autoPreset);
  s.werewolfCount = clamp(input.werewolfCount, 1, Math.max(1, playerCount - 1), 1);
  s.seerCount = clamp(input.seerCount, 0, 1, 1);
  s.doctorCount = clamp(input.doctorCount, 0, 1, 1);
  s.hunterCount = clamp(input.hunterCount, 0, 1, playerCount >= 6 ? 1 : 0);
  s.mayorSeconds = clamp(input.mayorSeconds, 15, 180, 35);
  s.nightSeconds = clamp(input.nightSeconds, 20, 300, 45);
  s.daySeconds = clamp(input.daySeconds, 30, 600, 120);
  s.voteSeconds = clamp(input.voteSeconds, 20, 300, 45);
  s.hunterSeconds = clamp(input.hunterSeconds, 10, 120, 25);
  return s;
}

function applyAutoPreset(room) {
  const n = room.players.size;
  const s = room.settings;
  if (!s.autoPreset) return;

  if (n <= 5) {
    s.werewolfCount = 1;
    s.seerCount = 1;
    s.doctorCount = n >= 4 ? 1 : 0;
    s.hunterCount = 0;
  } else if (n <= 7) {
    s.werewolfCount = 1;
    s.seerCount = 1;
    s.doctorCount = 1;
    s.hunterCount = 1;
  } else if (n <= 10) {
    s.werewolfCount = 2;
    s.seerCount = 1;
    s.doctorCount = 1;
    s.hunterCount = 1;
  } else {
    s.werewolfCount = Math.max(2, Math.floor(n / 4));
    s.seerCount = 1;
    s.doctorCount = 1;
    s.hunterCount = 1;
  }
}

function validateGameStart(room) {
  const totalPlayers = room.players.size;
  if (totalPlayers < 4) return 'Minimal 4 pemain untuk mulai.';
  applyAutoPreset(room);
  const s = room.settings;
  const special = s.werewolfCount + s.seerCount + s.doctorCount + s.hunterCount;
  if (s.werewolfCount < 1) return 'Minimal harus ada 1 Werewolf.';
  if (special > totalPlayers) return 'Jumlah role lebih banyak dari jumlah pemain.';
  if (s.werewolfCount >= totalPlayers) return 'Werewolf tidak boleh sama/banyak dari semua pemain.';
  return null;
}

function shuffled(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function assignRoles(room) {
  const players = shuffled([...room.players.values()]);
  const roles = [];
  for (let i = 0; i < room.settings.werewolfCount; i++) roles.push('werewolf');
  for (let i = 0; i < room.settings.seerCount; i++) roles.push('seer');
  for (let i = 0; i < room.settings.doctorCount; i++) roles.push('doctor');
  for (let i = 0; i < room.settings.hunterCount; i++) roles.push('hunter');
  while (roles.length < players.length) roles.push('villager');
  const shuffledRoles = shuffled(roles);
  players.forEach((p, idx) => {
    p.role = shuffledRoles[idx];
    p.alive = true;
    p.isReady = false;
    p.isMayor = false;
  });
  room.mayorClientId = null;
}

function clearRoomTimer(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  room.timerEndsAt = null;
}

function setPhaseTimer(room, seconds, callback) {
  clearRoomTimer(room);
  room.timerEndsAt = Date.now() + seconds * 1000;
  room.timer = setTimeout(() => {
    room.timer = null;
    room.timerEndsAt = null;
    callback();
  }, seconds * 1000);
}

function sendState(room) {
  const mayor = room.mayorClientId ? room.players.get(room.mayorClientId) : null;
  const base = {
    code: room.code,
    phase: room.phase,
    dayNumber: room.dayNumber,
    hostClientId: room.hostClientId,
    settings: room.settings,
    timerEndsAt: room.timerEndsAt,
    messages: room.messages,
    revealed: room.revealed,
    lastKilled: room.lastKilled,
    mayorClientId: room.mayorClientId,
    mayorName: mayor?.name || null,
    currentNarration: room.currentNarration,
    roleCounts: room.phase === 'ended' ? roleCounts(room) : null,
    endedReason: room.endedReason,
    roles: ROLE_INFO,
  };

  for (const player of room.players.values()) {
    if (!player.socketId) continue;
    const sock = getConnectedSocket(player.clientId, room);
    if (!sock) continue;
    sock.emit('state', {
      ...base,
      me: {
        clientId: player.clientId,
        name: player.name,
        alive: player.alive,
        connected: player.connected,
        isHost: player.clientId === room.hostClientId,
        role: player.role,
        roleInfo: player.role ? ROLE_INFO[player.role] : null,
        isMayor: player.isMayor,
      },
      players: publicPlayers(room, player.clientId),
      privateMessages: room.privateMessages.get(player.clientId) || [],
      myVote: room.votes[player.clientId] || null,
      myMayorVote: room.mayorVotes[player.clientId] || null,
      myNightAction: room.nightActions[player.clientId] || null,
      hunterPending: room.hunterPendingClientId === player.clientId,
    });
  }
}

function alivePlayers(room) {
  return [...room.players.values()].filter(p => p.alive);
}

function aliveWolves(room) {
  return alivePlayers(room).filter(p => p.role === 'werewolf');
}

function aliveVillage(room) {
  return alivePlayers(room).filter(p => p.role !== 'werewolf');
}

function checkWin(room) {
  const wolves = aliveWolves(room).length;
  const village = aliveVillage(room).length;
  if (wolves <= 0) return { winner: 'Village', text: 'Village menang! Semua Werewolf berhasil dieliminasi.' };
  if (wolves >= village) return { winner: 'Werewolf', text: 'Werewolf menang! Jumlah Werewolf sudah sama atau lebih banyak dari warga.' };
  return null;
}

function endGame(room, reason) {
  clearRoomTimer(room);
  room.phase = 'ended';
  room.endedReason = reason.text;
  narrate(room, `Permainan berakhir. ${reason.text}`);
  systemLog(room, `🏁 ${reason.text}`, true);
  sendState(room);
}

function maybeEnd(room) {
  const result = checkWin(room);
  if (result) {
    endGame(room, result);
    return true;
  }
  return false;
}

function beginMayorVote(room) {
  room.phase = 'mayor';
  room.mayorVotes = {};
  for (const p of room.players.values()) p.isMayor = false;
  room.mayorClientId = null;
  narrate(room, 'Sebelum malam pertama turun, warga berkumpul untuk memilih Kepala Desa. Kepala Desa memiliki suara dua kali lebih kuat saat voting eliminasi.');
  systemLog(room, '👑 Voting Kepala Desa dimulai. Pilih satu pemain yang kamu percaya.', true);
  setPhaseTimer(room, room.settings.mayorSeconds, () => resolveMayorVote(room));
  sendState(room);
}

function topTarget(votesObj, room, weighted = false) {
  const counts = new Map();
  for (const [voterId, targetId] of Object.entries(votesObj)) {
    if (!targetId) continue;
    const voter = room?.players.get(voterId);
    const weight = weighted && voter?.alive && voter.isMayor ? 2 : 1;
    counts.set(targetId, (counts.get(targetId) || 0) + weight);
  }
  if (!counts.size) return null;
  let max = 0;
  for (const n of counts.values()) max = Math.max(max, n);
  const winners = [...counts.entries()].filter(([, n]) => n === max).map(([id]) => id);
  return winners[Math.floor(Math.random() * winners.length)];
}

function resolveMayorVote(room) {
  if (room.phase !== 'mayor') return;
  clearRoomTimer(room);
  const validVotes = {};
  for (const [voterId, targetId] of Object.entries(room.mayorVotes)) {
    const voter = room.players.get(voterId);
    const target = room.players.get(targetId);
    if (voter?.alive && target?.alive) validVotes[voterId] = targetId;
  }

  let mayorId = topTarget(validVotes, room, false);
  if (!mayorId) {
    const candidates = alivePlayers(room);
    mayorId = candidates[Math.floor(Math.random() * candidates.length)]?.clientId || null;
  }

  const mayor = mayorId ? room.players.get(mayorId) : null;
  if (mayor) {
    for (const p of room.players.values()) p.isMayor = false;
    mayor.isMayor = true;
    room.mayorClientId = mayor.clientId;
    narrate(room, `${mayor.name} terpilih sebagai Kepala Desa. Mulai sekarang, suaranya bernilai dua saat voting eliminasi.`);
    systemLog(room, `👑 ${mayor.name} menjadi Kepala Desa. Vote-nya bernilai x2 saat voting eliminasi selama masih hidup.`, true);
  } else {
    systemLog(room, 'Tidak ada Kepala Desa yang terpilih.', true);
  }
  beginNight(room);
}

function beginNight(room) {
  if (maybeEnd(room)) return;
  room.phase = 'night';
  room.dayNumber += 1;
  room.nightActions = {};
  room.votes = {};
  room.lastKilled = null;
  narrate(room, `Malam ${room.dayNumber} dimulai. Desa tertidur, tetapi bahaya mulai bergerak dalam gelap.`);
  systemLog(room, `🌙 Malam ${room.dayNumber} dimulai. Role malam silakan pilih aksi.`, true);
  wolfLog(room, '🐺 Channel Werewolf aktif. Pilih korban secara diam-diam.');
  setPhaseTimer(room, room.settings.nightSeconds, () => resolveNight(room));
  sendState(room);
}

function maybeHunterPhase(room, deadPlayer, afterPhase) {
  if (!deadPlayer || deadPlayer.role !== 'hunter') return false;
  const alive = alivePlayers(room);
  if (!alive.length) return false;
  room.phase = 'hunter';
  room.hunterPendingClientId = deadPlayer.clientId;
  room.afterHunterPhase = afterPhase;
  narrate(room, `Hunter telah gugur. Dalam napas terakhirnya, ia masih bisa melepaskan satu tembakan balasan.`);
  systemLog(room, `🏹 Hunter (${deadPlayer.name}) mati dan punya kesempatan menembak satu pemain.`, true);
  privateLog(room, deadPlayer.clientId, 'Kamu adalah Hunter. Pilih satu pemain untuk ditembak sebelum waktu habis.');
  setPhaseTimer(room, room.settings.hunterSeconds, () => finishHunter(room, null));
  sendState(room);
  return true;
}

function resolveNight(room) {
  if (room.phase !== 'night') return;
  clearRoomTimer(room);
  const wolfVotes = {};
  for (const [actorId, targetId] of Object.entries(room.nightActions)) {
    const actor = room.players.get(actorId);
    const target = room.players.get(targetId);
    if (actor?.alive && actor.role === 'werewolf' && target?.alive && target.role !== 'werewolf') {
      wolfVotes[actorId] = targetId;
    }
  }
  const victimId = topTarget(wolfVotes, room, false);

  let protectedId = null;
  for (const [actorId, targetId] of Object.entries(room.nightActions)) {
    const actor = room.players.get(actorId);
    const target = room.players.get(targetId);
    if (actor?.alive && actor.role === 'doctor' && target?.alive) protectedId = targetId;
  }

  let deadPlayer = null;
  if (victimId && victimId !== protectedId) {
    const victim = room.players.get(victimId);
    if (victim && victim.alive) {
      victim.alive = false;
      deadPlayer = victim;
      room.lastKilled = { name: victim.name, role: victim.role, by: 'night' };
      narrate(room, `Pagi datang, tetapi desa kehilangan satu warga. ${victim.name} ditemukan mati.`);
      systemLog(room, `☀️ Pagi datang. ${victim.name} ditemukan mati. Role-nya: ${ROLE_INFO[victim.role].emoji} ${ROLE_INFO[victim.role].name}.`, true);
    }
  } else if (victimId && victimId === protectedId) {
    const saved = room.players.get(victimId);
    narrate(room, 'Pagi datang tanpa korban. Seseorang hampir mati, tetapi berhasil diselamatkan.');
    systemLog(room, `☀️ Pagi datang. Tidak ada yang mati. Seseorang berhasil diselamatkan Doctor.`, true);
    if (saved) privateLog(room, saved.clientId, 'Kamu diserang Werewolf, tetapi berhasil dilindungi Doctor.');
  } else {
    narrate(room, 'Pagi datang dengan tenang. Tidak ada korban malam ini.');
    systemLog(room, '☀️ Pagi datang. Tidak ada korban malam ini.', true);
  }

  for (const [actorId, targetId] of Object.entries(room.nightActions)) {
    const actor = room.players.get(actorId);
    const target = room.players.get(targetId);
    if (actor?.role === 'seer' && target) {
      const result = target.role === 'werewolf' ? 'adalah Werewolf 🐺' : 'bukan Werewolf ✅';
      privateLog(room, actorId, `Hasil penerawangan: ${target.name} ${result}.`);
    }
  }

  if (maybeEnd(room)) return;
  if (maybeHunterPhase(room, deadPlayer, 'day')) return;
  beginDay(room);
}

function beginDay(room) {
  if (maybeEnd(room)) return;
  room.phase = 'day';
  room.nightActions = {};
  room.votes = {};
  narrate(room, `Siang ${room.dayNumber} dimulai. Warga harus berdiskusi, membaca gerak-gerik, dan menemukan siapa yang berbohong.`);
  systemLog(room, `☀️ Siang ${room.dayNumber} dimulai. Diskusikan siapa yang paling mencurigakan.`, true);
  setPhaseTimer(room, room.settings.daySeconds, () => beginVoting(room));
  sendState(room);
}

function beginVoting(room) {
  if (maybeEnd(room)) return;
  room.phase = 'voting';
  room.votes = {};
  const mayor = room.mayorClientId ? room.players.get(room.mayorClientId) : null;
  const mayorText = mayor?.alive ? ` Kepala Desa (${mayor.name}) memiliki suara x2.` : '';
  narrate(room, `Voting eliminasi dimulai. Warga harus memilih satu orang yang paling dicurigai.${mayorText}`);
  systemLog(room, `🗳️ Voting dimulai. Pilih satu pemain yang ingin dieliminasi.${mayorText}`, true);
  setPhaseTimer(room, room.settings.voteSeconds, () => resolveVoting(room));
  sendState(room);
}

function resolveVoting(room) {
  if (room.phase !== 'voting') return;
  clearRoomTimer(room);
  const validVotes = {};
  for (const [voterId, targetId] of Object.entries(room.votes)) {
    const voter = room.players.get(voterId);
    const target = room.players.get(targetId);
    if (voter?.alive && target?.alive) validVotes[voterId] = targetId;
  }

  const counts = new Map();
  for (const [voterId, targetId] of Object.entries(validVotes)) {
    const voter = room.players.get(voterId);
    const weight = voter?.alive && voter.isMayor ? 2 : 1;
    counts.set(targetId, (counts.get(targetId) || 0) + weight);
  }

  if (!counts.size) {
    narrate(room, 'Tidak ada keputusan malam ini. Warga gagal mencapai suara yang cukup.');
    systemLog(room, 'Tidak ada vote valid. Tidak ada yang dieliminasi.', true);
    beginNight(room);
    return;
  }

  let max = 0;
  for (const n of counts.values()) max = Math.max(max, n);
  const top = [...counts.entries()].filter(([, n]) => n === max).map(([id]) => id);
  if (top.length > 1) {
    narrate(room, 'Voting berakhir seri. Tidak ada yang dieliminasi, dan kecurigaan semakin dalam.');
    systemLog(room, 'Voting seri. Tidak ada yang dieliminasi.', true);
    beginNight(room);
    return;
  }

  const eliminated = room.players.get(top[0]);
  if (!eliminated || !eliminated.alive) {
    beginNight(room);
    return;
  }
  eliminated.alive = false;
  room.lastKilled = { name: eliminated.name, role: eliminated.role, by: 'vote' };
  narrate(room, `${eliminated.name} dieliminasi oleh keputusan warga. Role sebenarnya adalah ${ROLE_INFO[eliminated.role].name}.`);
  systemLog(room, `⚖️ ${eliminated.name} dieliminasi oleh voting. Role-nya: ${ROLE_INFO[eliminated.role].emoji} ${ROLE_INFO[eliminated.role].name}.`, true);

  if (maybeEnd(room)) return;
  if (maybeHunterPhase(room, eliminated, 'night')) return;
  beginNight(room);
}

function finishHunter(room, targetId) {
  if (room.phase !== 'hunter') return;
  clearRoomTimer(room);
  const hunterId = room.hunterPendingClientId;
  const target = targetId ? room.players.get(targetId) : null;
  if (target && target.alive && target.clientId !== hunterId) {
    target.alive = false;
    narrate(room, `Tembakan terakhir Hunter mengenai ${target.name}.`);
    systemLog(room, `🏹 Hunter menembak ${target.name}. Role-nya: ${ROLE_INFO[target.role].emoji} ${ROLE_INFO[target.role].name}.`, true);
  } else {
    narrate(room, 'Hunter tidak menggunakan tembakan terakhirnya.');
    systemLog(room, '🏹 Hunter tidak menembak siapa pun.', true);
  }

  room.hunterPendingClientId = null;
  const next = room.afterHunterPhase || 'day';
  room.afterHunterPhase = null;

  if (maybeEnd(room)) return;
  if (next === 'night') beginNight(room);
  else beginDay(room);
}

function resetToLobby(room) {
  clearRoomTimer(room);
  room.phase = 'lobby';
  room.dayNumber = 0;
  room.messages = [];
  room.privateMessages = new Map();
  room.nightActions = {};
  room.votes = {};
  room.mayorVotes = {};
  room.revealed = [];
  room.lastKilled = null;
  room.hunterPendingClientId = null;
  room.afterHunterPhase = null;
  room.endedReason = '';
  room.mayorClientId = null;
  room.currentNarration = null;
  for (const p of room.players.values()) {
    p.alive = true;
    p.role = null;
    p.isReady = false;
    p.isMayor = false;
  }
  systemLog(room, 'Room dikembalikan ke lobby.', true);
  sendState(room);
}

function removeVoiceUser(room, clientId) {
  if (!room?.voiceUsers?.has(clientId)) return;
  room.voiceUsers.delete(clientId);
  io.to(room.code).emit('voiceUserLeft', { clientId });
  sendState(room);
}

function cleanupEmptyRooms() {
  for (const [code, room] of rooms.entries()) {
    const connected = [...room.players.values()].some(p => p.connected);
    const lastSeenValues = [...room.players.values()].map(p => p.lastSeen || 0);
    const old = Date.now() - Math.max(...lastSeenValues) > 1000 * 60 * 60;
    if (!connected && old) {
      clearRoomTimer(room);
      rooms.delete(code);
    }
  }
}
setInterval(cleanupEmptyRooms, 1000 * 60 * 10);

io.on('connection', socket => {
  socket.on('createRoom', ({ name, clientId }) => {
    clientId = String(clientId || socket.id);
    const room = createRoom(clientId, socket.id, name);
    socket.join(room.code);
    systemLog(room, `${safeName(name)} membuat room.`, true);
    socket.emit('joined', { roomCode: room.code, clientId });
    sendState(room);
  });

  socket.on('joinRoom', ({ roomCode, name, clientId }) => {
    const code = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('errorMessage', 'Room tidak ditemukan.');
    if (room.phase !== 'lobby') return socket.emit('errorMessage', 'Game sudah dimulai. Tunggu game selesai atau buat room baru.');

    clientId = String(clientId || socket.id);
    const existing = room.players.get(clientId);
    if (existing) {
      existing.socketId = socket.id;
      existing.connected = true;
      existing.name = safeName(name || existing.name);
      existing.lastSeen = Date.now();
    } else {
      const duplicateName = [...room.players.values()].some(p => p.name.toLowerCase() === safeName(name).toLowerCase());
      const finalName = duplicateName ? `${safeName(name)}${Math.floor(Math.random() * 90 + 10)}` : safeName(name);
      room.players.set(clientId, makePlayer(clientId, socket.id, finalName));
      systemLog(room, `${finalName} masuk room.`, true);
    }
    socket.join(code);
    socket.emit('joined', { roomCode: code, clientId });
    applyAutoPreset(room);
    sendState(room);
  });

  socket.on('reconnectRoom', ({ roomCode, clientId }) => {
    const code = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    const p = room?.players.get(String(clientId || ''));
    if (!room || !p) return socket.emit('errorMessage', 'Tidak bisa reconnect. Room atau pemain tidak ditemukan.');
    p.socketId = socket.id;
    p.connected = true;
    p.lastSeen = Date.now();
    socket.join(code);
    socket.emit('joined', { roomCode: code, clientId: p.clientId });
    systemLog(room, `${p.name} reconnect.`, false);
    sendState(room);
  });

  socket.on('leaveRoom', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    removeVoiceUser(room, player.clientId);
    if (room.phase === 'lobby') {
      room.players.delete(player.clientId);
      systemLog(room, `${player.name} keluar room.`, true);
      if (room.hostClientId === player.clientId) {
        const nextHost = [...room.players.values()][0];
        if (nextHost) room.hostClientId = nextHost.clientId;
      }
      if (!room.players.size) {
        clearRoomTimer(room);
        rooms.delete(room.code);
        return;
      }
    } else {
      player.connected = false;
      player.lastSeen = Date.now();
      systemLog(room, `${player.name} keluar/koneksi terputus.`, false);
    }
    sendState(room);
  });

  socket.on('updateSettings', input => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== 'lobby') return socket.emit('errorMessage', 'Setting hanya bisa diubah di lobby.');
    if (room.hostClientId !== player.clientId) return socket.emit('errorMessage', 'Hanya host yang bisa mengubah setting.');
    room.settings = sanitizeSettings({ ...room.settings, ...input }, room.players.size);
    if (room.settings.autoPreset) applyAutoPreset(room);
    sendState(room);
  });

  socket.on('toggleReady', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== 'lobby') return;
    player.isReady = !player.isReady;
    sendState(room);
  });

  socket.on('startGame', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.hostClientId !== player.clientId) return socket.emit('errorMessage', 'Hanya host yang bisa mulai game.');
    if (room.phase !== 'lobby') return;
    const error = validateGameStart(room);
    if (error) return socket.emit('errorMessage', error);
    assignRoles(room);
    room.messages = [];
    room.privateMessages = new Map();
    room.mayorVotes = {};
    systemLog(room, 'Game dimulai. Role sudah dibagikan secara rahasia.', true);
    for (const p of room.players.values()) {
      privateLog(room, p.clientId, `Role kamu: ${ROLE_INFO[p.role].emoji} ${ROLE_INFO[p.role].name}. ${ROLE_INFO[p.role].desc}`);
      emitToPlayer(room, p.clientId, 'roleReveal', { role: p.role, roleInfo: ROLE_INFO[p.role] });
    }
    const wolves = [...room.players.values()].filter(p => p.role === 'werewolf').map(p => p.name).join(', ');
    for (const p of room.players.values()) if (p.role === 'werewolf') privateLog(room, p.clientId, `Teman Werewolf kamu: ${wolves}.`);
    beginMayorVote(room);
  });

  socket.on('sendMessage', ({ text, channel }) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    const clean = String(text || '').trim().slice(0, 300);
    if (!clean) return;

    if (channel === 'wolf') {
      if (player.role !== 'werewolf') return socket.emit('errorMessage', 'Channel Werewolf hanya untuk Werewolf.');
      if (!player.alive) return socket.emit('errorMessage', 'Pemain mati tidak bisa chat Werewolf.');
      const msg = `🐺 ${player.name}: ${clean}`;
      for (const p of room.players.values()) if (p.role === 'werewolf') privateLog(room, p.clientId, msg);
    } else {
      const canPublicChat = room.phase === 'lobby' || room.phase === 'mayor' || room.phase === 'day' || room.phase === 'voting' || room.phase === 'ended';
      if (!canPublicChat) return socket.emit('errorMessage', 'Chat publik dikunci saat malam.');
      if (!player.alive && room.phase !== 'lobby' && room.phase !== 'ended') return socket.emit('errorMessage', 'Pemain mati tidak bisa chat publik saat game berjalan.');
      room.messages.push({ id: Date.now() + Math.random(), type: 'chat', name: player.name, text: clean, at: Date.now() });
      if (room.messages.length > 160) room.messages.shift();
    }
    sendState(room);
  });

  socket.on('mayorVote', ({ targetId }) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== 'mayor') return socket.emit('errorMessage', 'Sekarang bukan fase pemilihan Kepala Desa.');
    if (!player.alive) return socket.emit('errorMessage', 'Pemain mati tidak bisa vote.');
    const target = room.players.get(String(targetId || ''));
    if (!target || !target.alive) return socket.emit('errorMessage', 'Target Kepala Desa tidak valid.');
    room.mayorVotes[player.clientId] = target.clientId;
    systemLog(room, `${player.name} sudah memilih Kepala Desa.`, false);
    sendState(room);
  });

  socket.on('nightAction', ({ targetId }) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== 'night') return socket.emit('errorMessage', 'Sekarang bukan fase malam.');
    if (!player.alive) return socket.emit('errorMessage', 'Pemain mati tidak bisa aksi.');
    const target = room.players.get(String(targetId || ''));
    if (!target || !target.alive) return socket.emit('errorMessage', 'Target tidak valid.');

    if (player.role === 'werewolf') {
      if (target.role === 'werewolf') return socket.emit('errorMessage', 'Werewolf tidak bisa memilih Werewolf lain sebagai korban.');
      room.nightActions[player.clientId] = target.clientId;
      wolfLog(room, `🐺 ${player.name} memilih ${target.name} sebagai target.`);
    } else if (player.role === 'seer') {
      if (target.clientId === player.clientId) return socket.emit('errorMessage', 'Seer tidak bisa cek diri sendiri.');
      room.nightActions[player.clientId] = target.clientId;
      privateLog(room, player.clientId, `Kamu memilih menerawang ${target.name}. Hasil akan muncul saat pagi.`);
    } else if (player.role === 'doctor') {
      room.nightActions[player.clientId] = target.clientId;
      privateLog(room, player.clientId, `Kamu memilih melindungi ${target.name}.`);
    } else {
      return socket.emit('errorMessage', 'Role kamu tidak punya aksi malam.');
    }
    sendState(room);
  });

  socket.on('vote', ({ targetId }) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== 'voting') return socket.emit('errorMessage', 'Sekarang bukan fase voting.');
    if (!player.alive) return socket.emit('errorMessage', 'Pemain mati tidak bisa vote.');
    const target = room.players.get(String(targetId || ''));
    if (!target || !target.alive) return socket.emit('errorMessage', 'Target vote tidak valid.');
    room.votes[player.clientId] = target.clientId;
    const weight = player.isMayor ? ' (suara x2 sebagai Kepala Desa)' : '';
    systemLog(room, `${player.name} sudah voting${weight}.`, false);
    sendState(room);
  });

  socket.on('hunterShoot', ({ targetId }) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== 'hunter') return socket.emit('errorMessage', 'Sekarang bukan fase Hunter.');
    if (room.hunterPendingClientId !== player.clientId) return socket.emit('errorMessage', 'Hanya Hunter yang mati yang bisa menembak.');
    const target = room.players.get(String(targetId || ''));
    if (!target || !target.alive || target.clientId === player.clientId) return socket.emit('errorMessage', 'Target Hunter tidak valid.');
    finishHunter(room, target.clientId);
  });

  socket.on('hostSkip', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.hostClientId !== player.clientId) return socket.emit('errorMessage', 'Hanya host yang bisa skip fase.');
    if (room.phase === 'mayor') resolveMayorVote(room);
    else if (room.phase === 'night') resolveNight(room);
    else if (room.phase === 'day') beginVoting(room);
    else if (room.phase === 'voting') resolveVoting(room);
    else if (room.phase === 'hunter') finishHunter(room, null);
  });

  socket.on('resetGame', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.hostClientId !== player.clientId) return socket.emit('errorMessage', 'Hanya host yang bisa reset game.');
    resetToLobby(room);
  });

  socket.on('kickPlayer', ({ targetId }) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    if (room.phase !== 'lobby') return socket.emit('errorMessage', 'Kick hanya bisa di lobby.');
    if (room.hostClientId !== player.clientId) return socket.emit('errorMessage', 'Hanya host yang bisa kick.');
    const target = room.players.get(String(targetId || ''));
    if (!target || target.clientId === room.hostClientId) return socket.emit('errorMessage', 'Target tidak valid.');
    removeVoiceUser(room, target.clientId);
    const sock = getConnectedSocket(target.clientId, room);
    if (sock) sock.emit('kicked');
    room.players.delete(target.clientId);
    systemLog(room, `${target.name} dikeluarkan dari room.`, true);
    sendState(room);
  });

  socket.on('voiceJoin', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return socket.emit('errorMessage', 'Masuk room dulu sebelum menggunakan voice.');
    const { room, player } = found;
    const existingUsers = [...room.voiceUsers.entries()]
      .filter(([id]) => id !== player.clientId)
      .map(([clientId, info]) => ({ clientId, name: info.name, muted: info.muted }));
    room.voiceUsers.set(player.clientId, { name: player.name, muted: false, at: Date.now() });
    socket.emit('voiceUsers', existingUsers);
    socket.to(room.code).emit('voiceUserJoined', { clientId: player.clientId, name: player.name, muted: false });
    sendState(room);
  });

  socket.on('voiceLeave', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    removeVoiceUser(found.room, found.player.clientId);
  });

  socket.on('voiceMute', ({ muted }) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    const entry = room.voiceUsers.get(player.clientId);
    if (!entry) return;
    entry.muted = Boolean(muted);
    io.to(room.code).emit('voiceMuteChanged', { clientId: player.clientId, muted: entry.muted });
    sendState(room);
  });

  socket.on('voiceSignal', ({ targetId, data }) => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    const target = room.players.get(String(targetId || ''));
    if (!target || !target.socketId) return;
    if (!room.voiceUsers.has(player.clientId)) return;
    const targetSocket = getConnectedSocket(target.clientId, room);
    if (!targetSocket) return;
    targetSocket.emit('voiceSignal', { fromId: player.clientId, fromName: player.name, data });
  });

  socket.on('disconnect', () => {
    const found = findPlayerBySocket(socket.id);
    if (!found) return;
    const { room, player } = found;
    removeVoiceUser(room, player.clientId);
    player.connected = false;
    player.lastSeen = Date.now();
    if (room.phase === 'lobby') {
      systemLog(room, `${player.name} disconnect. Bisa reconnect dengan kode room.`, false);
    } else {
      systemLog(room, `${player.name} disconnect. Player tetap di dalam game.`, false);
    }
    sendState(room);
  });
});

server.listen(PORT, () => {
  console.log(`Werewolf Online ready on http://localhost:${PORT}`);
});
