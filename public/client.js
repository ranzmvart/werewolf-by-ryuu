/* global io */
(() => {
  const socket = io({ transports: ['websocket', 'polling'] });

  let state = null;
  let ttsEnabled = false;
  let localStream = null;
  let muted = false;
  const peerConnections = new Map();
  const peerNames = new Map();

  const $ = (id) => document.getElementById(id);
  const landing = $('landing');
  const game = $('game');
  const nameInput = $('nameInput');
  const roomInput = $('roomInput');
  const createBtn = $('createBtn');
  const joinBtn = $('joinBtn');
  const copyRoomBtn = $('copyRoomBtn');
  const phaseLabel = $('phaseLabel');
  const timerText = $('timerText');
  const roleCard = $('roleCard');
  const narrativeTitle = $('narrativeTitle');
  const narrativeText = $('narrativeText');
  const actionContent = $('actionContent');
  const chatList = $('chatList');
  const chatMode = $('chatMode');
  const chatForm = $('chatForm');
  const chatInput = $('chatInput');
  const playersList = $('playersList');
  const playersCount = $('playersCount');
  const votesList = $('votesList');
  const hostPanel = $('hostPanel');
  const startBtn = $('startBtn');
  const skipBtn = $('skipBtn');
  const resetBtn = $('resetBtn');
  const saveSettingsBtn = $('saveSettingsBtn');
  const connectionPill = $('connectionPill');
  const animOverlay = $('animOverlay');
  const animCard = $('animCard');
  const animIcon = $('animIcon');
  const animTitle = $('animTitle');
  const animMessage = $('animMessage');
  const closeAnimBtn = $('closeAnimBtn');
  const toastStack = $('toastStack');
  const voiceBtn = $('voiceBtn');
  const muteBtn = $('muteBtn');
  const leaveVoiceBtn = $('leaveVoiceBtn');
  const leaveRoomBtn = $('leaveRoomBtn');
  const ttsBtn = $('ttsBtn');
  const audioMount = $('audioMount');

  function savedName() {
    return localStorage.getItem('ww_name') || '';
  }

  nameInput.value = savedName();

  function call(event, payload = {}) {
    return new Promise((resolve) => {
      socket.emit(event, payload, (res) => resolve(res || { ok: false, error: 'Tidak ada respon server.' }));
    });
  }

  function toast(title, message = '') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p>`;
    toastStack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 220);
    }, 3600);
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function formatTimer(value) {
    const seconds = Math.max(0, Number(value) || 0);
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function showGame() {
    landing.classList.add('hidden');
    game.classList.remove('hidden');
  }

  function showLanding() {
    game.classList.add('hidden');
    landing.classList.remove('hidden');
  }

  function getName() {
    const name = nameInput.value.trim() || `Player${Math.floor(Math.random() * 999)}`;
    localStorage.setItem('ww_name', name);
    return name;
  }

  createBtn.addEventListener('click', async () => {
    createBtn.disabled = true;
    const res = await call('room:create', { name: getName() });
    createBtn.disabled = false;
    if (!res.ok) return toast('Gagal membuat room', res.error);
    roomInput.value = res.roomCode;
    showGame();
    toast('Room dibuat', `Kode room: ${res.roomCode}`);
  });

  joinBtn.addEventListener('click', async () => {
    joinBtn.disabled = true;
    const res = await call('room:join', { name: getName(), roomCode: roomInput.value.trim().toUpperCase() });
    joinBtn.disabled = false;
    if (!res.ok) return toast('Gagal join room', res.error);
    showGame();
    toast('Berhasil join', `Masuk ke room ${res.roomCode}`);
  });

  copyRoomBtn.addEventListener('click', async () => {
    if (!state?.room?.code) return;
    const link = `${location.origin}?room=${state.room.code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast('Link disalin', link);
    } catch {
      await navigator.clipboard.writeText(state.room.code).catch(() => {});
      toast('Kode room', state.room.code);
    }
  });

  leaveRoomBtn.addEventListener('click', async () => {
    await leaveVoice();
    await call('room:leave');
    state = null;
    showLanding();
  });

  startBtn.addEventListener('click', async () => {
    const res = await call('host:start');
    if (!res.ok) toast('Tidak bisa start', res.error);
  });

  skipBtn.addEventListener('click', async () => {
    const res = await call('host:skip');
    if (!res.ok) toast('Tidak bisa skip', res.error);
  });

  resetBtn.addEventListener('click', async () => {
    if (!confirm('Reset room dan kembali ke lobby?')) return;
    const res = await call('host:reset');
    if (!res.ok) toast('Tidak bisa reset', res.error);
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const payload = {
      mayorSeconds: Number($('mayorSeconds').value),
      nightSeconds: Number($('nightSeconds').value),
      daySeconds: Number($('daySeconds').value),
      voteSeconds: Number($('voteSeconds').value)
    };
    const res = await call('settings:update', payload);
    if (!res.ok) toast('Settings gagal', res.error);
    else toast('Settings tersimpan');
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    const res = await call('chat:send', { text });
    if (!res.ok) toast('Chat gagal', res.error);
  });

  ttsBtn.addEventListener('click', () => {
    ttsEnabled = !ttsEnabled;
    ttsBtn.textContent = ttsEnabled ? '🔇 Narasi' : '🔊 Narasi';
    toast('Narasi suara', ttsEnabled ? 'Aktif' : 'Nonaktif');
    if (ttsEnabled && state?.room?.narrative) speak(state.room.narrative);
  });

  closeAnimBtn.addEventListener('click', () => animOverlay.classList.add('hidden'));

  socket.on('connect', () => {
    connectionPill.textContent = 'Online';
    connectionPill.className = 'pill ok';
    const queryRoom = new URLSearchParams(location.search).get('room');
    if (queryRoom && !state && nameInput.value.trim()) {
      roomInput.value = queryRoom.toUpperCase();
    }
  });

  socket.on('disconnect', () => {
    connectionPill.textContent = 'Offline';
    connectionPill.className = 'pill bad';
  });

  socket.on('state', (newState) => {
    const previousPhase = state?.room?.phase;
    const previousNarrative = state?.room?.narrative;
    state = newState;
    showGame();
    render();
    if (ttsEnabled && state.room.narrative && state.room.narrative !== previousNarrative) speak(state.room.narrative);
    if (previousPhase && previousPhase !== state.room.phase) {
      document.body.animate([{ filter: 'brightness(1.4)' }, { filter: 'brightness(1)' }], { duration: 320 });
    }
  });

  socket.on('timer', ({ timer }) => {
    if (state?.room) state.room.timer = timer;
    timerText.textContent = formatTimer(timer);
  });

  socket.on('animation', (payload) => playAnimation(payload));

  socket.on('kicked', ({ reason }) => {
    toast('Kamu dikeluarkan', reason || 'Dikeluarkan oleh host.');
    state = null;
    showLanding();
  });

  function render() {
    if (!state?.room) return;
    copyRoomBtn.textContent = state.room.code;
    phaseLabel.textContent = state.room.phaseLabel;
    timerText.textContent = formatTimer(state.room.timer);
    playersCount.textContent = `${state.players.length}/${state.room.maxPlayers} pemain`;
    narrativeTitle.textContent = state.room.phaseLabel;
    narrativeText.textContent = state.room.narrative;

    renderRole();
    renderPlayers();
    renderChat();
    renderActions();
    renderVotes();
    renderHostPanel();
    renderVoiceButtons();
  }

  function renderRole() {
    const me = state.me;
    if (!me?.role) {
      roleCard.innerHTML = `<div class="role-icon">❔</div><div><p class="label">ROLE KAMU</p><h2>Belum dibagikan</h2><p>Menunggu host memulai permainan.</p></div>`;
      return;
    }
    roleCard.innerHTML = `
      <div class="role-icon">${escapeHtml(me.roleIcon)}</div>
      <div>
        <p class="label">ROLE KAMU ${me.isMayor ? '• KEPALA DESA' : ''}</p>
        <h2>${escapeHtml(me.roleName)} ${me.isMayor ? '👑' : ''}</h2>
        <p>${escapeHtml(me.roleShort)}</p>
        <p class="action-note">Tim: <b>${me.team === 'werewolf' ? 'Werewolf' : 'Village'}</b>${me.isMayor ? ' • Vote kamu x2' : ''}</p>
      </div>
    `;
  }

  function renderPlayers() {
    playersList.innerHTML = '';
    for (const p of state.players) {
      const row = document.createElement('div');
      row.className = `player-row ${p.alive ? '' : 'dead'}`;
      const role = p.roleName ? `${p.roleIcon} ${p.roleName}` : (p.alive ? 'Role rahasia' : 'Mati');
      row.innerHTML = `
        <div class="avatar">${p.alive ? (p.roleIcon || '👤') : '💀'}</div>
        <div>
          <strong>${escapeHtml(p.name)} ${p.id === state.me?.id ? '(kamu)' : ''}</strong>
          <small>${escapeHtml(role)}${p.deathReason ? ` • ${escapeHtml(p.deathReason)}` : ''}</small>
        </div>
        <div class="badges">
          ${p.isHost ? '<span class="badge">HOST</span>' : ''}
          ${p.isMayor ? '<span class="badge mayor">👑 x2</span>' : ''}
          ${p.inVoice ? '<span class="badge voice">🎙️</span>' : ''}
          ${!p.connected ? '<span class="badge">DC</span>' : ''}
        </div>
      `;
      playersList.appendChild(row);
    }
  }

  function renderChat() {
    if (state.room.phase === 'night' && state.me?.team === 'werewolf' && state.me?.alive) chatMode.textContent = 'Werewolf Chat';
    else if (!state.me?.alive && state.room.phase !== 'gameover') chatMode.textContent = 'Dead Chat';
    else chatMode.textContent = 'Public Chat';

    const shouldStick = chatList.scrollTop + chatList.clientHeight >= chatList.scrollHeight - 80;
    chatList.innerHTML = '';
    for (const entry of state.logs) {
      const line = document.createElement('div');
      line.className = `chat-line ${entry.scope}`;
      const meta = entry.scope === 'system' ? 'SYSTEM' : entry.scope === 'wolf' ? 'WEREWOLF' : entry.scope === 'dead' ? 'DEAD' : entry.scope === 'private' ? 'PRIVATE' : (entry.from || 'PUBLIC');
      line.innerHTML = `<div class="meta">${escapeHtml(meta)}</div><div>${escapeHtml(entry.text)}</div>`;
      chatList.appendChild(line);
    }
    if (shouldStick) chatList.scrollTop = chatList.scrollHeight;
  }

  function renderHostPanel() {
    const isHost = Boolean(state.me?.isHost);
    hostPanel.classList.toggle('hidden', !isHost);
    if (!isHost) return;
    startBtn.disabled = !(state.room.phase === 'lobby' || state.room.phase === 'gameover') || state.players.length < 4;
    skipBtn.disabled = state.room.phase === 'lobby' || state.room.phase === 'gameover';
    const s = state.room.settings;
    $('mayorSeconds').value = s.mayorSeconds;
    $('nightSeconds').value = s.nightSeconds;
    $('daySeconds').value = s.daySeconds;
    $('voteSeconds').value = s.voteSeconds;
  }

  function renderVotes() {
    const phase = state.room.phase;
    const votes = phase === 'mayor' ? state.votes.mayor : phase === 'vote' ? state.votes.lynch : [];
    if (!votes.length) {
      votesList.textContent = 'Belum ada vote.';
      return;
    }
    const max = Math.max(...votes.map((v) => v.count), 1);
    votesList.innerHTML = '';
    for (const v of votes.sort((a, b) => b.count - a.count)) {
      const p = state.players.find((x) => x.id === v.targetId);
      if (!p) continue;
      const row = document.createElement('div');
      row.className = 'vote-row';
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(p.name)}</strong>
          <div class="vote-bar"><div class="vote-fill" style="width:${Math.round((v.count / max) * 100)}%"></div></div>
        </div>
        <b>${v.count}</b>
      `;
      votesList.appendChild(row);
    }
  }

  function aliveTargets({ includeSelf = true, excludeWolves = false, onlyDead = false } = {}) {
    return state.players.filter((p) => {
      if (onlyDead) return !p.alive;
      if (!p.alive) return false;
      if (!includeSelf && p.id === state.me.id) return false;
      if (excludeWolves && p.role && ['WEREWOLF', 'ALPHA_WOLF'].includes(p.role)) return false;
      return true;
    });
  }

  function targetButtons(targets, label, eventName, action, extraClass = '') {
    if (!targets.length) return '<p class="action-note">Tidak ada target tersedia.</p>';
    return `<div class="target-grid">${targets.map((p) => `
      <button class="target-btn ${extraClass}" data-event="${eventName}" data-action="${action || ''}" data-target="${p.id}">
        <span>${escapeHtml(p.name)} ${p.isMayor ? '👑' : ''}</span>
        <b>${label}</b>
      </button>
    `).join('')}</div>`;
  }

  function renderActions() {
    const me = state.me;
    if (!me) return;
    const phase = state.room.phase;

    if (phase === 'lobby') {
      actionContent.innerHTML = `<p>Menunggu pemain. Minimal 4 pemain untuk start.</p>${me.isHost ? '<p class="action-note">Kamu host. Klik Start Game jika pemain sudah cukup.</p>' : '<p class="action-note">Tunggu host memulai game.</p>'}`;
      bindActionButtons();
      return;
    }

    if (phase === 'mayor' && me.alive) {
      actionContent.innerHTML = `<p>Pilih Kepala Desa. Vote Kepala Desa nanti bernilai 2 suara.</p>${targetButtons(aliveTargets(), 'Pilih', 'vote:mayor')}`;
      bindActionButtons();
      return;
    }

    if (phase === 'vote' && me.alive) {
      actionContent.innerHTML = `<p>Pilih pemain untuk dieliminasi. ${me.isMayor ? '<b>Kamu Kepala Desa, vote kamu bernilai 2.</b>' : 'Vote kamu bernilai 1.'}</p>${targetButtons(aliveTargets({ includeSelf: false }), me.isMayor ? 'Vote x2' : 'Vote', 'vote:lynch', null, 'danger')}`;
      bindActionButtons();
      return;
    }

    if (phase === 'hunter' && me.hunterActive) {
      actionContent.innerHTML = `<p>Kamu Hunter. Pilih satu pemain hidup untuk ditembak.</p>${targetButtons(aliveTargets({ includeSelf: false }), 'Tembak', 'hunter:shoot', null, 'danger')}`;
      bindActionButtons();
      return;
    }

    if (phase === 'night' && me.alive) {
      renderNightAction(me);
      bindActionButtons();
      return;
    }

    if (!me.alive && phase !== 'gameover') {
      actionContent.innerHTML = '<p>Kamu sudah mati. Kamu bisa melihat role semua pemain dan chat dengan pemain mati.</p>';
      return;
    }

    if (phase === 'gameover') {
      actionContent.innerHTML = `<p>Game selesai. Pemenang: <b>${state.room.winner === 'werewolf' ? 'Werewolf' : state.room.winner === 'village' ? 'Village' : 'Seri'}</b>.</p>`;
      return;
    }

    actionContent.innerHTML = '<p>Belum ada aksi untuk fase ini. Gunakan waktu untuk diskusi.</p>';
  }

  function renderNightAction(me) {
    const role = me.role;
    const note = me.nightAction?.done ? '<p class="action-note">Aksi kamu sudah terkirim. Kamu masih bisa mengganti target selama fase malam.</p>' : '';
    if (role === 'WEREWOLF' || role === 'ALPHA_WOLF') {
      actionContent.innerHTML = `<p>Werewolf memilih korban. Chat malam hanya terlihat oleh kawanan.</p>${targetButtons(aliveTargets({ includeSelf: false, excludeWolves: true }), 'Serang', 'night:action', 'wolf-kill', 'danger')}${note}`;
    } else if (role === 'SEER') {
      actionContent.innerHTML = `<p>Terawang satu pemain untuk melihat role dan timnya.</p>${targetButtons(aliveTargets({ includeSelf: false }), 'Terawang', 'night:action', 'seer-check')}${note}`;
    } else if (role === 'DOCTOR') {
      actionContent.innerHTML = `<p>Lindungi satu pemain dari serangan. Tidak bisa target yang sama dua malam berturut-turut.</p>${targetButtons(aliveTargets(), 'Lindungi', 'night:action', 'doctor-save')}${note}`;
    } else if (role === 'BODYGUARD') {
      actionContent.innerHTML = `<p>Kawal satu pemain. Jika target diserang, kamu mengorbankan diri.</p>${targetButtons(aliveTargets({ includeSelf: false }), 'Kawal', 'night:action', 'bodyguard-guard')}${note}`;
    } else if (role === 'WITCH') {
      const heal = me.witchHealUsed ? '<p class="action-note">Potion hidup sudah dipakai.</p>' : `<p><b>Potion Hidup</b> - lindungi satu pemain malam ini.</p>${targetButtons(aliveTargets(), 'Heal', 'night:action', 'witch-heal')}`;
      const poison = me.witchPoisonUsed ? '<p class="action-note">Racun sudah dipakai.</p>' : `<p><b>Racun</b> - bunuh satu pemain malam ini.</p>${targetButtons(aliveTargets({ includeSelf: false }), 'Racun', 'night:action', 'witch-poison', 'danger')}`;
      actionContent.innerHTML = `${heal}<hr class="soft-line" />${poison}${note}`;
    } else if (role === 'MEDIUM') {
      actionContent.innerHTML = `<p>Baca role pemain yang sudah mati.</p>${targetButtons(aliveTargets({ onlyDead: true }), 'Baca', 'night:action', 'medium-read')}${note}`;
    } else {
      actionContent.innerHTML = '<p>Kamu Villager. Tidak ada aksi malam. Tunggu siang untuk diskusi dan voting.</p>';
    }
  }

  function bindActionButtons() {
    actionContent.querySelectorAll('[data-event]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const event = btn.dataset.event;
        const payload = { targetId: btn.dataset.target };
        if (btn.dataset.action) payload.action = btn.dataset.action;
        btn.disabled = true;
        const res = await call(event, payload);
        btn.disabled = false;
        if (!res.ok) toast('Aksi gagal', res.error);
      });
    });
  }

  function playAnimation(payload) {
    const type = payload.type || 'default';
    animCard.className = `anim-card ${type}`;
    animIcon.textContent = payload.icon || iconForType(type);
    animTitle.textContent = payload.title || 'Event';
    animMessage.textContent = payload.message || '';
    animOverlay.classList.remove('hidden');
    toast(payload.title || 'Event', payload.message || '');
    if (ttsEnabled && payload.title) speak(`${payload.title}. ${payload.message || ''}`);

    if (['victory', 'defeat', 'death', 'wolf-kill', 'vote-death', 'poison-death'].includes(type)) {
      vibrate(type === 'victory' ? [80, 60, 80] : [120, 70, 120]);
    } else {
      vibrate(30);
    }

    if (!['role-reveal', 'victory', 'defeat', 'death', 'wolf-kill', 'vote-death', 'poison-death', 'hunter-you'].includes(type)) {
      setTimeout(() => animOverlay.classList.add('hidden'), 3800);
    }
  }

  function iconForType(type) {
    const map = {
      victory: '🏆', defeat: '🌑', death: '💀', 'role-reveal': '🎴', 'mayor-crowned': '👑',
      night: '🌙', day: '☀️', vote: '🗳️', 'seer-result': '🔮', protect: '💉', hunter: '🏹'
    };
    return map[type] || '✨';
  }

  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'id-ID';
    utter.rate = 1;
    utter.pitch = 0.95;
    speechSynthesis.speak(utter);
  }

  async function startVoice() {
    if (!state?.room) return toast('Belum masuk room');
    if (!navigator.mediaDevices?.getUserMedia) {
      return toast('Voice tidak didukung', 'Browser kamu tidak mendukung getUserMedia. Gunakan Chrome terbaru dan HTTPS.');
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      muted = false;
      const res = await call('voice:join');
      if (!res.ok) throw new Error(res.error || 'Gagal join voice');
      renderVoiceButtons();
      toast('Voice aktif', 'Kamu masuk voice room.');
    } catch (err) {
      toast('Voice gagal', err.message || 'Mikrofon ditolak. Di HP biasanya butuh HTTPS.');
      stopLocalStream();
    }
  }

  async function leaveVoice() {
    for (const pc of peerConnections.values()) pc.close();
    peerConnections.clear();
    audioMount.innerHTML = '';
    stopLocalStream();
    await call('voice:leave');
    renderVoiceButtons();
  }

  function stopLocalStream() {
    if (localStream) localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }

  function renderVoiceButtons() {
    const inVoice = Boolean(localStream);
    voiceBtn.classList.toggle('hidden', inVoice);
    muteBtn.classList.toggle('hidden', !inVoice);
    leaveVoiceBtn.classList.toggle('hidden', !inVoice);
    muteBtn.textContent = muted ? '🎙️ Unmute' : '🔇 Mute';
  }

  voiceBtn.addEventListener('click', startVoice);
  leaveVoiceBtn.addEventListener('click', leaveVoice);
  muteBtn.addEventListener('click', () => {
    muted = !muted;
    if (localStream) localStream.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    renderVoiceButtons();
  });

  socket.on('voice:peers', async ({ peers }) => {
    for (const peer of peers || []) {
      peerNames.set(peer.id, peer.name);
      await makeOffer(peer.id);
    }
  });

  socket.on('voice:user-joined', async ({ id, name }) => {
    peerNames.set(id, name || 'Player');
    if (localStream) await makeOffer(id);
  });

  socket.on('voice:user-left', ({ id }) => {
    const pc = peerConnections.get(id);
    if (pc) pc.close();
    peerConnections.delete(id);
    const audio = document.querySelector(`audio[data-peer="${id}"]`);
    if (audio) audio.remove();
  });

  socket.on('voice:signal', async ({ from, data }) => {
    if (!localStream || !from || !data) return;
    const pc = getPeerConnection(from);
    if (data.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('voice:signal', { to: from, data: { type: 'answer', sdp: pc.localDescription } });
    } else if (data.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } else if (data.type === 'ice' && data.candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (_) {}
    }
  });

  function getPeerConnection(peerId) {
    if (peerConnections.has(peerId)) return peerConnections.get(peerId);
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    peerConnections.set(peerId, pc);
    if (localStream) localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit('voice:signal', { to: peerId, data: { type: 'ice', candidate: event.candidate } });
    };
    pc.ontrack = (event) => {
      let audio = document.querySelector(`audio[data-peer="${peerId}"]`);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.dataset.peer = peerId;
        audioMount.appendChild(audio);
      }
      audio.srcObject = event.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        const audio = document.querySelector(`audio[data-peer="${peerId}"]`);
        if (audio) audio.remove();
      }
    };
    return pc;
  }

  async function makeOffer(peerId) {
    if (!localStream || peerConnections.has(peerId)) return;
    const pc = getPeerConnection(peerId);
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    socket.emit('voice:signal', { to: peerId, data: { type: 'offer', sdp: pc.localDescription } });
  }

  window.addEventListener('beforeunload', () => {
    if (localStream) socket.emit('voice:leave');
  });

  const queryRoom = new URLSearchParams(location.search).get('room');
  if (queryRoom) roomInput.value = queryRoom.toUpperCase();
})();
