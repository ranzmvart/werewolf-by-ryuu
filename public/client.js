const socket = io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 700, reconnectionDelayMax: 4000 });

const CLIENT_ID_KEY = 'ryuuWerewolfClientId';
const SESSION_KEY = 'ryuuWerewolfSessionV3';
const clientId = getOrCreateClientId();

const ROLE_META = {
  'Alpha Werewolf': { team:'werewolf', emoji:'🐺👑', aura:'blood', desc:'Pemimpin werewolf. Vote serangan malam bernilai lebih kuat.' },
  Werewolf: { team:'werewolf', emoji:'🐺', aura:'blood', desc:'Saat malam pilih korban bersama tim Werewolf.' },
  Villager: { team:'village', emoji:'🌾', aura:'sun', desc:'Tidak punya skill malam. Kekuatanmu ada di diskusi dan voting.' },
  Seer: { team:'village', emoji:'🔮', aura:'violet', desc:'Setiap malam bisa menerawang satu pemain.' },
  Doctor: { team:'village', emoji:'💉', aura:'green', desc:'Setiap malam bisa melindungi satu pemain.' },
  Hunter: { team:'village', emoji:'🏹', aura:'amber', desc:'Saat mati, bisa menembak satu pemain.' },
  Bodyguard: { team:'village', emoji:'🛡️', aura:'blue', desc:'Menjaga pemain. Bisa berkorban jika target diserang.' },
  Witch: { team:'village', emoji:'🧪', aura:'green', desc:'Punya satu ramuan heal dan satu ramuan poison.' },
  Medium: { team:'village', emoji:'🕯️', aura:'violet', desc:'Bisa membaca chat pemain mati.' },
  Jester: { team:'jester', emoji:'🃏', aura:'pink', desc:'Menang sendiri jika berhasil dieliminasi voting.' }
};

let roomState = null;
let me = null;
let timerInterval = null;
let selectedActionType = 'heal';
let localStream = null;
let muted = false;
const peers = new Map();

const $ = (id) => document.getElementById(id);
const els = {
  login: $('login'), game: $('game'), nameInput: $('nameInput'), codeInput: $('codeInput'), createBtn: $('createBtn'), joinBtn: $('joinBtn'),
  copyCode: $('copyCode'), phaseTitle: $('phaseTitle'), timer: $('timer'), phaseLine: $('phaseLine'), roleCard: $('roleCard'), privateInfo: $('privateInfo'),
  hostBadge: $('hostBadge'), hostTools: $('hostTools'), startBtn: $('startBtn'), skipBtn: $('skipBtn'), resetBtn: $('resetBtn'), nightSec: $('nightSec'), daySec: $('daySec'), voteSec: $('voteSec'), saveSettings: $('saveSettings'),
  narrative: $('narrative'), actionPanel: $('actionPanel'), actionHint: $('actionHint'), targetGrid: $('targetGrid'), players: $('players'), playerCount: $('playerCount'), gameLogs: $('gameLogs'),
  chatLog: $('chatLog'), chatForm: $('chatForm'), chatInput: $('chatInput'), chatChannel: $('chatChannel'),
  cinematic: $('cinematic'), cinematicIcon: $('cinematicIcon'), cinematicTitle: $('cinematicTitle'), cinematicText: $('cinematicText'), toastStack: $('toastStack'),
  joinVoice: $('joinVoice'), muteVoice: $('muteVoice'), leaveVoice: $('leaveVoice'), voiceStatus: $('voiceStatus'), remoteAudios: $('remoteAudios'),
  resumeBox: $('resumeBox'), resumeText: $('resumeText'), resumeBtn: $('resumeBtn'), clearSessionBtn: $('clearSessionBtn'), menuBtn: $('menuBtn'), reconnectStatus: $('reconnectStatus')
};

const savedName = localStorage.getItem('werewolfName');
if (savedName) els.nameInput.value = savedName;

renderResumeBox();

function getOrCreateClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() || `p_${Date.now()}_${Math.random().toString(16).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '');
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(code, playerId) {
  if (!code || !playerId) return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerId, clientId, savedAt: Date.now() }));
  renderResumeBox();
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  renderResumeBox();
}

function renderResumeBox() {
  const session = getSession();
  if (!els.resumeBox) return;
  els.resumeBox.classList.toggle('hidden', !session?.code || !session?.playerId);
  if (session?.code) els.resumeText.textContent = `Room ${session.code} tersimpan. Klik reconnect untuk masuk ulang.`;
}

function reconnectFromSavedSession(showError = true) {
  const session = getSession();
  if (!session?.code || !session?.playerId) {
    if (showError) toast('Tidak ada session', 'Belum ada room terakhir untuk reconnect.');
    return;
  }
  setConnectionStatus('reconnecting', 'Reconnecting...');
  const name = els.nameInput.value.trim() || localStorage.getItem('werewolfName') || 'Player';
  socket.emit('room:reconnect', { code: session.code, playerId: session.playerId, name }, (res) => {
    if (!res?.ok) {
      setConnectionStatus(socket.connected ? 'online' : 'offline', socket.connected ? 'Online' : 'Offline');
      if (showError) toast('Reconnect gagal', res?.error || 'Session sudah tidak tersedia.');
      return;
    }
    saveSession(res.code, res.playerId);
    enterGame();
    toast('Reconnect berhasil', `Kamu kembali ke room ${res.code}.`);
  });
}

function setConnectionStatus(type, text) {
  if (!els.reconnectStatus) return;
  els.reconnectStatus.className = `reconnect-status ${type === 'offline' ? 'offline' : type === 'reconnecting' ? 'reconnecting' : ''}`;
  els.reconnectStatus.textContent = text;
}

els.createBtn.onclick = () => {
  const name = els.nameInput.value.trim();
  if (!name) return toast('Nama belum diisi', 'Isi nama pemain dulu.');
  localStorage.setItem('werewolfName', name);
  socket.emit('room:create', { name, clientId }, (res) => {
    if (!res?.ok) return toast('Gagal buat room', res?.error || 'Coba lagi.');
    saveSession(res.code, res.playerId || clientId);
    enterGame();
  });
};

els.joinBtn.onclick = () => {
  const name = els.nameInput.value.trim();
  const code = els.codeInput.value.trim().toUpperCase();
  if (!name || !code) return toast('Data belum lengkap', 'Isi nama dan kode room.');
  localStorage.setItem('werewolfName', name);
  socket.emit('room:join', { name, code, clientId }, (res) => {
    if (!res?.ok) return toast('Gagal join room', res?.error || 'Coba lagi.');
    saveSession(res.code, res.playerId || clientId);
    enterGame();
  });
};

function enterGame() {
  els.login.classList.add('hidden');
  els.game.classList.remove('hidden');
}

function showMenuOnly() {
  els.game.classList.add('hidden');
  els.login.classList.remove('hidden');
  renderResumeBox();
  toast('Menu awal', 'Session room masih tersimpan. Tekan Reconnect untuk kembali.');
}

els.menuBtn?.addEventListener('click', showMenuOnly);
els.resumeBtn?.addEventListener('click', () => reconnectFromSavedSession(true));
els.clearSessionBtn?.addEventListener('click', () => {
  socket.emit('room:leave', { clear: true });
  clearSession();
  roomState = null;
  me = null;
  toast('Session dihapus', 'Data reconnect lokal sudah dihapus.');
});

els.copyCode.onclick = async () => {
  if (!roomState?.code) return;
  await navigator.clipboard?.writeText(roomState.code).catch(() => null);
  toast('Kode disalin', `Kode room: ${roomState.code}`);
};

els.startBtn.onclick = () => socket.emit('game:start');
els.skipBtn.onclick = () => socket.emit('game:skip');
els.resetBtn.onclick = () => socket.emit('game:reset');
els.saveSettings.onclick = () => {
  socket.emit('room:settings', {
    nightSec: Number(els.nightSec.value),
    daySec: Number(els.daySec.value),
    voteSec: Number(els.voteSec.value)
  });
  toast('Timer disimpan', 'Setting timer dikirim ke server.');
};

els.chatForm.onsubmit = (e) => {
  e.preventDefault();
  const text = els.chatInput.value.trim();
  if (!text) return;
  socket.emit('chat:send', { text, channel: els.chatChannel.value });
  els.chatInput.value = '';
};


socket.on('connect', () => {
  setConnectionStatus('online', 'Online');
  // Jika halaman masih di arena dan koneksi sempat putus, masuk ulang otomatis.
  if (!els.game.classList.contains('hidden') && getSession()?.code) {
    reconnectFromSavedSession(false);
  }
});

socket.io.on('reconnect_attempt', () => setConnectionStatus('reconnecting', 'Reconnecting...'));
socket.on('disconnect', () => setConnectionStatus('offline', 'Offline'));
socket.on('connect_error', () => setConnectionStatus('offline', 'Koneksi gagal'));

socket.on('room:state', (state) => {
  roomState = state;
  if (state?.code && me?.id) saveSession(state.code, me.id);
  renderAll();
});

socket.on('me:state', (state) => {
  me = state;
  if (roomState?.code && me?.id) saveSession(roomState.code, me.id);
  renderAll();
});

socket.on('room:log', (log) => {
  if (!roomState) return;
  roomState.logs = [...(roomState.logs || []), log].slice(-60);
  renderLogs();
});

socket.on('game:narrative', (n) => {
  els.narrative.innerHTML = `<b class="${n.mood || ''}">${escapeHtml(n.title)}</b><span>${escapeHtml(n.text)}</span>`;
});

socket.on('game:animation', (a) => showCinematic(a));
socket.on('room:kicked', () => { clearSession(); location.reload(); });

socket.on('chat:message', (msg) => {
  const div = document.createElement('div');
  div.className = `msg ${msg.scope || 'public'}`;
  div.innerHTML = `<b>${escapeHtml(msg.from)}</b><small>${msg.scope}${msg.alive ? '' : ' • dead'}</small><div>${escapeHtml(msg.text)}</div>`;
  els.chatLog.appendChild(div);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
});

socket.on('werewolf:choice', ({ actorName, targetName }) => toast('Bisikan Werewolf', `${actorName} menandai ${targetName}.`));

function renderAll() {
  if (!roomState) return;
  els.copyCode.textContent = roomState.code;
  els.phaseTitle.textContent = phaseName(roomState.phase);
  els.phaseLine.textContent = phaseHint(roomState.phase);
  els.playerCount.textContent = roomState.players.length;
  els.hostBadge.classList.toggle('hidden', !me?.isHost);
  els.hostTools.classList.toggle('hidden', !me?.isHost);
  els.startBtn.disabled = !['lobby','gameOver'].includes(roomState.phase);
  els.startBtn.textContent = roomState.phase === 'gameOver' ? 'Reset ke Lobby' : 'Start Game';
  els.resetBtn.textContent = roomState.phase === 'gameOver' ? 'Main Lagi' : 'Reset Room';
  if (roomState.settings) {
    els.nightSec.value = roomState.settings.nightSec;
    els.daySec.value = roomState.settings.daySec;
    els.voteSec.value = roomState.settings.voteSec;
  }
  renderTimer();
  renderRole();
  renderPlayers();
  renderActions();
  renderLogs();
}

function renderTimer() {
  clearInterval(timerInterval);
  const tick = () => {
    let targetAt = roomState?.phaseEndsAt;
    if (roomState?.phase === 'gameOver' && roomState?.autoResetAt) targetAt = roomState.autoResetAt;
    if (!targetAt || roomState.phase === 'lobby') {
      els.timer.textContent = '--:--';
      return;
    }
    const remain = Math.max(0, targetAt - Date.now());
    const s = Math.ceil(remain / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    els.timer.textContent = `${mm}:${ss}`;
  };
  tick();
  timerInterval = setInterval(tick, 500);
}

function renderRole() {
  if (!me?.role) {
    els.roleCard.className = 'role-card empty';
    els.roleCard.textContent = 'Belum ada role';
    els.privateInfo.textContent = '';
    return;
  }
  const meta = ROLE_META[me.role] || me.roleMeta || { emoji:'❔', aura:'', desc:'' };
  els.roleCard.className = `role-card ${meta.aura}`;
  els.roleCard.innerHTML = `<div class="role-emoji">${meta.emoji}</div><div class="role-name">${escapeHtml(me.role)}</div><div class="role-desc">${escapeHtml(meta.desc)}</div>`;
  const extra = [];
  if (me.isMayor) extra.push('👑 Kamu adalah Kepala Desa. Vote kamu bernilai 2 suara.');
  if (me.lastInfo) extra.push(`🔎 ${me.lastInfo}`);
  if (me.role === 'Witch') extra.push(`🧪 Heal: ${me.witchHealUsed ? 'habis' : 'tersedia'} • Poison: ${me.witchPoisonUsed ? 'habis' : 'tersedia'}`);
  els.privateInfo.innerHTML = extra.length ? extra.map(escapeHtml).join('<br>') : 'Informasi rahasia role akan muncul di sini.';
}

function renderPlayers() {
  const players = roomState.players || [];
  els.players.innerHTML = players.map(p => {
    const initial = p.name.slice(0,1).toUpperCase();
    const role = p.revealedRole ? `<span class="pill">${escapeHtml(p.revealedRole)}</span>` : '';
    const mayor = p.isMayor ? '<span class="pill mayor">Kades x2</span>' : '';
    const dead = !p.alive ? '<span class="pill dead">Mati</span>' : '';
    const host = p.isHost ? '<span class="pill">Host</span>' : '';
    const voice = p.voice ? '<span class="pill">🎙️ Voice</span>' : '';
    const offline = !p.connected ? '<span class="pill offline-pill">Offline</span>' : '';
    return `<div class="player ${p.alive ? '' : 'dead'} ${p.connected ? '' : 'offline'}">
      <div class="avatar">${escapeHtml(initial)}</div>
      <div><div class="p-name">${escapeHtml(p.name)}${p.id === me?.id ? ' (Kamu)' : ''}</div><div class="p-meta">${host}${mayor}${dead}${offline}${voice}${role}</div></div>
      ${me?.isHost && roomState.phase === 'lobby' && p.id !== me.id ? `<button class="btn danger small" onclick="kickPlayer('${p.id}')">Kick</button>` : ''}
    </div>`;
  }).join('');
}

window.kickPlayer = (id) => socket.emit('game:kick', { playerId: id });

function renderActions() {
  els.targetGrid.innerHTML = '';
  if (!roomState || !me) return;
  const players = roomState.players || [];
  const aliveTargets = players.filter(p => p.alive);
  const aliveOthers = aliveTargets.filter(p => p.id !== me.id);
  let hint = 'Aksi akan muncul sesuai fase dan role.';
  let buttons = [];

  if (roomState.phase === 'lobby') hint = 'Menunggu host memulai game.';
  if (roomState.phase === 'roleReveal') hint = 'Role sudah dibagikan. Baca role kamu baik-baik.';
  if (roomState.phase === 'mayorVote' && me.alive) {
    hint = 'Pilih Kepala Desa. Saat eliminasi, suara Kades bernilai 2.';
    buttons = aliveTargets.map(p => actionButton(p, 'mayor'));
  }
  if (roomState.phase === 'night' && me.alive) {
    const role = me.role;
    if (role === 'Werewolf' || role === 'Alpha Werewolf') {
      hint = 'Werewolf: pilih target untuk dibunuh.';
      buttons = aliveOthers.filter(p => !isWolf(p.revealedRole)).map(p => actionButton(p, 'wolfKill'));
    } else if (role === 'Seer') {
      hint = 'Seer: pilih satu pemain untuk diterawang.';
      buttons = aliveOthers.map(p => actionButton(p, 'seer'));
    } else if (role === 'Doctor') {
      hint = 'Doctor: pilih pemain untuk dilindungi.';
      buttons = aliveTargets.map(p => actionButton(p, 'doctor'));
    } else if (role === 'Bodyguard') {
      hint = 'Bodyguard: pilih pemain lain untuk dijaga.';
      buttons = aliveOthers.map(p => actionButton(p, 'guard'));
    } else if (role === 'Witch') {
      hint = 'Witch: pilih ramuan dulu, lalu target.';
      const controls = document.createElement('div');
      controls.className = 'voice-actions';
      controls.innerHTML = `<button class="btn secondary small" id="healMode" ${me.witchHealUsed ? 'disabled' : ''}>Heal</button><button class="btn secondary small" id="poisonMode" ${me.witchPoisonUsed ? 'disabled' : ''}>Poison</button>`;
      els.targetGrid.appendChild(controls);
      setTimeout(() => {
        $('healMode')?.addEventListener('click', () => { selectedActionType = 'heal'; toast('Mode Witch', 'Pilih target untuk Heal.'); });
        $('poisonMode')?.addEventListener('click', () => { selectedActionType = 'poison'; toast('Mode Witch', 'Pilih target untuk Poison.'); });
      });
      buttons = aliveTargets.map(p => actionButton(p, 'witch'));
    } else if (role === 'Medium') {
      hint = 'Medium: kamu bisa membaca chat Dead/Medium. Pakai informasi arwah saat siang.';
    } else {
      hint = 'Malam ini kamu tidak punya aksi. Perhatikan dan tunggu pagi.';
    }
  }
  if (roomState.phase === 'day') hint = 'Diskusikan siapa yang mencurigakan sebelum voting.';
  if (roomState.phase === 'voting' && me.alive) {
    hint = me.isMayor ? 'Pilih target eliminasi. Kamu Kades, suara kamu bernilai 2.' : 'Pilih target eliminasi.';
    buttons = aliveOthers.map(p => actionButton(p, 'vote'));
  }
  if (roomState.phase === 'hunter' && me.role === 'Hunter' && !me.alive) {
    hint = 'Hunter Revenge: pilih satu pemain untuk ditembak.';
    buttons = aliveOthers.map(p => actionButton(p, 'hunter'));
  }
  if (roomState.phase === 'gameOver') {
    hint = (roomState.gameOver?.reason || 'Game selesai.') + ' Room akan kembali ke lobby otomatis. Host bisa klik Main Lagi/Reset.';
  }
  els.actionHint.textContent = hint;
  if (buttons.length) els.targetGrid.insertAdjacentHTML('beforeend', buttons.join(''));
}

function actionButton(p, mode) {
  let meta = '';
  if (mode === 'vote') {
    const count = roomState.voteState?.counts?.[p.id] || 0;
    meta = `${count} suara`;
  } else if (mode === 'mayor') {
    const count = roomState.mayorState?.counts?.[p.id] || 0;
    meta = `${count} vote Kades`;
  } else meta = p.alive ? 'Pilih target' : 'Mati';
  return `<button class="target ${p.alive ? '' : 'dead'}" onclick="doAction('${mode}','${p.id}')"><span class="name">${escapeHtml(p.name)}</span><span class="meta">${escapeHtml(meta)}</span></button>`;
}

window.doAction = (mode, id) => {
  if (mode === 'mayor') return socket.emit('mayor:vote', { targetId: id });
  if (mode === 'vote') return socket.emit('vote:cast', { targetId: id });
  if (mode === 'hunter') return socket.emit('hunter:shoot', { targetId: id });
  if (mode === 'wolfKill') return socket.emit('night:action', { targetId: id, type: 'kill' });
  if (mode === 'seer') return socket.emit('night:action', { targetId: id, type: 'scan' });
  if (mode === 'doctor') return socket.emit('night:action', { targetId: id, type: 'protect' });
  if (mode === 'guard') return socket.emit('night:action', { targetId: id, type: 'guard' });
  if (mode === 'witch') return socket.emit('night:action', { targetId: id, type: selectedActionType || 'heal' });
};

function renderLogs() {
  const logs = roomState?.logs || [];
  els.gameLogs.innerHTML = logs.slice(-32).map(l => `<div class="log-line">${escapeHtml(l.text)}</div>`).join('');
  els.gameLogs.scrollTop = els.gameLogs.scrollHeight;
}

function phaseName(phase) {
  return ({ lobby:'Lobby', roleReveal:'Reveal Role', mayorVote:'Vote Kepala Desa', night:'Malam', day:'Siang Diskusi', voting:'Voting Eliminasi', hunter:'Hunter Revenge', gameOver:'Game Over' })[phase] || phase;
}
function phaseHint(phase) {
  return ({ lobby:'Kumpulkan pemain dan mulai game.', roleReveal:'Role rahasia sedang ditampilkan.', mayorVote:'Pilih Kades. Vote Kades bernilai 2.', night:'Role malam memilih aksi.', day:'Diskusi dan cari tersangka.', voting:'Semua pemain hidup memilih eliminasi.', hunter:'Hunter memilih target terakhir.', gameOver:'Permainan selesai.' })[phase] || '';
}
function isWolf(role) { return role === 'Werewolf' || role === 'Alpha Werewolf'; }

function showCinematic(a) {
  const map = {
    roleReveal:'🎭', mayor:'👑', nightRole:'🌙', attack:'🐺', death:'💀', saved:'✨', seer:'🔮', heal:'💉', guard:'🛡️', poison:'🧪', vote:'🗳️', execution:'⚖️', hunter:'🏹', hunterShot:'🏹', victory:'🏆', defeat:'🌑', wolfWin:'🐺', villageWin:'🌅', jesterWin:'🃏'
  };
  els.cinematicIcon.textContent = map[a.type] || '🐺';
  els.cinematicTitle.textContent = a.title || 'Event';
  els.cinematicText.textContent = a.text || '';
  els.cinematicTitle.className = a.aura || '';
  els.cinematic.classList.remove('hidden');
  const duration = ['roleReveal','victory','defeat','wolfWin','villageWin','jesterWin'].includes(a.type) ? 4200 : 2500;
  clearTimeout(showCinematic.t);
  showCinematic.t = setTimeout(() => els.cinematic.classList.add('hidden'), duration);
  toast(a.title || 'Event', a.text || '');
}
els.cinematic.onclick = () => els.cinematic.classList.add('hidden');

function toast(title, text) {
  const div = document.createElement('div');
  div.className = 'toast';
  div.innerHTML = `<b>${escapeHtml(title)}</b><span>${escapeHtml(text || '')}</span>`;
  els.toastStack.appendChild(div);
  setTimeout(() => div.remove(), 4600);
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// Voice WebRTC mesh
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

els.joinVoice.onclick = async () => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    muted = false;
    socket.emit('voice:join');
    els.joinVoice.disabled = true;
    els.muteVoice.disabled = false;
    els.leaveVoice.disabled = false;
    els.voiceStatus.textContent = 'Voice aktif. Microphone menyala.';
    toast('Voice aktif', 'Kamu sudah masuk voice room.');
  } catch (e) {
    toast('Voice gagal', 'Browser menolak mikrofon. Pastikan buka dari HTTPS dan izin microphone diaktifkan.');
  }
};

els.muteVoice.onclick = () => {
  if (!localStream) return;
  muted = !muted;
  for (const t of localStream.getAudioTracks()) t.enabled = !muted;
  els.muteVoice.textContent = muted ? 'Unmute' : 'Mute';
  els.voiceStatus.textContent = muted ? 'Voice aktif. Microphone mute.' : 'Voice aktif. Microphone menyala.';
};

els.leaveVoice.onclick = () => leaveVoice();

function leaveVoice() {
  socket.emit('voice:leave');
  for (const pc of peers.values()) pc.close();
  peers.clear();
  localStream?.getTracks().forEach(t => t.stop());
  localStream = null;
  els.remoteAudios.innerHTML = '';
  els.joinVoice.disabled = false;
  els.muteVoice.disabled = true;
  els.leaveVoice.disabled = true;
  els.muteVoice.textContent = 'Mute';
  els.voiceStatus.textContent = 'Belum join voice';
}

socket.on('voice:peers', async ({ peers: ids }) => {
  for (const id of ids) await createPeer(id, true);
});
socket.on('voice:peer-joined', async ({ peerId, name }) => {
  toast('Voice', `${name || 'Pemain'} masuk voice.`);
  await createPeer(peerId, false);
});
socket.on('voice:peer-left', ({ peerId }) => removePeer(peerId));
socket.on('voice:signal', async ({ from, signal }) => {
  let pc = peers.get(from);
  if (!pc) pc = await createPeer(from, false);
  if (signal.sdp) {
    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    if (signal.sdp.type === 'offer') {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice:signal', { to: from, signal: { sdp: pc.localDescription } });
    }
  } else if (signal.candidate) {
    try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch {}
  }
});

async function createPeer(peerId, initiator) {
  if (!localStream) return null;
  if (peers.has(peerId)) return peers.get(peerId);
  const pc = new RTCPeerConnection(rtcConfig);
  peers.set(peerId, pc);
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('voice:signal', { to: peerId, signal: { candidate: e.candidate } });
  };
  pc.ontrack = (e) => {
    let audio = document.getElementById(`audio_${peerId}`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `audio_${peerId}`;
      audio.autoplay = true;
      audio.playsInline = true;
      els.remoteAudios.appendChild(audio);
    }
    audio.srcObject = e.streams[0];
  };
  pc.onconnectionstatechange = () => {
    if (['failed','closed','disconnected'].includes(pc.connectionState)) removePeer(peerId);
  };
  if (initiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('voice:signal', { to: peerId, signal: { sdp: pc.localDescription } });
  }
  return pc;
}

function removePeer(peerId) {
  const pc = peers.get(peerId);
  if (pc) pc.close();
  peers.delete(peerId);
  document.getElementById(`audio_${peerId}`)?.remove();
}

window.addEventListener('beforeunload', () => {
  if (localStream) leaveVoice();
});

// Online Music Player: built-in synth + iTunes previews + public internet radio + local audio upload.
(() => {
  const musicEls = {
    player: document.getElementById('musicPlayer'),
    toggle: document.getElementById('musicToggle'),
    title: document.getElementById('musicTitle'),
    play: document.getElementById('musicPlay'),
    prev: document.getElementById('musicPrev'),
    next: document.getElementById('musicNext'),
    volume: document.getElementById('musicVolume'),
    search: document.getElementById('musicSearch'),
    list: document.getElementById('musicList'),
    upload: document.getElementById('musicUpload'),
    onlineSearch: document.getElementById('musicOnlineSearch'),
    radioSearch: document.getElementById('musicRadioSearch'),
    tabAll: document.getElementById('musicTabAll'),
    tabOnline: document.getElementById('musicTabOnline'),
    tabRadio: document.getElementById('musicTabRadio')
  };
  if (!musicEls.player) return;

  const builtInSongs = [
    { source:'built-in', id:'moon-run', emoji:'🌙', title:'Moon Run', artist:'Ryuu Radio', mood:'dark chase', bpm:112, wave:'triangle', root:220, pattern:[0,3,7,10,7,3,5,2,0,3,7,12,10,7,5,3] },
    { source:'built-in', id:'village-dawn', emoji:'🌅', title:'Village Dawn', artist:'Ryuu Radio', mood:'calm village', bpm:86, wave:'sine', root:196, pattern:[0,4,7,11,7,4,2,4,0,4,7,12,11,7,4,2] },
    { source:'built-in', id:'wolf-hunt', emoji:'🐺', title:'Wolf Hunt', artist:'Ryuu Radio', mood:'intense night', bpm:128, wave:'sawtooth', root:130.81, pattern:[0,0,3,0,7,0,10,7,0,0,3,0,12,10,7,3] },
    { source:'built-in', id:'seer-vision', emoji:'🔮', title:'Seer Vision', artist:'Ryuu Radio', mood:'mystic focus', bpm:96, wave:'triangle', root:246.94, pattern:[0,7,12,14,12,7,5,7,0,7,11,14,12,7,5,2] },
    { source:'built-in', id:'doctor-pulse', emoji:'💉', title:'Doctor Pulse', artist:'Ryuu Radio', mood:'soft focus', bpm:100, wave:'sine', root:174.61, pattern:[0,5,9,12,9,5,4,5,0,5,9,14,12,9,5,4] },
    { source:'built-in', id:'final-vote', emoji:'🗳️', title:'Final Vote', artist:'Ryuu Radio', mood:'tense voting', bpm:118, wave:'square', root:164.81, pattern:[0,2,3,7,3,2,0,-2,0,2,5,8,7,5,3,2] },
    { source:'built-in', id:'victory-fire', emoji:'🏆', title:'Victory Fire', artist:'Ryuu Radio', mood:'win energy', bpm:122, wave:'triangle', root:261.63, pattern:[0,4,7,12,7,4,7,12,0,4,9,12,16,12,9,7] }
  ];

  const musicState = {
    songs: [...builtInSongs],
    filtered: [],
    index: 0,
    playing: false,
    ctx: null,
    gain: null,
    filter: null,
    timer: null,
    step: 0,
    audio: null,
    tab: 'all',
    loading: false
  };

  const savedVolume = Number(localStorage.getItem('ryuuMusicVolume') || 45);
  musicEls.volume.value = String(Math.max(0, Math.min(100, savedVolume)));

  function ensureAudio() {
    if (!musicState.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      musicState.ctx = new AudioCtx();
      musicState.gain = musicState.ctx.createGain();
      musicState.filter = musicState.ctx.createBiquadFilter();
      musicState.filter.type = 'lowpass';
      musicState.filter.frequency.value = 3600;
      musicState.filter.connect(musicState.gain);
      musicState.gain.connect(musicState.ctx.destination);
    }
    if (musicState.ctx.state === 'suspended') musicState.ctx.resume();
    applyVolume();
  }

  function applyVolume() {
    const v = Number(musicEls.volume.value) / 100;
    localStorage.setItem('ryuuMusicVolume', String(musicEls.volume.value));
    if (musicState.gain) musicState.gain.gain.setTargetAtTime(v * 0.32, musicState.ctx.currentTime, 0.04);
    if (musicState.audio) musicState.audio.volume = v * 0.82;
  }

  function noteFreq(root, semi) {
    return root * Math.pow(2, semi / 12);
  }

  function scheduleSynthNote(song) {
    if (!musicState.ctx || !musicState.gain) return;
    const now = musicState.ctx.currentTime;
    const stepDuration = 60 / song.bpm / 2;
    const semi = song.pattern[musicState.step % song.pattern.length];
    const freq = noteFreq(song.root, semi);

    const osc = musicState.ctx.createOscillator();
    const env = musicState.ctx.createGain();
    osc.type = song.wave || 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(0.34, now + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.08, stepDuration * 0.86));
    osc.connect(env);
    env.connect(musicState.filter);
    osc.start(now);
    osc.stop(now + stepDuration);

    if (musicState.step % 4 === 0) {
      const bass = musicState.ctx.createOscillator();
      const bassEnv = musicState.ctx.createGain();
      bass.type = 'sine';
      bass.frequency.setValueAtTime(song.root / 2, now);
      bassEnv.gain.setValueAtTime(0.0001, now);
      bassEnv.gain.exponentialRampToValueAtTime(0.26, now + 0.02);
      bassEnv.gain.exponentialRampToValueAtTime(0.0001, now + stepDuration * 1.7);
      bass.connect(bassEnv);
      bassEnv.connect(musicState.gain);
      bass.start(now);
      bass.stop(now + stepDuration * 1.8);
    }

    musicState.step += 1;
  }

  function stopCurrent(keepButton = false) {
    if (musicState.timer) clearInterval(musicState.timer);
    musicState.timer = null;
    musicState.step = 0;
    if (musicState.audio) {
      musicState.audio.pause();
      musicState.audio.src = '';
      musicState.audio = null;
    }
    musicState.playing = false;
    if (!keepButton) musicEls.play.textContent = '▶';
    renderMusicList();
  }

  async function playIndex(index) {
    const song = musicState.songs[index];
    if (!song) return;
    stopCurrent(true);
    musicState.index = index;
    musicState.playing = true;
    musicEls.play.textContent = '⏸';
    musicEls.title.textContent = `${song.title} — ${song.artist}`;
    renderMusicList();

    if (song.url) {
      const audio = new Audio(song.url);
      audio.crossOrigin = 'anonymous';
      audio.loop = song.source === 'local' || song.source === 'radio';
      audio.playsInline = true;
      audio.preload = 'auto';
      musicState.audio = audio;
      applyVolume();
      audio.addEventListener('ended', () => {
        if (song.source === 'online') move(1);
      });
      audio.addEventListener('error', () => {
        toast('Music error', 'Stream/preview tidak bisa diputar. Coba lagu lain.');
        stopCurrent();
      });
      try { await audio.play(); }
      catch { toast('Music gagal', 'Browser menolak autoplay. Tekan tombol play sekali lagi.'); stopCurrent(); }
      return;
    }

    ensureAudio();
    const stepMs = (60 / song.bpm / 2) * 1000;
    scheduleSynthNote(song);
    musicState.timer = setInterval(() => scheduleSynthNote(song), stepMs);
  }

  function togglePlay() {
    if (musicState.playing) return stopCurrent();
    playIndex(musicState.index);
  }

  function move(delta) {
    const visible = currentVisibleIndexes();
    if (!visible.length) return;
    const pos = visible.indexOf(musicState.index);
    const nextPos = pos >= 0 ? (pos + delta + visible.length) % visible.length : 0;
    playIndex(visible[nextPos]);
  }

  function currentVisibleIndexes() {
    const query = musicEls.search.value.trim().toLowerCase();
    return musicState.songs.map((song, index) => ({ song, index }))
      .filter(({ song }) => tabMatches(song))
      .filter(({ song }) => !query || `${song.title} ${song.artist} ${song.mood || ''} ${song.source || ''}`.toLowerCase().includes(query))
      .map(x => x.index);
  }

  function tabMatches(song) {
    if (musicState.tab === 'online') return song.source === 'online';
    if (musicState.tab === 'radio') return song.source === 'radio';
    return true;
  }

  function setTab(tab) {
    musicState.tab = tab;
    for (const [name, el] of [['all', musicEls.tabAll], ['online', musicEls.tabOnline], ['radio', musicEls.tabRadio]]) {
      el?.classList.toggle('active', name === tab);
    }
    renderMusicList();
  }

  function renderMusicList() {
    const query = musicEls.search.value.trim().toLowerCase();
    musicState.filtered = musicState.songs
      .map((song, index) => ({ song, index }))
      .filter(({ song }) => tabMatches(song))
      .filter(({ song }) => !query || `${song.title} ${song.artist} ${song.mood || ''} ${song.source || ''}`.toLowerCase().includes(query));

    if (!musicState.filtered.length) {
      const msg = musicState.loading ? 'Sedang mencari online...' : 'Tidak ada lagu yang cocok. Coba tekan Cari Online atau Radio.';
      musicEls.list.innerHTML = `<div class="music-note">${msg}</div>`;
      return;
    }
    musicEls.list.innerHTML = musicState.filtered.map(({ song, index }) => {
      const active = index === musicState.index;
      const sourceLabel = song.source === 'online' ? 'Preview online' : song.source === 'radio' ? 'Internet radio' : song.source === 'local' ? 'Lokal' : 'Built-in';
      return `<div class="song-row ${active ? 'active' : ''} ${escapeHtml(song.source || '')}">
        <div class="song-art">${escapeHtml(song.emoji || '🎵')}</div>
        <div>
          <div class="song-name">${escapeHtml(song.title)}</div>
          <div class="song-meta">${escapeHtml(song.artist)} • ${sourceLabel}${song.mood ? ' • ' + escapeHtml(song.mood) : ''}</div>
        </div>
        <button class="song-play" data-song-index="${index}">${active && musicState.playing ? '⏸' : '▶'}</button>
      </div>`;
    }).join('');
    musicEls.list.querySelectorAll('[data-song-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.songIndex);
        if (idx === musicState.index && musicState.playing) stopCurrent();
        else playIndex(idx);
      });
    });
  }

  function addOrReplaceSongs(newSongs, source) {
    const old = musicState.songs.filter(s => s.source !== source);
    musicState.songs = [...old, ...newSongs];
    const first = musicState.songs.findIndex(s => s.source === source);
    if (first >= 0) musicState.index = first;
    renderMusicList();
  }

  async function searchOnline() {
    const term = musicEls.search.value.trim();
    if (!term) return toast('Masukkan kata kunci', 'Contoh: chill, anime, lofi, sad, energetic.');
    musicState.loading = true;
    setTab('online');
    renderMusicList();
    try {
      const url = `https://itunes.apple.com/search?media=music&entity=song&limit=18&term=${encodeURIComponent(term)}`;
      const res = await fetch(url);
      const data = await res.json();
      const songs = (data.results || [])
        .filter(x => x.previewUrl)
        .map(x => ({
          source: 'online',
          id: `itunes-${x.trackId}`,
          emoji: '🎧',
          title: x.trackName || 'Unknown Track',
          artist: x.artistName || 'Unknown Artist',
          mood: x.collectionName || 'iTunes preview',
          url: x.previewUrl
        }));
      addOrReplaceSongs(songs, 'online');
      toast('Hasil online', songs.length ? `${songs.length} preview ditemukan.` : 'Tidak ada preview yang bisa diputar.');
    } catch (err) {
      toast('Cari online gagal', 'Coba kata kunci lain atau cek koneksi.');
    } finally {
      musicState.loading = false;
      renderMusicList();
    }
  }

  async function searchRadio() {
    const term = musicEls.search.value.trim() || 'lofi';
    musicState.loading = true;
    setTab('radio');
    renderMusicList();
    try {
      const url = `https://de1.api.radio-browser.info/json/stations/search?name=${encodeURIComponent(term)}&hidebroken=true&limit=18&order=votes&reverse=true`;
      const res = await fetch(url);
      const data = await res.json();
      const songs = (data || [])
        .filter(x => x.url_resolved || x.url)
        .slice(0, 18)
        .map(x => ({
          source: 'radio',
          id: `radio-${x.stationuuid}`,
          emoji: '📻',
          title: x.name || 'Online Radio',
          artist: x.country || 'Internet Radio',
          mood: [x.tags, x.language].filter(Boolean).join(' • ').slice(0, 90) || 'live stream',
          url: x.url_resolved || x.url
        }));
      addOrReplaceSongs(songs, 'radio');
      toast('Radio online', songs.length ? `${songs.length} station ditemukan.` : 'Tidak ada radio yang cocok.');
    } catch (err) {
      toast('Radio gagal', 'Server radio tidak merespons. Coba lagi.');
    } finally {
      musicState.loading = false;
      renderMusicList();
    }
  }

  musicEls.toggle.addEventListener('click', () => musicEls.player.classList.toggle('collapsed'));
  musicEls.play.addEventListener('click', togglePlay);
  musicEls.prev.addEventListener('click', () => move(-1));
  musicEls.next.addEventListener('click', () => move(1));
  musicEls.volume.addEventListener('input', applyVolume);
  musicEls.search.addEventListener('input', renderMusicList);
  musicEls.search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchOnline();
  });
  musicEls.onlineSearch?.addEventListener('click', searchOnline);
  musicEls.radioSearch?.addEventListener('click', searchRadio);
  musicEls.tabAll?.addEventListener('click', () => setTab('all'));
  musicEls.tabOnline?.addEventListener('click', () => setTab('online'));
  musicEls.tabRadio?.addEventListener('click', () => setTab('radio'));
  musicEls.upload.addEventListener('change', () => {
    const files = [...musicEls.upload.files || []].filter(f => f.type.startsWith('audio/'));
    for (const file of files) {
      musicState.songs.push({
        source: 'local',
        id: `local-${Date.now()}-${Math.random()}`,
        emoji: '🎵',
        title: file.name.replace(/\.[^/.]+$/, ''),
        artist: 'Lagu lokal kamu',
        mood: 'uploaded local audio',
        url: URL.createObjectURL(file)
      });
    }
    musicEls.upload.value = '';
    renderMusicList();
    if (files.length) toast('Playlist ditambah', `${files.length} lagu lokal masuk playlist.`);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && musicState.ctx) musicState.ctx.suspend?.();
    if (!document.hidden && musicState.playing && musicState.ctx) musicState.ctx.resume?.();
  });

  renderMusicList();
  musicEls.title.textContent = `${musicState.songs[0].title} — ${musicState.songs[0].artist}`;
})();
