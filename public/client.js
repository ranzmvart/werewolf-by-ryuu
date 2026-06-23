const socket = io();

const $ = (id) => document.getElementById(id);
const screenHome = $('screenHome');
const screenGame = $('screenGame');
const toast = $('toast');

let state = null;
let timerInterval = null;
let roleRevealShown = false;
let clientId = localStorage.getItem('ww_client_id') || (crypto.randomUUID ? crypto.randomUUID() : `client_${Date.now()}_${Math.random().toString(16).slice(2)}`);
localStorage.setItem('ww_client_id', clientId);

const voiceUsers = new Map();
const voice = {
  active: false,
  muted: false,
  localStream: null,
  peers: new Map(),
};

const lastRoom = localStorage.getItem('ww_room_code');
if (lastRoom) $('btnReconnect').classList.remove('hidden');

$('speechToggle').checked = localStorage.getItem('ww_speech_enabled') === '1';

function showToast(text) {
  toast.textContent = text;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3200);
}

function switchScreen(name) {
  screenHome.classList.toggle('active', name === 'home');
  screenGame.classList.toggle('active', name === 'game');
}

function phaseLabel(phase) {
  return {
    lobby: 'Lobby',
    mayor: 'Vote Kepala Desa',
    night: 'Malam',
    day: 'Diskusi Siang',
    voting: 'Voting',
    hunter: 'Hunter Revenge',
    ended: 'Game Selesai',
  }[phase] || phase;
}

function mmss(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  clearInterval(timerInterval);
  function tick() {
    if (!state?.timerEndsAt) $('timer').textContent = '--:--';
    else $('timer').textContent = mmss(state.timerEndsAt - Date.now());
  }
  tick();
  timerInterval = setInterval(tick, 250);
}

function escapeHTML(str) {
  return String(str ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function roleTeamClass(role) {
  return role === 'werewolf' ? 'werewolf' : role ? 'village' : 'unknown';
}

function aliveTargets({ includeSelf = true } = {}) {
  if (!state) return [];
  return state.players.filter(p => {
    if (!p.alive) return false;
    if (!includeSelf && p.clientId === state.me.clientId) return false;
    return true;
  });
}

function speakNarration(text) {
  if (!$('speechToggle').checked) return;
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'id-ID';
  u.rate = 0.95;
  u.pitch = 0.9;
  window.speechSynthesis.speak(u);
}

function renderNarrator() {
  const text = state.currentNarration?.text || (state.phase === 'lobby' ? 'Menunggu pemain berkumpul di lobby...' : 'Narasi akan muncul saat fase berubah.');
  $('narrationText').textContent = text;
}

function showRoleReveal(payload) {
  if (!payload?.roleInfo) return;
  roleRevealShown = true;
  const info = payload.roleInfo;
  const card = $('roleRevealCard');
  card.className = `role-reveal-card ${roleTeamClass(payload.role)}`;
  $('revealEmoji').textContent = info.emoji;
  $('revealName').textContent = info.name;
  $('revealDesc').textContent = info.desc;
  $('roleRevealOverlay').classList.remove('hidden');
}

function renderRole() {
  const card = $('roleCard');
  const role = state.me.role;
  if (!role) {
    card.className = 'role-card unknown';
    card.innerHTML = `<div class="role-emoji">❔</div><div><h3>Belum dibagikan</h3><p>Tunggu host memulai game.</p></div>`;
    return;
  }
  const info = state.me.roleInfo;
  const mayor = state.me.isMayor ? '<span class="pill warn">👑 Kepala Desa</span>' : '';
  card.className = `role-card ${roleTeamClass(role)}`;
  card.innerHTML = `
    <div class="role-emoji">${info.emoji}</div>
    <div>
      <h3>${info.name} ${mayor}</h3>
      <p>${escapeHTML(info.desc)}</p>
    </div>`;
}

function actionButton(target, label, action, selected = false) {
  return `<button class="target-btn ${selected ? 'selected' : ''}" data-action="${action}" data-target="${target.clientId}">${escapeHTML(label || target.name)}</button>`;
}

function targetLabel(player) {
  const crown = player.isMayor ? ' 👑' : '';
  const me = player.isMe ? ' (Kamu)' : '';
  return `${player.name}${crown}${me}`;
}

function renderActionPanel() {
  const panel = $('actionPanel');
  panel.innerHTML = '';
  const me = state.me;

  if (!me.role && state.phase !== 'lobby') {
    panel.innerHTML = '<p class="tiny">Menunggu data role...</p>';
    return;
  }

  if (!me.role || state.phase === 'lobby') {
    panel.innerHTML = '<p class="tiny">Aksi akan muncul setelah game dimulai.</p>';
    return;
  }

  if (state.phase === 'mayor') {
    if (!me.alive) {
      panel.innerHTML = '<h3>👑 Vote Kepala Desa</h3><p class="tiny">Kamu tidak bisa vote karena sudah mati.</p>';
      return;
    }
    const targets = aliveTargets({ includeSelf: true });
    panel.innerHTML = `<h3>👑 Pilih Kepala Desa</h3><p class="tiny">Kepala Desa punya suara x2 saat voting eliminasi.</p><div class="target-grid">${targets.map(t => actionButton(t, targetLabel(t), 'mayor', state.myMayorVote === t.clientId)).join('')}</div>`;
    return;
  }

  if (!me.alive && state.phase !== 'hunter') {
    panel.innerHTML = '<p class="tiny">Kamu sudah mati. Kamu bisa melihat jalannya game, tapi tidak bisa aksi.</p>';
    return;
  }

  if (state.phase === 'night') {
    if (me.role === 'werewolf') {
      const targets = aliveTargets({ includeSelf: false }).filter(p => p.role !== 'werewolf');
      panel.innerHTML = `<h3>🐺 Pilih Korban</h3><div class="target-grid">${targets.map(t => actionButton(t, targetLabel(t), 'night', state.myNightAction === t.clientId)).join('')}</div>`;
    } else if (me.role === 'seer') {
      const targets = aliveTargets({ includeSelf: false });
      panel.innerHTML = `<h3>🔮 Terawang Pemain</h3><div class="target-grid">${targets.map(t => actionButton(t, targetLabel(t), 'night', state.myNightAction === t.clientId)).join('')}</div>`;
    } else if (me.role === 'doctor') {
      const targets = aliveTargets({ includeSelf: true });
      panel.innerHTML = `<h3>🩺 Lindungi Pemain</h3><div class="target-grid">${targets.map(t => actionButton(t, targetLabel(t), 'night', state.myNightAction === t.clientId)).join('')}</div>`;
    } else {
      panel.innerHTML = '<h3>🌙 Malam</h3><p class="tiny">Role kamu tidak punya aksi malam. Tunggu fase siang.</p>';
    }
    return;
  }

  if (state.phase === 'voting') {
    const targets = aliveTargets({ includeSelf: true });
    const mayorNote = state.me.isMayor ? '<p class="tiny">Kamu adalah Kepala Desa, jadi vote kamu bernilai x2.</p>' : '<p class="tiny">Pilih pemain yang paling mencurigakan.</p>';
    panel.innerHTML = `<h3>🗳️ Voting Eliminasi</h3>${mayorNote}<div class="target-grid">${targets.map(t => actionButton(t, targetLabel(t), 'vote', state.myVote === t.clientId)).join('')}</div>`;
    return;
  }

  if (state.phase === 'hunter') {
    if (state.hunterPending) {
      const targets = aliveTargets({ includeSelf: false });
      panel.innerHTML = `<h3>🏹 Tembakan Terakhir</h3><p class="tiny">Kamu mati sebagai Hunter. Pilih satu pemain untuk ditembak.</p><div class="target-grid">${targets.map(t => actionButton(t, targetLabel(t), 'hunter')).join('')}</div>`;
    } else {
      panel.innerHTML = '<h3>🏹 Hunter Revenge</h3><p class="tiny">Menunggu Hunter memilih target.</p>';
    }
    return;
  }

  if (state.phase === 'day') {
    panel.innerHTML = '<h3>☀️ Diskusi</h3><p class="tiny">Gunakan chat publik atau voice room untuk berdiskusi sebelum voting.</p>';
    return;
  }

  if (state.phase === 'ended') {
    panel.innerHTML = `<h3>🏁 Selesai</h3><p class="tiny">${escapeHTML(state.endedReason || 'Game selesai.')}</p>`;
  }
}

function renderPlayers() {
  const list = $('playersList');
  const alive = state.players.filter(p => p.alive).length;
  const mayor = state.mayorName ? ` • Kepala Desa: ${state.mayorName}` : '';
  $('aliveInfo').textContent = `${alive}/${state.players.length} masih hidup${mayor}`;
  list.innerHTML = state.players.map(p => {
    const tags = [];
    if (p.isHost) tags.push('<span class="pill warn">Host</span>');
    if (p.isMe) tags.push('<span class="pill good">Kamu</span>');
    if (p.isMayor) tags.push('<span class="pill warn">👑 Kepala Desa</span>');
    if (p.inVoice) tags.push(`<span class="pill voice">🎙️${p.voiceMuted ? ' Muted' : ' Voice'}</span>`);
    if (!p.connected) tags.push('<span class="pill bad">Offline</span>');
    if (state.phase === 'lobby' && p.isReady) tags.push('<span class="pill good">Ready</span>');
    if (!p.alive) tags.push('<span class="pill bad">Dead</span>');
    if (p.roleInfo) tags.push(`<span class="pill">${p.roleInfo.emoji} ${p.roleInfo.name}</span>`);
    const canKick = state.me.isHost && state.phase === 'lobby' && !p.isHost;
    return `
      <div class="player-card ${p.alive ? '' : 'dead'} ${p.isMe ? 'me' : ''} ${p.isMayor ? 'mayor' : ''}">
        <div>
          <div class="player-name">${escapeHTML(p.name)} ${tags.join(' ')}</div>
          <div class="player-meta">${p.alive ? 'Masih hidup' : 'Sudah mati'} • ${p.connected ? 'Online' : 'Offline'}</div>
        </div>
        ${canKick ? `<button class="kick-btn danger" data-action="kick" data-target="${p.clientId}">Kick</button>` : ''}
      </div>`;
  }).join('');
}

function renderMessages() {
  const box = $('messages');
  const all = [...(state.messages || []), ...(state.privateMessages || [])]
    .sort((a, b) => a.at - b.at)
    .slice(-180);
  box.innerHTML = all.map(m => `
    <div class="msg ${m.type === 'system' ? 'system' : ''} ${m.type === 'narrator' ? 'narrator' : ''} ${m.important ? 'important' : ''} ${m.type === 'private' ? 'private' : ''}">
      <div class="msg-name">${escapeHTML(m.name)}</div>
      <div>${escapeHTML(m.text)}</div>
    </div>`).join('');
  box.scrollTop = box.scrollHeight;
}

function setSettingsInputs() {
  const s = state.settings;
  $('autoPreset').checked = s.autoPreset;
  $('werewolfCount').value = s.werewolfCount;
  $('seerCount').value = s.seerCount;
  $('doctorCount').value = s.doctorCount;
  $('hunterCount').value = s.hunterCount;
  $('mayorSeconds').value = s.mayorSeconds;
  $('nightSeconds').value = s.nightSeconds;
  $('daySeconds').value = s.daySeconds;
  $('voteSeconds').value = s.voteSeconds;
  $('hunterSeconds').value = s.hunterSeconds;

  const disabled = s.autoPreset;
  ['werewolfCount', 'seerCount', 'doctorCount', 'hunterCount'].forEach(id => $(id).disabled = disabled);
}

function renderLobby() {
  $('lobbyPanel').classList.toggle('hidden', state.phase !== 'lobby');
  $('hostSettings').classList.toggle('hidden', !state.me.isHost || state.phase !== 'lobby');
  $('btnReady').textContent = state.players.find(p => p.isMe)?.isReady ? 'Unready' : 'Ready';
  if (state.me.isHost) setSettingsInputs();
}

function renderHostControls() {
  $('hostControls').classList.toggle('hidden', !state.me.isHost || state.phase === 'lobby');
}

function renderChatMode() {
  const publicAllowed = ['lobby', 'mayor', 'day', 'voting', 'ended'].includes(state.phase);
  $('chatHint').textContent = publicAllowed ? 'Chat publik aktif.' : 'Chat publik terkunci saat malam. Werewolf bisa pakai channel Werewolf.';
  const wolfOption = [...$('chatChannel').options].find(o => o.value === 'wolf');
  wolfOption.disabled = state.me.role !== 'werewolf';
  if (state.me.role !== 'werewolf' && $('chatChannel').value === 'wolf') $('chatChannel').value = 'public';
}

function renderVoicePanel() {
  $('btnJoinVoice').classList.toggle('hidden', voice.active);
  $('btnMuteVoice').classList.toggle('hidden', !voice.active);
  $('btnLeaveVoice').classList.toggle('hidden', !voice.active);
  $('btnMuteVoice').textContent = voice.muted ? 'Unmute' : 'Mute';
  $('voiceStatus').textContent = voice.active ? (voice.muted ? 'Kamu masuk voice, mikrofon muted.' : 'Kamu masuk voice, mikrofon aktif.') : 'Belum masuk voice.';

  const users = new Map(voiceUsers);
  if (voice.active && state?.me) users.set(state.me.clientId, { name: state.me.name, muted: voice.muted });
  if (!users.size) {
    $('voiceList').innerHTML = '<p class="tiny">Belum ada pemain di voice.</p>';
    return;
  }
  $('voiceList').innerHTML = [...users.entries()].map(([id, u]) => {
    const me = id === state?.me?.clientId ? ' (Kamu)' : '';
    const muted = u.muted ? 'Muted' : 'Aktif';
    return `<div class="voice-user"><span><span class="voice-dot"></span>${escapeHTML(u.name)}${me}</span><span>${muted}</span></div>`;
  }).join('');
}

function render() {
  if (!state) return;
  switchScreen('game');
  $('roomCode').textContent = state.code;
  $('phaseName').textContent = phaseLabel(state.phase);
  renderNarrator();
  renderLobby();
  renderRole();
  renderActionPanel();
  renderPlayers();
  renderMessages();
  renderHostControls();
  renderChatMode();
  renderVoicePanel();
  startTimer();
}

function saveSettings() {
  socket.emit('updateSettings', {
    autoPreset: $('autoPreset').checked,
    werewolfCount: Number($('werewolfCount').value),
    seerCount: Number($('seerCount').value),
    doctorCount: Number($('doctorCount').value),
    hunterCount: Number($('hunterCount').value),
    mayorSeconds: Number($('mayorSeconds').value),
    nightSeconds: Number($('nightSeconds').value),
    daySeconds: Number($('daySeconds').value),
    voteSeconds: Number($('voteSeconds').value),
    hunterSeconds: Number($('hunterSeconds').value),
  });
}

async function startVoice() {
  if (!state) return showToast('Masuk room dulu.');
  if (!navigator.mediaDevices?.getUserMedia) return showToast('Browser tidak mendukung mikrofon/WebRTC.');
  try {
    voice.localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    });
    voice.active = true;
    voice.muted = false;
    setLocalMute(false);
    socket.emit('voiceJoin');
    renderVoicePanel();
  } catch (err) {
    showToast('Izin mikrofon ditolak atau voice tidak bisa aktif. Gunakan localhost/HTTPS.');
  }
}

function setLocalMute(muted) {
  voice.muted = muted;
  if (voice.localStream) voice.localStream.getAudioTracks().forEach(track => { track.enabled = !muted; });
  socket.emit('voiceMute', { muted });
  renderVoicePanel();
}

function stopVoice(send = true) {
  if (send && voice.active) socket.emit('voiceLeave');
  for (const pc of voice.peers.values()) pc.close();
  voice.peers.clear();
  voiceUsers.clear();
  if (voice.localStream) voice.localStream.getTracks().forEach(t => t.stop());
  voice.localStream = null;
  voice.active = false;
  voice.muted = false;
  $('remoteAudios').innerHTML = '';
  if (state) renderVoicePanel();
}

function removePeer(clientId) {
  const pc = voice.peers.get(clientId);
  if (pc) pc.close();
  voice.peers.delete(clientId);
  const audio = document.getElementById(`audio_${clientId}`);
  if (audio) audio.remove();
}

function ensurePeer(targetId) {
  if (voice.peers.has(targetId)) return voice.peers.get(targetId);
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });
  voice.peers.set(targetId, pc);

  if (voice.localStream) {
    voice.localStream.getTracks().forEach(track => pc.addTrack(track, voice.localStream));
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) socket.emit('voiceSignal', { targetId, data: { type: 'candidate', candidate: event.candidate } });
  };

  pc.ontrack = (event) => {
    let audio = document.getElementById(`audio_${targetId}`);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `audio_${targetId}`;
      audio.autoplay = true;
      audio.playsInline = true;
      $('remoteAudios').appendChild(audio);
    }
    audio.srcObject = event.streams[0];
  };

  pc.onconnectionstatechange = () => {
    if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) removePeer(targetId);
  };

  return pc;
}

async function callPeer(targetId) {
  if (!voice.active || targetId === state?.me?.clientId) return;
  const pc = ensurePeer(targetId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('voiceSignal', { targetId, data: { type: 'offer', sdp: pc.localDescription } });
}

async function handleVoiceSignal({ fromId, fromName, data }) {
  if (!voice.active || !data) return;
  try {
    const pc = ensurePeer(fromId);
    if (data.type === 'offer') {
      voiceUsers.set(fromId, { name: fromName || 'Player', muted: false });
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voiceSignal', { targetId: fromId, data: { type: 'answer', sdp: pc.localDescription } });
      renderVoicePanel();
    } else if (data.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } else if (data.type === 'candidate') {
      await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  } catch (err) {
    console.warn('Voice signal error:', err);
  }
}

$('btnCreate').addEventListener('click', () => {
  const name = $('createName').value.trim();
  if (!name) return showToast('Isi nama dulu.');
  socket.emit('createRoom', { name, clientId });
});

$('btnJoin').addEventListener('click', () => {
  const name = $('joinName').value.trim();
  const roomCode = $('joinCode').value.trim().toUpperCase();
  if (!name || !roomCode) return showToast('Isi nama dan kode room.');
  socket.emit('joinRoom', { name, roomCode, clientId });
});

$('btnReconnect').addEventListener('click', () => {
  const roomCode = localStorage.getItem('ww_room_code');
  if (!roomCode) return;
  socket.emit('reconnectRoom', { roomCode, clientId });
});

$('btnCopy').addEventListener('click', async () => {
  if (!state?.code) return;
  try {
    await navigator.clipboard.writeText(state.code);
    showToast('Kode room disalin.');
  } catch {
    showToast(`Kode room: ${state.code}`);
  }
});

$('btnLeave').addEventListener('click', () => {
  stopVoice(true);
  socket.emit('leaveRoom');
  localStorage.removeItem('ww_room_code');
  state = null;
  switchScreen('home');
});

$('btnReady').addEventListener('click', () => socket.emit('toggleReady'));
$('btnStart').addEventListener('click', () => socket.emit('startGame'));
$('btnSkip').addEventListener('click', () => socket.emit('hostSkip'));
$('btnReset').addEventListener('click', () => socket.emit('resetGame'));
$('autoPreset').addEventListener('change', () => saveSettings());
$('btnSaveSettings').addEventListener('click', () => saveSettings());
$('speechToggle').addEventListener('change', () => localStorage.setItem('ww_speech_enabled', $('speechToggle').checked ? '1' : '0'));
$('btnCloseReveal').addEventListener('click', () => $('roleRevealOverlay').classList.add('hidden'));
$('btnJoinVoice').addEventListener('click', () => startVoice());
$('btnMuteVoice').addEventListener('click', () => setLocalMute(!voice.muted));
$('btnLeaveVoice').addEventListener('click', () => stopVoice(true));

$('playersList').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action="kick"]');
  if (btn) socket.emit('kickPlayer', { targetId: btn.dataset.target });
});

$('actionPanel').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-target]');
  if (!btn) return;
  const targetId = btn.dataset.target;
  const action = btn.dataset.action;
  if (action === 'mayor') socket.emit('mayorVote', { targetId });
  if (action === 'night') socket.emit('nightAction', { targetId });
  if (action === 'vote') socket.emit('vote', { targetId });
  if (action === 'hunter') socket.emit('hunterShoot', { targetId });
});

$('chatForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('chatInput').value.trim();
  if (!text) return;
  socket.emit('sendMessage', { text, channel: $('chatChannel').value });
  $('chatInput').value = '';
});

socket.on('joined', ({ roomCode, clientId: cid }) => {
  if (cid) {
    clientId = cid;
    localStorage.setItem('ww_client_id', clientId);
  }
  localStorage.setItem('ww_room_code', roomCode);
  $('btnReconnect').classList.remove('hidden');
});

socket.on('state', (nextState) => {
  const oldRole = state?.me?.role;
  const oldNarrationAt = state?.currentNarration?.at;
  const oldPhase = state?.phase;
  state = nextState;
  if (state.phase === 'lobby' && oldPhase !== 'lobby') roleRevealShown = false;
  render();
  if (!roleRevealShown && !oldRole && state.me.role) showRoleReveal({ role: state.me.role, roleInfo: state.me.roleInfo });
  if (state.currentNarration?.at && state.currentNarration.at !== oldNarrationAt) speakNarration(state.currentNarration.text);
});

socket.on('roleReveal', (payload) => showRoleReveal(payload));
socket.on('errorMessage', (msg) => showToast(msg));
socket.on('kicked', () => {
  showToast('Kamu dikeluarkan dari room.');
  stopVoice(false);
  localStorage.removeItem('ww_room_code');
  state = null;
  switchScreen('home');
});

socket.on('voiceUsers', async (users) => {
  voiceUsers.clear();
  for (const u of users || []) voiceUsers.set(u.clientId, { name: u.name, muted: u.muted });
  renderVoicePanel();
  for (const u of users || []) await callPeer(u.clientId);
});

socket.on('voiceUserJoined', (u) => {
  voiceUsers.set(u.clientId, { name: u.name, muted: u.muted });
  renderVoicePanel();
});

socket.on('voiceUserLeft', ({ clientId }) => {
  voiceUsers.delete(clientId);
  removePeer(clientId);
  renderVoicePanel();
});

socket.on('voiceMuteChanged', ({ clientId, muted }) => {
  if (clientId === state?.me?.clientId) voice.muted = muted;
  const u = voiceUsers.get(clientId);
  if (u) u.muted = muted;
  renderVoicePanel();
});

socket.on('voiceSignal', (payload) => handleVoiceSignal(payload));

socket.on('connect', () => {
  const roomCode = localStorage.getItem('ww_room_code');
  if (roomCode && state) socket.emit('reconnectRoom', { roomCode, clientId });
});

window.addEventListener('beforeunload', () => {
  if (voice.active) stopVoice(true);
});
