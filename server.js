'use strict';

const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 30000,
  pingInterval: 10000
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const MAX_PLAYERS = 20;
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, name: 'Werewolf Online Final' }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const rooms = new Map();

const ROLE_DEFS = {
  WEREWOLF: {
    id: 'WEREWOLF',
    name: 'Werewolf',
    team: 'werewolf',
    aura: 'evil',
    icon: '🐺',
    color: '#ef4444',
    short: 'Serigala malam yang memilih korban bersama kawanan.',
    detail: 'Pada malam hari, pilih pemain non-werewolf untuk diserang. Werewolf menang jika jumlah werewolf sama atau lebih banyak dari warga.'
  },
  ALPHA_WOLF: {
    id: 'ALPHA_WOLF',
    name: 'Alpha Werewolf',
    team: 'werewolf',
    aura: 'evil',
    icon: '🌕',
    color: '#dc2626',
    short: 'Pemimpin werewolf dengan aura paling mengancam.',
    detail: 'Ikut memilih korban pada malam hari. Perannya tetap satu tim dengan Werewolf.'
  },
  VILLAGER: {
    id: 'VILLAGER',
    name: 'Villager',
    team: 'village',
    aura: 'good',
    icon: '🧑‍🌾',
    color: '#22c55e',
    short: 'Warga biasa yang menang lewat diskusi dan voting.',
    detail: 'Tidak punya aksi malam. Gunakan chat dan voting untuk menemukan werewolf.'
  },
  SEER: {
    id: 'SEER',
    name: 'Seer',
    team: 'village',
    aura: 'good',
    icon: '🔮',
    color: '#8b5cf6',
    short: 'Peramal yang bisa melihat identitas pemain.',
    detail: 'Setiap malam, terawang satu pemain untuk mengetahui role dan timnya.'
  },
  DOCTOR: {
    id: 'DOCTOR',
    name: 'Doctor',
    team: 'village',
    aura: 'good',
    icon: '💉',
    color: '#06b6d4',
    short: 'Pelindung yang menyelamatkan target dari serangan.',
    detail: 'Setiap malam, lindungi satu pemain. Target yang dilindungi selamat dari serangan werewolf.'
  },
  HUNTER: {
    id: 'HUNTER',
    name: 'Hunter',
    team: 'village',
    aura: 'good',
    icon: '🏹',
    color: '#f59e0b',
    short: 'Saat mati, bisa menembak satu pemain terakhir.',
    detail: 'Jika kamu mati karena voting atau serangan, kamu mendapat kesempatan membalas dengan menembak satu pemain.'
  },
  BODYGUARD: {
    id: 'BODYGUARD',
    name: 'Bodyguard',
    team: 'village',
    aura: 'good',
    icon: '🛡️',
    color: '#14b8a6',
    short: 'Kawal target dan korbankan diri jika target diserang.',
    detail: 'Setiap malam, kawal satu pemain. Jika target diserang werewolf, kamu mati menggantikannya.'
  },
  WITCH: {
    id: 'WITCH',
    name: 'Witch',
    team: 'village',
    aura: 'good',
    icon: '🧪',
    color: '#a3e635',
    short: 'Penyihir dengan potion hidup dan racun satu kali pakai.',
    detail: 'Punya satu potion hidup untuk melindungi dan satu potion racun untuk membunuh. Masing-masing hanya sekali pakai.'
  },
  MEDIUM: {
    id: 'MEDIUM',
    name: 'Medium',
    team: 'village',
    aura: 'good',
    icon: '🕯️',
    color: '#f97316',
    short: 'Berkomunikasi dengan arwah untuk membaca role orang mati.',
    detail: 'Setiap malam, pilih pemain yang sudah mati untuk mengetahui rolenya.'
  }
};

const PHASES = {
  LOBBY: 'lobby',
  MAYOR: 'mayor',
  NIGHT: 'night',
  DAY: 'day',
  VOTE: 'vote',
  HUNTER: 'hunter',
  GAMEOVER: 'gameover'
};

const PHASE_LABELS = {
  lobby: 'Lobby',
  mayor: 'Vote Kepala Desa',
  night: 'Malam',
  day: 'Diskusi Siang',
  vote: 'Voting Eliminasi',
  hunter: 'Hunter Revenge',
  gameover: 'Game Over'
};

const DEFAULT_SETTINGS = {
  mayorSeconds: 45,
  nightSeconds: 60,
  daySeconds: 150,
  voteSeconds: 60,
  hunterSeconds: 25,
  revealDeadRoles: true,
  autoSkipNight: false
};

function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function cleanName(value) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 18) || `Player${Math.floor(Math.random() * 999)}`;
}

function now() {
  return Date.now();
}

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickRandom(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function makeRoom(hostSocket, hostName) {
  const code = createRoomCode();
  const room = {
    code,
    createdAt: now(),
    updatedAt: now(),
    hostId: hostSocket.id,
    phase: PHASES.LOBBY,
    phaseStartedAt: now(),
    timer: 0,
    interval: null,
    players: new Map(),
    settings: { ...DEFAULT_SETTINGS },
    dayCount: 0,
    nightCount: 0,
    mayorVotes: new Map(),
    lynchVotes: new Map(),
    nightActions: emptyNightActions(),
    hunterContext: null,
    winner: null,
    narrative: 'Lobby dibuka. Undang pemain lain memakai kode room.',
    logs: []
  };
  rooms.set(code, room);
  addPlayer(room, hostSocket, hostName);
  return room;
}

function emptyNightActions() {
  return {
    wolf: new Map(),
    seer: new Map(),
    doctor: new Map(),
    bodyguard: new Map(),
    witch: new Map(),
    medium: new Map()
  };
}

function addPlayer(room, socket, name) {
  const player = {
    id: socket.id,
    name: cleanName(name),
    role: null,
    alive: true,
    isMayor: false,
    inVoice: false,
    connected: true,
    joinedAt: now(),
    lastProtectTarget: null,
    witchHealUsed: false,
    witchPoisonUsed: false,
    actionSubmitted: false,
    deathReason: null,
    kills: 0
  };
  room.players.set(socket.id, player);
  socket.join(room.code);
  socket.data.roomCode = room.code;
  room.updatedAt = now();
  addLog(room, 'system', `${player.name} masuk ke room.`);
  return player;
}

function getRoomBySocket(socket) {
  const code = socket.data.roomCode;
  if (!code) return null;
  return rooms.get(code) || null;
}

function alivePlayers(room) {
  return [...room.players.values()].filter((p) => p.alive);
}

function deadPlayers(room) {
  return [...room.players.values()].filter((p) => !p.alive);
}

function roleOf(player) {
  return ROLE_DEFS[player.role] || null;
}

function isWolf(player) {
  const def = roleOf(player);
  return Boolean(def && def.team === 'werewolf');
}

function isVillage(player) {
  const def = roleOf(player);
  return Boolean(def && def.team === 'village');
}

function playerName(room, id) {
  return room.players.get(id)?.name || 'Pemain';
}

function addLog(room, scope, text, extra = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    scope,
    text,
    ...extra
  };
  room.logs.push(entry);
  if (room.logs.length > 120) room.logs.shift();
  room.updatedAt = now();
}

function canSeeLog(entry, viewer) {
  if (!viewer) return entry.scope === 'public' || entry.scope === 'system';
  if (entry.scope === 'public' || entry.scope === 'system') return true;
  if (entry.scope === 'wolf') return viewer.alive && isWolf(viewer);
  if (entry.scope === 'dead') return !viewer.alive;
  if (entry.scope === 'private') return entry.to === viewer.id;
  return false;
}

function publicPlayer(player, viewer, room) {
  const revealRole = !player.alive && room.settings.revealDeadRoles;
  const sameViewer = viewer && viewer.id === player.id;
  const viewerDead = viewer && !viewer.alive;
  const sameWolfTeam = viewer && viewer.alive && isWolf(viewer) && isWolf(player);
  const roleVisible = sameViewer || revealRole || viewerDead || sameWolfTeam || room.phase === PHASES.GAMEOVER;
  return {
    id: player.id,
    name: player.name,
    alive: player.alive,
    connected: player.connected,
    isHost: room.hostId === player.id,
    isMayor: player.isMayor,
    inVoice: player.inVoice,
    role: roleVisible ? player.role : null,
    roleName: roleVisible ? (roleOf(player)?.name || null) : null,
    roleIcon: roleVisible ? (roleOf(player)?.icon || '❔') : null,
    deathReason: player.deathReason
  };
}

function votesState(room, type) {
  const votes = type === 'mayor' ? room.mayorVotes : room.lynchVotes;
  const totals = new Map();
  for (const [voterId, targetId] of votes.entries()) {
    const voter = room.players.get(voterId);
    if (!voter || !voter.alive) continue;
    const weight = type === 'lynch' && voter.isMayor ? 2 : 1;
    totals.set(targetId, (totals.get(targetId) || 0) + weight);
  }
  return [...totals.entries()].map(([targetId, count]) => ({ targetId, count }));
}

function nightActionStatus(room, viewer) {
  if (!viewer || !viewer.alive || room.phase !== PHASES.NIGHT) return null;
  const role = viewer.role;
  if (role === 'WEREWOLF' || role === 'ALPHA_WOLF') return { type: 'wolf', done: room.nightActions.wolf.has(viewer.id) };
  if (role === 'SEER') return { type: 'seer', done: room.nightActions.seer.has(viewer.id) };
  if (role === 'DOCTOR') return { type: 'doctor', done: room.nightActions.doctor.has(viewer.id), lastTarget: viewer.lastProtectTarget };
  if (role === 'BODYGUARD') return { type: 'bodyguard', done: room.nightActions.bodyguard.has(viewer.id) };
  if (role === 'WITCH') {
    const action = room.nightActions.witch.get(viewer.id) || {};
    return {
      type: 'witch',
      healUsed: viewer.witchHealUsed,
      poisonUsed: viewer.witchPoisonUsed,
      healTarget: action.heal || null,
      poisonTarget: action.poison || null,
      done: (viewer.witchHealUsed || action.heal) && (viewer.witchPoisonUsed || action.poison)
    };
  }
  if (role === 'MEDIUM') return { type: 'medium', done: room.nightActions.medium.has(viewer.id) };
  return { type: 'none', done: true };
}

function stateFor(room, viewerId) {
  const viewer = room.players.get(viewerId) || null;
  const roleDef = viewer ? roleOf(viewer) : null;
  return {
    room: {
      code: room.code,
      phase: room.phase,
      phaseLabel: PHASE_LABELS[room.phase],
      timer: room.timer,
      hostId: room.hostId,
      dayCount: room.dayCount,
      nightCount: room.nightCount,
      settings: room.settings,
      narrative: room.narrative,
      winner: room.winner,
      playersCount: room.players.size,
      maxPlayers: MAX_PLAYERS
    },
    me: viewer ? {
      id: viewer.id,
      name: viewer.name,
      role: viewer.role,
      roleName: roleDef?.name || null,
      roleIcon: roleDef?.icon || '❔',
      roleShort: roleDef?.short || '',
      roleDetail: roleDef?.detail || '',
      team: roleDef?.team || null,
      aura: roleDef?.aura || null,
      alive: viewer.alive,
      isHost: room.hostId === viewer.id,
      isMayor: viewer.isMayor,
      inVoice: viewer.inVoice,
      witchHealUsed: viewer.witchHealUsed,
      witchPoisonUsed: viewer.witchPoisonUsed,
      nightAction: nightActionStatus(room, viewer),
      hunterActive: room.phase === PHASES.HUNTER && room.hunterContext?.hunterId === viewer.id
    } : null,
    players: [...room.players.values()].map((p) => publicPlayer(p, viewer, room)),
    votes: {
      mayor: votesState(room, 'mayor'),
      lynch: votesState(room, 'lynch')
    },
    logs: room.logs.filter((entry) => canSeeLog(entry, viewer)).slice(-80),
    serverTime: now()
  };
}

function emitRoom(room) {
  for (const player of room.players.values()) {
    io.to(player.id).emit('state', stateFor(room, player.id));
  }
}

function emitAnimation(playerId, payload) {
  io.to(playerId).emit('animation', {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ...payload
  });
}

function emitRoomAnimation(room, payload, predicate = null) {
  for (const player of room.players.values()) {
    if (!predicate || predicate(player)) emitAnimation(player.id, payload);
  }
}

function setPhase(room, phase, seconds, narrative, onEnd) {
  clearTimer(room);
  room.phase = phase;
  room.phaseStartedAt = now();
  room.timer = seconds;
  room.narrative = narrative;
  addLog(room, 'system', narrative);
  emitRoom(room);

  room.interval = setInterval(() => {
    room.timer -= 1;
    if (room.timer <= 0) {
      clearTimer(room);
      room.timer = 0;
      emitRoom(room);
      onEnd?.();
    } else {
      io.to(room.code).emit('timer', { phase: room.phase, timer: room.timer });
    }
  }, 1000);
}

function clearTimer(room) {
  if (room.interval) clearInterval(room.interval);
  room.interval = null;
}

function assignRoles(room) {
  const players = shuffle([...room.players.values()]);
  const count = players.length;
  const wolfCount = Math.min(3, Math.max(1, Math.floor(count / 4)));
  const roles = [];

  for (let i = 0; i < wolfCount; i += 1) {
    roles.push(i === 0 ? 'WEREWOLF' : 'ALPHA_WOLF');
  }

  roles.push('SEER', 'DOCTOR');
  if (count >= 5) roles.push('HUNTER');
  if (count >= 7) roles.push('BODYGUARD');
  if (count >= 8) roles.push('WITCH');
  if (count >= 9) roles.push('MEDIUM');

  while (roles.length < count) roles.push('VILLAGER');

  const finalRoles = shuffle(roles.slice(0, count));
  players.forEach((player, index) => {
    player.role = finalRoles[index];
    player.alive = true;
    player.isMayor = false;
    player.deathReason = null;
    player.lastProtectTarget = null;
    player.witchHealUsed = false;
    player.witchPoisonUsed = false;
    player.kills = 0;
  });
}

function startGame(room) {
  clearTimer(room);
  assignRoles(room);
  room.dayCount = 0;
  room.nightCount = 0;
  room.winner = null;
  room.mayorVotes.clear();
  room.lynchVotes.clear();
  room.nightActions = emptyNightActions();
  room.hunterContext = null;
  room.logs = [];
  addLog(room, 'system', 'Permainan dimulai. Role rahasia telah dibagikan.');

  for (const player of room.players.values()) {
    const def = roleOf(player);
    emitAnimation(player.id, {
      type: 'role-reveal',
      title: `Kamu adalah ${def.name}`,
      message: def.detail,
      icon: def.icon,
      accent: def.color,
      team: def.team
    });
  }

  setTimeout(() => startMayorPhase(room), 2400);
  emitRoom(room);
}

function startMayorPhase(room) {
  room.mayorVotes.clear();
  const narrative = 'Desa memilih Kepala Desa. Suara Kepala Desa bernilai 2 saat voting eliminasi.';
  emitRoomAnimation(room, {
    type: 'mayor-start',
    title: 'Vote Kepala Desa Dimulai',
    message: 'Pilih satu pemain hidup. Jika terpilih, vote pemain itu bernilai 2 suara saat eliminasi.',
    icon: '👑'
  });
  setPhase(room, PHASES.MAYOR, room.settings.mayorSeconds, narrative, () => finalizeMayor(room));
}

function finalizeMayor(room) {
  const candidates = alivePlayers(room);
  if (!candidates.length) return;
  const tally = tallyVotes(room, room.mayorVotes, false);
  let winner = null;
  if (tally.length) {
    const top = tally[0].count;
    const tied = tally.filter((x) => x.count === top).map((x) => room.players.get(x.targetId)).filter(Boolean);
    winner = pickRandom(tied);
  }
  if (!winner) winner = pickRandom(candidates);
  for (const player of room.players.values()) player.isMayor = false;
  winner.isMayor = true;
  addLog(room, 'public', `👑 ${winner.name} terpilih menjadi Kepala Desa. Vote-nya bernilai 2 saat eliminasi.`);
  emitRoomAnimation(room, {
    type: 'mayor-crowned',
    title: `${winner.name} menjadi Kepala Desa`,
    message: 'Saat voting eliminasi, suaranya dihitung 2.',
    icon: '👑'
  });
  emitAnimation(winner.id, {
    type: 'mayor-you',
    title: 'Kamu Terpilih Jadi Kepala Desa',
    message: 'Vote kamu akan dihitung 2 suara pada fase eliminasi.',
    icon: '👑'
  });
  setTimeout(() => startNight(room), 2200);
  emitRoom(room);
}

function startNight(room) {
  if (checkWin(room)) return;
  room.nightCount += 1;
  room.nightActions = emptyNightActions();
  room.lynchVotes.clear();
  const narrative = `Malam ke-${room.nightCount}. Semua role malam menjalankan aksinya secara rahasia.`;
  emitRoomAnimation(room, {
    type: 'night',
    title: `Malam ke-${room.nightCount}`,
    message: 'Werewolf berburu. Role spesial bergerak dalam diam.',
    icon: '🌙'
  }, (p) => p.alive);
  setPhase(room, PHASES.NIGHT, room.settings.nightSeconds, narrative, () => processNight(room));
}

function startDay(room, nightSummary = null) {
  if (checkWin(room)) return;
  room.dayCount += 1;
  const defaultText = 'Matahari terbit. Desa berdiskusi untuk mencari werewolf.';
  const narrative = nightSummary || defaultText;
  emitRoomAnimation(room, {
    type: 'day',
    title: `Siang ke-${room.dayCount}`,
    message: narrative,
    icon: '☀️'
  });
  setPhase(room, PHASES.DAY, room.settings.daySeconds, narrative, () => startVote(room));
}

function startVote(room) {
  if (checkWin(room)) return;
  room.lynchVotes.clear();
  const mayor = alivePlayers(room).find((p) => p.isMayor);
  const bonus = mayor ? ` Kepala Desa ${mayor.name} memiliki vote x2.` : '';
  const narrative = `Voting eliminasi dimulai.${bonus}`;
  emitRoomAnimation(room, {
    type: 'vote',
    title: 'Voting Eliminasi',
    message: 'Pilih pemain yang paling dicurigai. Vote Kepala Desa bernilai 2.',
    icon: '🗳️'
  }, (p) => p.alive);
  setPhase(room, PHASES.VOTE, room.settings.voteSeconds, narrative, () => processVote(room));
}

function tallyVotes(room, votesMap, useMayorWeight) {
  const totals = new Map();
  for (const [voterId, targetId] of votesMap.entries()) {
    const voter = room.players.get(voterId);
    const target = room.players.get(targetId);
    if (!voter || !target || !voter.alive || !target.alive) continue;
    const weight = useMayorWeight && voter.isMayor ? 2 : 1;
    totals.set(targetId, (totals.get(targetId) || 0) + weight);
  }
  return [...totals.entries()]
    .map(([targetId, count]) => ({ targetId, count }))
    .sort((a, b) => b.count - a.count);
}

function processVote(room) {
  const tally = tallyVotes(room, room.lynchVotes, true);
  if (!tally.length) {
    addLog(room, 'public', 'Tidak ada vote masuk. Tidak ada yang dieliminasi.');
    emitRoomAnimation(room, {
      type: 'no-elim',
      title: 'Tidak Ada Eliminasi',
      message: 'Desa gagal mencapai keputusan.',
      icon: '⚖️'
    });
    return setTimeout(() => startNight(room), 1800);
  }

  const top = tally[0].count;
  const tied = tally.filter((x) => x.count === top);
  if (tied.length > 1) {
    addLog(room, 'public', `Voting seri dengan ${top} suara. Tidak ada yang dieliminasi.`);
    emitRoomAnimation(room, {
      type: 'tie',
      title: 'Voting Seri',
      message: 'Tidak ada pemain yang dieliminasi karena hasil seri.',
      icon: '⚖️'
    });
    return setTimeout(() => startNight(room), 2000);
  }

  const target = room.players.get(tally[0].targetId);
  if (!target || !target.alive) return setTimeout(() => startNight(room), 1000);

  addLog(room, 'public', `🗳️ ${target.name} dieliminasi oleh desa dengan ${top} suara${target.isMayor ? ' (Kepala Desa tumbang)' : ''}.`);
  killPlayer(room, target.id, 'Dieliminasi oleh voting desa', 'vote-death');
  emitRoomAnimation(room, {
    type: 'public-death',
    title: `${target.name} Dieliminasi`,
    message: room.settings.revealDeadRoles ? `Role: ${roleOf(target)?.name || 'Unknown'}` : 'Role tidak dibuka.',
    icon: '🪦'
  });

  if (target.role === 'HUNTER') {
    return startHunterPhase(room, target.id, 'vote');
  }

  if (checkWin(room)) return;
  setTimeout(() => startNight(room), 2600);
}

function processNight(room) {
  if (room.phase !== PHASES.NIGHT) return;

  const protections = new Set();
  const bodyguardMap = new Map();
  const poisonTargets = [];

  for (const [doctorId, targetId] of room.nightActions.doctor.entries()) {
    const doctor = room.players.get(doctorId);
    const target = room.players.get(targetId);
    if (doctor?.alive && target?.alive) {
      protections.add(targetId);
      doctor.lastProtectTarget = targetId;
      emitAnimation(doctor.id, {
        type: 'protect',
        title: 'Perlindungan Aktif',
        message: `${target.name} kamu lindungi malam ini.`,
        icon: '💉'
      });
    }
  }

  for (const [guardId, targetId] of room.nightActions.bodyguard.entries()) {
    const guard = room.players.get(guardId);
    const target = room.players.get(targetId);
    if (guard?.alive && target?.alive && guardId !== targetId) {
      bodyguardMap.set(targetId, guardId);
      emitAnimation(guard.id, {
        type: 'bodyguard',
        title: 'Kawal Malam Aktif',
        message: `Kamu mengawal ${target.name}. Jika dia diserang, kamu akan menggantikannya.`,
        icon: '🛡️'
      });
    }
  }

  for (const [witchId, action] of room.nightActions.witch.entries()) {
    const witch = room.players.get(witchId);
    if (!witch?.alive) continue;
    if (action.heal && !witch.witchHealUsed) {
      const target = room.players.get(action.heal);
      if (target?.alive) {
        protections.add(action.heal);
        witch.witchHealUsed = true;
        emitAnimation(witch.id, {
          type: 'witch-heal',
          title: 'Potion Hidup Digunakan',
          message: `${target.name} mendapat perlindungan potion.`,
          icon: '🧪'
        });
      }
    }
    if (action.poison && !witch.witchPoisonUsed) {
      const target = room.players.get(action.poison);
      if (target?.alive && target.id !== witch.id) {
        poisonTargets.push(action.poison);
        witch.witchPoisonUsed = true;
        emitAnimation(witch.id, {
          type: 'witch-poison',
          title: 'Racun Dilepaskan',
          message: `${target.name} terkena racun malam ini.`,
          icon: '☠️'
        });
      }
    }
  }

  let wolfTargetId = null;
  const wolfVotes = new Map();
  for (const [wolfId, targetId] of room.nightActions.wolf.entries()) {
    const wolf = room.players.get(wolfId);
    const target = room.players.get(targetId);
    if (wolf?.alive && isWolf(wolf) && target?.alive && !isWolf(target)) {
      wolfVotes.set(targetId, (wolfVotes.get(targetId) || 0) + 1);
    }
  }
  if (wolfVotes.size) {
    const sorted = [...wolfVotes.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted[0][1];
    const tied = sorted.filter((x) => x[1] === top).map((x) => x[0]);
    wolfTargetId = pickRandom(tied);
  }

  const deaths = [];
  const protectedNames = [];

  if (wolfTargetId) {
    const target = room.players.get(wolfTargetId);
    const guardId = bodyguardMap.get(wolfTargetId);
    if (guardId) {
      const guard = room.players.get(guardId);
      if (guard?.alive) {
        killPlayer(room, guardId, `Mengorbankan diri untuk ${target.name}`, 'guard-death');
        deaths.push(guard);
        protectedNames.push(target.name);
        emitAnimation(wolfTargetId, {
          type: 'saved',
          title: 'Kamu Diselamatkan',
          message: `${guard.name} mengorbankan diri dan menggagalkan serangan werewolf.`,
          icon: '🛡️'
        });
      }
    } else if (protections.has(wolfTargetId)) {
      protectedNames.push(target.name);
      emitAnimation(wolfTargetId, {
        type: 'saved',
        title: 'Serangan Gagal',
        message: 'Ada kekuatan yang melindungimu dari kematian malam ini.',
        icon: '✨'
      });
    } else if (target?.alive) {
      killPlayer(room, wolfTargetId, 'Dibunuh oleh Werewolf', 'wolf-kill');
      deaths.push(target);
      for (const wolf of alivePlayers(room).filter(isWolf)) {
        emitAnimation(wolf.id, {
          type: 'kill-confirm',
          title: 'Target Berhasil Dibunuh',
          message: `${target.name} tumbang oleh serangan kawanan.`,
          icon: '🐺'
        });
      }
    }
  }

  for (const targetId of poisonTargets) {
    const target = room.players.get(targetId);
    if (target?.alive) {
      killPlayer(room, targetId, 'Terkena racun Witch', 'poison-death');
      deaths.push(target);
    }
  }

  const hunterDeaths = deaths.filter((p) => p.role === 'HUNTER');
  let summary = '';
  if (deaths.length) {
    summary = `Malam berakhir. ${deaths.map((p) => p.name).join(', ')} ditemukan tidak bernyawa.`;
    addLog(room, 'public', `🌙 ${summary}`);
    if (room.settings.revealDeadRoles) {
      addLog(room, 'public', `Role korban: ${deaths.map((p) => `${p.name} = ${roleOf(p)?.name}`).join(', ')}.`);
    }
  } else {
    summary = protectedNames.length ? 'Malam berakhir. Ada serangan, tetapi korban berhasil dilindungi.' : 'Malam berakhir. Tidak ada korban.';
    addLog(room, 'public', `🌙 ${summary}`);
  }

  if (hunterDeaths.length) {
    return startHunterPhase(room, hunterDeaths[0].id, 'night', summary);
  }

  if (checkWin(room)) return;
  setTimeout(() => startDay(room, summary), 2200);
}

function startHunterPhase(room, hunterId, after, summary = null) {
  const hunter = room.players.get(hunterId);
  if (!hunter) return after === 'night' ? startDay(room, summary) : startNight(room);
  room.hunterContext = { hunterId, after, summary };
  const narrative = `${hunter.name} adalah Hunter. Dia mendapat kesempatan menembak satu pemain sebelum pergi.`;
  emitRoomAnimation(room, {
    type: 'hunter',
    title: 'Hunter Revenge',
    message: `${hunter.name} boleh menembak satu pemain.`,
    icon: '🏹'
  });
  emitAnimation(hunterId, {
    type: 'hunter-you',
    title: 'Kesempatan Terakhir Hunter',
    message: 'Pilih satu pemain hidup untuk ditembak.',
    icon: '🏹'
  });
  setPhase(room, PHASES.HUNTER, room.settings.hunterSeconds, narrative, () => finishHunterPhase(room));
}

function finishHunterPhase(room) {
  const context = room.hunterContext;
  room.hunterContext = null;
  if (checkWin(room)) return;
  if (!context) return startNight(room);
  if (context.after === 'night') return setTimeout(() => startDay(room, context.summary), 1300);
  return setTimeout(() => startNight(room), 1300);
}

function hunterShoot(room, hunterId, targetId) {
  if (room.phase !== PHASES.HUNTER || room.hunterContext?.hunterId !== hunterId) return false;
  const hunter = room.players.get(hunterId);
  const target = room.players.get(targetId);
  if (!hunter || !target || !target.alive || target.id === hunter.id) return false;
  killPlayer(room, target.id, `Ditembak oleh Hunter ${hunter.name}`, 'hunter-shot');
  addLog(room, 'public', `🏹 Hunter ${hunter.name} menembak ${target.name}.`);
  emitRoomAnimation(room, {
    type: 'hunter-shot',
    title: `${target.name} Tertembak`,
    message: room.settings.revealDeadRoles ? `Role: ${roleOf(target)?.name || 'Unknown'}` : 'Hunter telah membalas.',
    icon: '🏹'
  });
  clearTimer(room);
  const next = room.hunterContext;
  room.hunterContext = null;
  emitRoom(room);
  if (target.role === 'HUNTER' && target.id !== hunter.id) {
    return setTimeout(() => startHunterPhase(room, target.id, next?.after || 'vote', next?.summary || null), 1500), true;
  }
  if (checkWin(room)) return true;
  if (next?.after === 'night') setTimeout(() => startDay(room, next.summary), 1600);
  else setTimeout(() => startNight(room), 1600);
  return true;
}

function killPlayer(room, playerId, reason, animationType) {
  const player = room.players.get(playerId);
  if (!player || !player.alive) return null;
  player.alive = false;
  player.deathReason = reason;
  player.isMayor = false;
  player.inVoice = false;
  emitAnimation(player.id, {
    type: animationType || 'death',
    title: 'Kamu Tewas',
    message: reason,
    icon: '💀'
  });
  io.to(`${room.code}:voice`).emit('voice:user-left', { id: player.id });
  socketLeaveVoiceRoom(player.id, room);
  return player;
}

function socketLeaveVoiceRoom(playerId, room) {
  const socket = io.sockets.sockets.get(playerId);
  if (socket) socket.leave(`${room.code}:voice`);
}

function checkWin(room) {
  if (room.phase === PHASES.GAMEOVER) return true;
  const alive = alivePlayers(room);
  if (!alive.length) return endGame(room, 'draw');
  const wolves = alive.filter(isWolf);
  const villagers = alive.filter((p) => !isWolf(p));
  if (!wolves.length) return endGame(room, 'village');
  if (wolves.length >= villagers.length) return endGame(room, 'werewolf');
  return false;
}

function endGame(room, winner) {
  clearTimer(room);
  room.phase = PHASES.GAMEOVER;
  room.timer = 0;
  room.winner = winner;
  const title = winner === 'village' ? 'Village Menang' : winner === 'werewolf' ? 'Werewolf Menang' : 'Permainan Seri';
  const message = winner === 'village'
    ? 'Semua werewolf berhasil dikalahkan.'
    : winner === 'werewolf'
      ? 'Werewolf menguasai desa.'
      : 'Tidak ada pemenang.';
  room.narrative = `${title}. ${message}`;
  addLog(room, 'public', `🏁 ${room.narrative}`);

  for (const player of room.players.values()) {
    const def = roleOf(player);
    const playerWon = winner === 'draw' ? false : def?.team === winner;
    emitAnimation(player.id, {
      type: playerWon ? 'victory' : 'defeat',
      title: playerWon ? 'Kemenangan!' : 'Kekalahan...',
      message: playerWon ? 'Tim kamu berhasil menang.' : 'Tim kamu kalah dalam permainan ini.',
      icon: playerWon ? '🏆' : '🌑'
    });
  }
  emitRoom(room);
  return true;
}

function resetRoom(room) {
  clearTimer(room);
  room.phase = PHASES.LOBBY;
  room.timer = 0;
  room.winner = null;
  room.dayCount = 0;
  room.nightCount = 0;
  room.mayorVotes.clear();
  room.lynchVotes.clear();
  room.nightActions = emptyNightActions();
  room.hunterContext = null;
  room.narrative = 'Room direset. Pemain bisa mulai lagi dari lobby.';
  for (const player of room.players.values()) {
    player.role = null;
    player.alive = true;
    player.isMayor = false;
    player.deathReason = null;
    player.lastProtectTarget = null;
    player.witchHealUsed = false;
    player.witchPoisonUsed = false;
    player.actionSubmitted = false;
  }
  addLog(room, 'system', 'Room direset oleh host.');
  emitRoom(room);
}

function removePlayer(socket) {
  const room = getRoomBySocket(socket);
  if (!room) return;
  const player = room.players.get(socket.id);
  if (!player) return;
  player.connected = false;
  player.inVoice = false;
  addLog(room, 'system', `${player.name} keluar dari room.`);
  io.to(`${room.code}:voice`).emit('voice:user-left', { id: player.id });

  if (room.phase === PHASES.LOBBY || room.phase === PHASES.GAMEOVER) {
    room.players.delete(socket.id);
  }

  if (room.hostId === socket.id) {
    const nextHost = [...room.players.values()].find((p) => p.connected) || [...room.players.values()][0];
    if (nextHost) room.hostId = nextHost.id;
  }

  if (room.players.size === 0) {
    clearTimer(room);
    rooms.delete(room.code);
  } else {
    emitRoom(room);
    if (room.phase !== PHASES.LOBBY && room.phase !== PHASES.GAMEOVER) checkWin(room);
  }
}

function requireRoom(socket, callback) {
  const room = getRoomBySocket(socket);
  if (!room) {
    callback?.({ ok: false, error: 'Kamu belum masuk room.' });
    return null;
  }
  return room;
}

function requirePlayer(room, socket, callback) {
  const player = room.players.get(socket.id);
  if (!player) {
    callback?.({ ok: false, error: 'Pemain tidak ditemukan di room.' });
    return null;
  }
  return player;
}

function isHost(room, socket) {
  return room.hostId === socket.id;
}

io.on('connection', (socket) => {
  socket.emit('hello', { ok: true, id: socket.id });

  socket.on('room:create', ({ name } = {}, callback) => {
    const room = makeRoom(socket, name);
    callback?.({ ok: true, roomCode: room.code });
    emitRoom(room);
  });

  socket.on('room:join', ({ roomCode, name } = {}, callback) => {
    const code = String(roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return callback?.({ ok: false, error: 'Room tidak ditemukan.' });
    if (room.players.size >= MAX_PLAYERS) return callback?.({ ok: false, error: 'Room penuh.' });
    if (room.phase !== PHASES.LOBBY && room.phase !== PHASES.GAMEOVER) return callback?.({ ok: false, error: 'Game sudah berjalan. Tunggu permainan selesai.' });
    addPlayer(room, socket, name);
    callback?.({ ok: true, roomCode: room.code });
    emitRoom(room);
  });

  socket.on('room:leave', (_payload, callback) => {
    const room = getRoomBySocket(socket);
    removePlayer(socket);
    socket.data.roomCode = null;
    callback?.({ ok: true });
    if (room && rooms.has(room.code)) emitRoom(room);
  });

  socket.on('host:start', (_payload, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    if (!isHost(room, socket)) return callback?.({ ok: false, error: 'Hanya host yang bisa mulai game.' });
    if (room.phase !== PHASES.LOBBY && room.phase !== PHASES.GAMEOVER) return callback?.({ ok: false, error: 'Game sedang berjalan.' });
    if (room.players.size < 4) return callback?.({ ok: false, error: 'Minimal 4 pemain untuk mulai.' });
    callback?.({ ok: true });
    startGame(room);
  });

  socket.on('host:reset', (_payload, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    if (!isHost(room, socket)) return callback?.({ ok: false, error: 'Hanya host yang bisa reset.' });
    resetRoom(room);
    callback?.({ ok: true });
  });

  socket.on('host:skip', (_payload, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    if (!isHost(room, socket)) return callback?.({ ok: false, error: 'Hanya host yang bisa skip fase.' });
    clearTimer(room);
    callback?.({ ok: true });
    if (room.phase === PHASES.MAYOR) finalizeMayor(room);
    else if (room.phase === PHASES.NIGHT) processNight(room);
    else if (room.phase === PHASES.DAY) startVote(room);
    else if (room.phase === PHASES.VOTE) processVote(room);
    else if (room.phase === PHASES.HUNTER) finishHunterPhase(room);
    else emitRoom(room);
  });

  socket.on('host:kick', ({ targetId } = {}, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    if (!isHost(room, socket)) return callback?.({ ok: false, error: 'Hanya host yang bisa kick.' });
    const target = room.players.get(targetId);
    if (!target) return callback?.({ ok: false, error: 'Target tidak ditemukan.' });
    if (target.id === room.hostId) return callback?.({ ok: false, error: 'Host tidak bisa kick diri sendiri.' });
    io.to(target.id).emit('kicked', { reason: 'Kamu dikeluarkan oleh host.' });
    const targetSocket = io.sockets.sockets.get(target.id);
    if (targetSocket) {
      targetSocket.leave(room.code);
      targetSocket.data.roomCode = null;
    }
    room.players.delete(target.id);
    addLog(room, 'system', `${target.name} dikeluarkan oleh host.`);
    callback?.({ ok: true });
    emitRoom(room);
  });

  socket.on('settings:update', (settings = {}, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    if (!isHost(room, socket)) return callback?.({ ok: false, error: 'Hanya host yang bisa ubah settings.' });
    if (room.phase !== PHASES.LOBBY && room.phase !== PHASES.GAMEOVER) return callback?.({ ok: false, error: 'Settings hanya bisa diubah di lobby.' });
    for (const key of ['mayorSeconds', 'nightSeconds', 'daySeconds', 'voteSeconds', 'hunterSeconds']) {
      if (settings[key] !== undefined) {
        const value = Math.max(15, Math.min(600, Number(settings[key]) || DEFAULT_SETTINGS[key]));
        room.settings[key] = value;
      }
    }
    if (typeof settings.revealDeadRoles === 'boolean') room.settings.revealDeadRoles = settings.revealDeadRoles;
    callback?.({ ok: true });
    emitRoom(room);
  });

  socket.on('chat:send', ({ text } = {}, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    const player = requirePlayer(room, socket, callback);
    if (!player) return;
    const msg = String(text || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (!msg) return callback?.({ ok: false, error: 'Pesan kosong.' });

    let scope = 'public';
    if (!player.alive && room.phase !== PHASES.GAMEOVER) scope = 'dead';
    else if (room.phase === PHASES.NIGHT && isWolf(player)) scope = 'wolf';
    else if (room.phase === PHASES.NIGHT && !isWolf(player)) return callback?.({ ok: false, error: 'Saat malam hanya werewolf yang bisa chat.' });

    addLog(room, scope, msg, { from: player.name, fromId: player.id });
    callback?.({ ok: true });
    emitRoom(room);
  });

  socket.on('vote:mayor', ({ targetId } = {}, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    const player = requirePlayer(room, socket, callback);
    if (!player) return;
    const target = room.players.get(targetId);
    if (room.phase !== PHASES.MAYOR) return callback?.({ ok: false, error: 'Bukan fase vote Kepala Desa.' });
    if (!player.alive || !target?.alive) return callback?.({ ok: false, error: 'Vote hanya untuk pemain hidup.' });
    room.mayorVotes.set(player.id, target.id);
    emitAnimation(player.id, {
      type: 'vote-cast',
      title: 'Vote Kades Terkirim',
      message: `Kamu memilih ${target.name} sebagai Kepala Desa.`,
      icon: '👑'
    });
    addLog(room, 'system', `${player.name} sudah vote Kepala Desa.`);
    callback?.({ ok: true });
    emitRoom(room);
    if (alivePlayers(room).every((p) => room.mayorVotes.has(p.id))) {
      clearTimer(room);
      setTimeout(() => finalizeMayor(room), 600);
    }
  });

  socket.on('vote:lynch', ({ targetId } = {}, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    const player = requirePlayer(room, socket, callback);
    if (!player) return;
    const target = room.players.get(targetId);
    if (room.phase !== PHASES.VOTE) return callback?.({ ok: false, error: 'Bukan fase voting.' });
    if (!player.alive || !target?.alive) return callback?.({ ok: false, error: 'Vote hanya untuk pemain hidup.' });
    if (player.id === target.id) return callback?.({ ok: false, error: 'Tidak bisa vote diri sendiri.' });
    room.lynchVotes.set(player.id, target.id);
    const weight = player.isMayor ? 2 : 1;
    emitAnimation(player.id, {
      type: 'vote-cast',
      title: 'Vote Eliminasi Terkirim',
      message: `Kamu memilih ${target.name}. Nilai suara: ${weight}.`,
      icon: player.isMayor ? '👑' : '🗳️'
    });
    addLog(room, 'system', `${player.name} sudah vote eliminasi.`);
    callback?.({ ok: true });
    emitRoom(room);
    if (alivePlayers(room).every((p) => room.lynchVotes.has(p.id))) {
      clearTimer(room);
      setTimeout(() => processVote(room), 700);
    }
  });

  socket.on('night:action', ({ action, targetId } = {}, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    const player = requirePlayer(room, socket, callback);
    if (!player) return;
    if (room.phase !== PHASES.NIGHT) return callback?.({ ok: false, error: 'Bukan fase malam.' });
    if (!player.alive) return callback?.({ ok: false, error: 'Pemain mati tidak bisa aksi.' });
    const target = room.players.get(targetId);

    if (action === 'wolf-kill') {
      if (!isWolf(player)) return callback?.({ ok: false, error: 'Hanya werewolf.' });
      if (!target?.alive || isWolf(target)) return callback?.({ ok: false, error: 'Target tidak valid.' });
      room.nightActions.wolf.set(player.id, target.id);
      addLog(room, 'wolf', `🐺 ${player.name} memilih menyerang ${target.name}.`);
      emitAnimation(player.id, { type: 'wolf-action', title: 'Target Terkunci', message: `${target.name} dipilih sebagai korban.`, icon: '🐺' });
    } else if (action === 'seer-check') {
      if (player.role !== 'SEER') return callback?.({ ok: false, error: 'Hanya Seer.' });
      if (!target || target.id === player.id) return callback?.({ ok: false, error: 'Target tidak valid.' });
      room.nightActions.seer.set(player.id, target.id);
      const def = roleOf(target);
      addLog(room, 'private', `Hasil terawangan: ${target.name} adalah ${def.name} (${def.team}).`, { to: player.id });
      emitAnimation(player.id, {
        type: 'seer-result',
        title: 'Hasil Terawangan',
        message: `${target.name} adalah ${def.name}. Tim: ${def.team === 'werewolf' ? 'Werewolf' : 'Village'}.`,
        icon: '🔮'
      });
    } else if (action === 'doctor-save') {
      if (player.role !== 'DOCTOR') return callback?.({ ok: false, error: 'Hanya Doctor.' });
      if (!target?.alive) return callback?.({ ok: false, error: 'Target tidak valid.' });
      if (player.lastProtectTarget === target.id) return callback?.({ ok: false, error: 'Doctor tidak boleh melindungi target yang sama dua malam berturut-turut.' });
      room.nightActions.doctor.set(player.id, target.id);
      emitAnimation(player.id, { type: 'doctor-action', title: 'Target Dilindungi', message: `${target.name} akan kamu lindungi malam ini.`, icon: '💉' });
    } else if (action === 'bodyguard-guard') {
      if (player.role !== 'BODYGUARD') return callback?.({ ok: false, error: 'Hanya Bodyguard.' });
      if (!target?.alive || target.id === player.id) return callback?.({ ok: false, error: 'Target tidak valid.' });
      room.nightActions.bodyguard.set(player.id, target.id);
      emitAnimation(player.id, { type: 'bodyguard-action', title: 'Target Dikawal', message: `${target.name} kamu kawal malam ini.`, icon: '🛡️' });
    } else if (action === 'witch-heal') {
      if (player.role !== 'WITCH') return callback?.({ ok: false, error: 'Hanya Witch.' });
      if (player.witchHealUsed) return callback?.({ ok: false, error: 'Potion hidup sudah dipakai.' });
      if (!target?.alive) return callback?.({ ok: false, error: 'Target tidak valid.' });
      const current = room.nightActions.witch.get(player.id) || {};
      current.heal = target.id;
      room.nightActions.witch.set(player.id, current);
      emitAnimation(player.id, { type: 'witch-heal', title: 'Potion Hidup Disiapkan', message: `${target.name} akan mendapat perlindungan potion.`, icon: '🧪' });
    } else if (action === 'witch-poison') {
      if (player.role !== 'WITCH') return callback?.({ ok: false, error: 'Hanya Witch.' });
      if (player.witchPoisonUsed) return callback?.({ ok: false, error: 'Racun sudah dipakai.' });
      if (!target?.alive || target.id === player.id) return callback?.({ ok: false, error: 'Target tidak valid.' });
      const current = room.nightActions.witch.get(player.id) || {};
      current.poison = target.id;
      room.nightActions.witch.set(player.id, current);
      emitAnimation(player.id, { type: 'witch-poison', title: 'Racun Disiapkan', message: `${target.name} akan terkena racun.`, icon: '☠️' });
    } else if (action === 'medium-read') {
      if (player.role !== 'MEDIUM') return callback?.({ ok: false, error: 'Hanya Medium.' });
      if (!target || target.alive) return callback?.({ ok: false, error: 'Medium hanya memilih pemain mati.' });
      room.nightActions.medium.set(player.id, target.id);
      const def = roleOf(target);
      addLog(room, 'private', `Bisikan arwah: ${target.name} adalah ${def.name}.`, { to: player.id });
      emitAnimation(player.id, { type: 'medium-result', title: 'Bisikan Arwah', message: `${target.name} adalah ${def.name}.`, icon: '🕯️' });
    } else {
      return callback?.({ ok: false, error: 'Aksi tidak dikenal.' });
    }

    callback?.({ ok: true });
    emitRoom(room);
  });

  socket.on('hunter:shoot', ({ targetId } = {}, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    const ok = hunterShoot(room, socket.id, targetId);
    callback?.({ ok, error: ok ? null : 'Tembakan Hunter tidak valid.' });
  });

  socket.on('voice:join', async (_payload, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    const player = requirePlayer(room, socket, callback);
    if (!player) return;
    player.inVoice = true;
    socket.join(`${room.code}:voice`);
    const peers = [...room.players.values()].filter((p) => p.inVoice && p.id !== player.id).map((p) => ({ id: p.id, name: p.name }));
    socket.emit('voice:peers', { peers });
    socket.to(`${room.code}:voice`).emit('voice:user-joined', { id: player.id, name: player.name });
    callback?.({ ok: true });
    emitRoom(room);
  });

  socket.on('voice:leave', (_payload, callback) => {
    const room = requireRoom(socket, callback);
    if (!room) return;
    const player = requirePlayer(room, socket, callback);
    if (!player) return;
    player.inVoice = false;
    socket.leave(`${room.code}:voice`);
    socket.to(`${room.code}:voice`).emit('voice:user-left', { id: player.id });
    callback?.({ ok: true });
    emitRoom(room);
  });

  socket.on('voice:signal', ({ to, data } = {}) => {
    const room = getRoomBySocket(socket);
    if (!room || !room.players.has(to)) return;
    io.to(to).emit('voice:signal', { from: socket.id, data });
  });

  socket.on('disconnect', () => removePlayer(socket));
});

setInterval(() => {
  const cutoff = now() - ROOM_TTL_MS;
  for (const [code, room] of rooms.entries()) {
    if (room.updatedAt < cutoff || room.players.size === 0) {
      clearTimer(room);
      rooms.delete(code);
    }
  }
}, 1000 * 60 * 20);

server.listen(PORT, HOST, () => {
  console.log(`Werewolf Online Final ready on http://${HOST}:${PORT}`);
});
