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
  Jester: { team:'jester', emoji:'🃏', aura:'pink', desc:'Menang sendiri jika berhasil dieliminasi voting.' },
  'Cursed Villager': { team:'village', emoji:'🌘', aura:'blood', desc:'Jika diserang Werewolf, berubah menjadi Werewolf sekali.' },
  Prince: { team:'village', emoji:'👑', aura:'amber', desc:'Sekali selamat dari eliminasi voting.' },
  Priest: { team:'village', emoji:'⛪', aura:'blue', desc:'Sekali per game memberi Holy Shield saat malam.' },
  Lycan: { team:'village', emoji:'🐺🌾', aura:'blood', desc:'Warga yang terlihat seperti Werewolf jika diterawang Seer.' },
  Sorcerer: { team:'werewolf', emoji:'🧙‍♂️', aura:'violet', desc:'Tim Werewolf yang ikut strategi dan dapat memilih target serangan.' },
  'Tough Guy': { team:'village', emoji:'💪', aura:'amber', desc:'Warga kuat tanpa aksi aktif. Cocok untuk bluffing dan tahan tekanan.' }
};


const TCG_ROLE_ASSETS = {
  "Alpha Werewolf": "/assets/tcg/roles/role-alpha-werewolf.svg",
  "Werewolf": "/assets/tcg/roles/role-werewolf.svg",
  "Villager": "/assets/tcg/roles/role-villager.svg",
  "Seer": "/assets/tcg/roles/role-seer.svg",
  "Doctor": "/assets/tcg/roles/role-doctor.svg",
  "Hunter": "/assets/tcg/roles/role-hunter.svg",
  "Bodyguard": "/assets/tcg/roles/role-bodyguard.svg",
  "Witch": "/assets/tcg/roles/role-witch.svg",
  "Medium": "/assets/tcg/roles/role-medium.svg",
  "Jester": "/assets/tcg/roles/role-jester.svg",
  "Cursed Villager": "/assets/tcg/roles/role-cursed-villager.svg",
  "Prince": "/assets/tcg/roles/role-prince.svg",
  "Priest": "/assets/tcg/roles/role-priest.svg",
  "Lycan": "/assets/tcg/roles/role-lycan.svg",
  "Sorcerer": "/assets/tcg/roles/role-sorcerer.svg",
  "Tough Guy": "/assets/tcg/roles/role-tough-guy.svg"
};
const TCG_SKIN_ASSETS = {
  "Nocturne Wolf": "/assets/tcg/skins/skin-nocturne-wolf.svg",
  "Blood Moon Alpha": "/assets/tcg/skins/skin-blood-moon-alpha.svg",
  "Silver Fang": "/assets/tcg/skins/skin-silver-fang.svg",
  "Village Guardian": "/assets/tcg/skins/skin-village-guardian.svg",
  "Royal Villager": "/assets/tcg/skins/skin-royal-villager.svg",
  "Lantern Keeper": "/assets/tcg/skins/skin-lantern-keeper.svg",
  "Astral Seer": "/assets/tcg/skins/skin-astral-seer.svg",
  "Crystal Oracle": "/assets/tcg/skins/skin-crystal-oracle.svg",
  "Neon Medic": "/assets/tcg/skins/skin-neon-medic.svg",
  "Emerald Healer": "/assets/tcg/skins/skin-emerald-healer.svg",
  "Iron Bodyguard": "/assets/tcg/skins/skin-iron-bodyguard.svg",
  "Void Witch": "/assets/tcg/skins/skin-void-witch.svg",
  "Potion Witch": "/assets/tcg/skins/skin-potion-witch.svg",
  "Raven Hunter": "/assets/tcg/skins/skin-raven-hunter.svg",
  "Ghost Medium": "/assets/tcg/skins/skin-ghost-medium.svg",
  "Golden Prince": "/assets/tcg/skins/skin-golden-prince.svg",
  "Chaos Jester": "/assets/tcg/skins/skin-chaos-jester.svg",
  "Holy Priest": "/assets/tcg/skins/skin-holy-priest.svg"
};
const TCG_EFFECT_ASSETS = {
  "Werewolf Maul": "/assets/tcg/effects/effect-werewolf-maul.svg",
  "Alpha Rend": "/assets/tcg/effects/effect-alpha-rend.svg",
  "Seer Vision": "/assets/tcg/effects/effect-seer-vision.svg",
  "Doctor Pulse": "/assets/tcg/effects/effect-doctor-pulse.svg",
  "Guard Wall": "/assets/tcg/effects/effect-guard-wall.svg",
  "Witch Poison": "/assets/tcg/effects/effect-witch-poison.svg",
  "Hunter Shot": "/assets/tcg/effects/effect-hunter-shot.svg",
  "Mayor Crown": "/assets/tcg/effects/effect-mayor-crown.svg",
  "Death Smoke": "/assets/tcg/effects/effect-death-smoke.svg",
  "Victory Nova": "/assets/tcg/effects/effect-victory-nova.svg",
  "Double Vision": "/assets/tcg/effects/effect-double-vision.svg",
  "Blood Moon": "/assets/tcg/effects/effect-blood-moon.svg"
};
function roleAsset(role) { return TCG_ROLE_ASSETS[role] || '/assets/tcg/templates/template-rare.svg'; }
function effectAsset(name, fallback = '/assets/tcg/effects/effect-victory-nova.svg') { return TCG_EFFECT_ASSETS[name] || fallback; }

let roomState = null;
let me = null;
let latestRoomList = [];
let timerInterval = null;
let selectedActionType = 'heal';
let reconnectInFlight = false;
let lastReconnectAttemptAt = 0;
let lastAutoReconnectAt = 0;
let hadSocketDisconnect = false;
let allowAutoReconnectOnce = false;
let currentRoomCode = null;
let activeGameTab = localStorage.getItem('ryuuGameTab') || 'actions';
let mayorVoteLockedTarget = null;
let localStream = null;
let muted = false;
const peers = new Map();
let accountProfile = null;
let shopCatalog = [];
let latestLeaderboards = null;
let crateCatalog = [];
let latestSocial = { friends: [], requests: [], sent: [], roomInvites: [] };
let friendSearchResults = [];

const $ = (id) => document.getElementById(id);
const els = {
  login: $('login'), game: $('game'), nameInput: $('nameInput'), roomNameInput: $('roomNameInput'), roomPasswordInput: $('roomPasswordInput'), codeInput: $('codeInput'), createBtn: $('createBtn'), joinBtn: $('joinBtn'), refreshRoomsBtn: $('refreshRoomsBtn'), roomList: $('roomList'), roomListStatus: $('roomListStatus'),
  copyCode: $('copyCode'), roomNameLabel: $('roomNameLabel'), phaseTitle: $('phaseTitle'), timer: $('timer'), phaseLine: $('phaseLine'), roleCard: $('roleCard'), privateInfo: $('privateInfo'),
  hostBadge: $('hostBadge'), hostTools: $('hostTools'), startBtn: $('startBtn'), skipBtn: $('skipBtn'), resetBtn: $('resetBtn'), nightSec: $('nightSec'), daySec: $('daySec'), voteSec: $('voteSec'), saveSettings: $('saveSettings'),
  narrative: $('narrative'), actionPanel: $('actionPanel'), actionHint: $('actionHint'), targetGrid: $('targetGrid'), players: $('players'), playerCount: $('playerCount'), gameLogs: $('gameLogs'),
  chatLog: $('chatLog'), chatForm: $('chatForm'), chatInput: $('chatInput'), chatChannel: $('chatChannel'),
  cinematic: $('cinematic'), cinematicIcon: $('cinematicIcon'), cinematicTitle: $('cinematicTitle'), cinematicText: $('cinematicText'), toastStack: $('toastStack'),
  joinVoice: $('joinVoice'), muteVoice: $('muteVoice'), leaveVoice: $('leaveVoice'), voiceStatus: $('voiceStatus'), voiceMembers: $('voiceMembers'), remoteAudios: $('remoteAudios'),
  resumeBox: $('resumeBox'), resumeText: $('resumeText'), resumeBtn: $('resumeBtn'), clearSessionBtn: $('clearSessionBtn'), menuBtn: $('menuBtn'), reconnectStatus: $('reconnectStatus'),
  guidePanel: $('guidePanel'), guideClose: $('guideClose'), guideHelp: $('guideHelp'),
  appLoader: $('appLoader'), accountHub: $('accountHub'), authGrid: $('authGrid'), authName: $('authName'), authPin: $('authPin'), avatarInput: $('avatarInput'), registerBtn: $('registerBtn'), loginBtn: $('loginBtn'), accountStatus: $('accountStatus'), profileSummary: $('profileSummary'), profilePanel: $('profilePanel'), shopPanel: $('shopPanel'), inventoryPanel: $('inventoryPanel'), leaderboardPanel: $('leaderboardPanel'), cratePanel: $('cratePanel'), friendsPanel: $('friendsPanel'), profileTabBtn: $('profileTabBtn'), shopTabBtn: $('shopTabBtn'), invTabBtn: $('invTabBtn'), lbTabBtn: $('lbTabBtn'), crateTabBtn: $('crateTabBtn'), friendsTabBtn: $('friendsTabBtn'), gameProfileBox: $('gameProfileBox'), accountPage: $('accountPage'), accountPageTitle: $('accountPageTitle'), accountPageSub: $('accountPageSub'), accountPageContent: $('accountPageContent'), accountPageClose: $('accountPageClose'),
  crateOpening: $('crateOpening'), crateSkipBtn: $('crateSkipBtn'), crateDoneBtn: $('crateDoneBtn'), crateOpeningTitle: $('crateOpeningTitle'), crateOpeningPrice: $('crateOpeningPrice'), crateOpeningAsset: $('crateOpeningAsset'), caseRail: $('caseRail'), crateResult: $('crateResult'), crateResultCard: $('crateResultCard'), crateResultAsset: $('crateResultAsset'), crateResultRarity: $('crateResultRarity'), crateResultName: $('crateResultName'), crateResultDesc: $('crateResultDesc')
};

const savedName = localStorage.getItem('werewolfName');
if (savedName) els.nameInput.value = savedName;
const savedRoomName = localStorage.getItem('werewolfRoomName');
if (savedRoomName && els.roomNameInput) els.roomNameInput.value = savedRoomName;


// === v3.7 Real Pages Router: membuat menu HP/laptop tidak menumpuk ===
let activeMenuRoute = 'home';
function initMenuRouter() {
  const hero = document.querySelector('.hero-card');
  if (!hero || document.getElementById('menuRouter')) return;

  const subtitle = hero.querySelector('.subtitle');
  const formGrid = hero.querySelector('.form-grid');
  const roomBrowser = hero.querySelector('.room-browser');
  const roomNote = roomBrowser?.nextElementSibling?.classList?.contains('mini-note') ? roomBrowser.nextElementSibling : null;
  const resumeBox = els.resumeBox;

  const router = document.createElement('div');
  router.id = 'menuRouter';
  router.className = 'menu-router';
  router.innerHTML = `
    <nav class="menu-page-nav" aria-label="Navigasi Menu">
      <button class="menu-nav-btn active" data-menu-route="home" type="button">Home</button>
      <button class="menu-nav-btn" data-menu-route="account" type="button">Akun</button>
      <button class="menu-nav-btn" data-menu-route="create" type="button">Buat Room</button>
      <button class="menu-nav-btn" data-menu-route="lobby" type="button">Lobby</button>
      <button class="menu-nav-btn" data-account-tab="shop" type="button">Shop</button>
      <button class="menu-nav-btn" data-account-tab="inv" type="button">Inventory</button>
      <button class="menu-nav-btn" data-account-tab="crates" type="button">Crates</button>
      <button class="menu-nav-btn" data-account-tab="friends" type="button">Friends</button>
      <button class="menu-nav-btn" data-account-tab="lb" type="button">Rank</button>
    </nav>
    <div id="menuRouteHome" class="menu-route-page active">
      <div class="menu-home-card glass-lite">
        <div id="menuAccountMini" class="menu-account-mini"></div>
        <div class="home-choice-grid">
          <button class="home-choice primary-choice" data-menu-route="create" type="button"><b>Buat Room</b><span>Host lobby baru, password opsional.</span></button>
          <button class="home-choice" data-menu-route="lobby" type="button"><b>Join Lobby</b><span>Lihat daftar room publik dan masuk cepat.</span></button>
          <button class="home-choice" data-account-tab="shop" type="button"><b>Shop</b><span>Beli skin, power, badge, dan frame.</span></button>
          <button class="home-choice" data-account-tab="crates" type="button"><b>Open Crate</b><span>Gacha item Common sampai Mythic.</span></button>
          <button class="home-choice" data-account-tab="friends" type="button"><b>Friends</b><span>Tambah teman dan invite ke lobby.</span></button>
          <button class="home-choice" data-account-tab="lb" type="button"><b>Leaderboard</b><span>Top 100 statistik pemain.</span></button>
        </div>
      </div>
    </div>
    <div id="menuRouteAccount" class="menu-route-page menu-route-account hidden">
      <div class="route-page-head"><button class="back-home-btn" data-menu-route="home" type="button">← Home</button><div><b>Akun Pemain</b><span>Login, daftar, dan ringkasan profil.</span></div></div>
    </div>
    <div id="menuRouteCreate" class="menu-route-page hidden">
      <div class="route-page-head"><button class="back-home-btn" data-menu-route="home" type="button">← Home</button><div><b>Buat / Join Manual</b><span>Isi data room di halaman khusus ini saja.</span></div></div>
    </div>
    <div id="menuRouteLobby" class="menu-route-page hidden">
      <div class="route-page-head"><button class="back-home-btn" data-menu-route="home" type="button">← Home</button><div><b>Lobby Publik</b><span>Pilih room yang sedang terbuka.</span></div></div>
    </div>
  `;

  if (subtitle) subtitle.insertAdjacentElement('afterend', router);
  else hero.appendChild(router);

  const accountPage = document.getElementById('menuRouteAccount');
  const createPage = document.getElementById('menuRouteCreate');
  const lobbyPage = document.getElementById('menuRouteLobby');
  if (els.accountHub) accountPage.appendChild(els.accountHub);
  if (formGrid) createPage.appendChild(formGrid);
  if (resumeBox) createPage.appendChild(resumeBox);
  if (roomBrowser) lobbyPage.appendChild(roomBrowser);
  if (roomNote) lobbyPage.appendChild(roomNote);

  router.querySelectorAll('[data-menu-route]').forEach(btn => {
    btn.addEventListener('click', () => showMenuRoute(btn.dataset.menuRoute));
  });
  router.querySelectorAll('[data-account-tab]').forEach(btn => {
    btn.addEventListener('click', () => openAccountPage(btn.dataset.accountTab));
  });
  showMenuRoute(localStorage.getItem('ryuuMenuRouteV37') || 'home');
}
function showMenuRoute(route = 'home') {
  activeMenuRoute = route;
  localStorage.setItem('ryuuMenuRouteV37', route);
  els.accountPage?.classList.add('hidden');
  els.game?.classList.add('hidden');
  els.login?.classList.remove('hidden');
  document.querySelectorAll('.menu-route-page').forEach(page => page.classList.add('hidden'));
  const page = document.getElementById('menuRoute' + route.charAt(0).toUpperCase() + route.slice(1));
  (page || document.getElementById('menuRouteHome'))?.classList.remove('hidden');
  document.querySelectorAll('.menu-nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.menuRoute === route));
  updateMenuAccountMini();
  if (route === 'lobby') socket.emit('rooms:list');
  if (route === 'create') renderResumeBox();
}
function updateMenuAccountMini() {
  const box = document.getElementById('menuAccountMini');
  if (!box) return;
  if (!accountProfile) {
    box.innerHTML = `<div><b>Belum login</b><span>Login/daftar dulu agar poin, inventory, dan statistik tersimpan.</span></div><button class="btn primary small" data-menu-route="account" type="button">Login / Daftar</button>`;
  } else {
    const s = accountProfile.stats || {};
    const eq = accountProfile.equipped || {};
    box.innerHTML = `<img class="profile-avatar ${escapeHtml(frameClass(eq.frame))}" src="${escapeHtml(accountProfile.avatar)}" alt="avatar"><div><b>${escapeHtml(accountProfile.username)} ${accountProfile.isAdmin ? '<span class="owner-chip">OWNER</span>' : ''}</b><span>${escapeHtml(pointsText(accountProfile))} poin • ${s.wins || 0} win • ${s.games || 0} main</span></div><button class="btn secondary small" data-menu-route="account" type="button">Profil</button>`;
  }
  box.querySelectorAll('[data-menu-route]').forEach(btn => btn.addEventListener('click', () => showMenuRoute(btn.dataset.menuRoute)));
}
initMenuRouter();

let loadingHideTimer = null;
function setUiLoading(show = true, text = 'Memuat Ryuu Village...') {
  if (!els.appLoader) return;
  els.appLoader.querySelector('b').textContent = text;
  els.appLoader.classList.toggle('hidden', !show);
  clearTimeout(loadingHideTimer);
}
function softHideLoader(delay = 650) {
  clearTimeout(loadingHideTimer);
  loadingHideTimer = setTimeout(() => els.appLoader?.classList.add('hidden'), delay);
}
window.addEventListener('load', () => softHideLoader(450));
setTimeout(() => softHideLoader(900), 900);

const GUIDE_KEY = 'ryuuWerewolfGuideHiddenV1';
function applyGuideVisibility() {
  const hidden = localStorage.getItem(GUIDE_KEY) === '1';
  els.guidePanel?.classList.toggle('hidden', hidden);
  els.guideHelp?.classList.toggle('hidden', !hidden);
}
els.guideClose?.addEventListener('click', () => {
  localStorage.setItem(GUIDE_KEY, '1');
  applyGuideVisibility();
});
els.guideHelp?.addEventListener('click', () => {
  localStorage.removeItem(GUIDE_KEY);
  applyGuideVisibility();
});
applyGuideVisibility();

renderResumeBox();
setTimeout(() => requestRoomList(false), 250);

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
  localStorage.setItem(SESSION_KEY, JSON.stringify({ code, playerId, clientId, account: accountProfile?.username || savedAuth()?.username || null, savedAt: Date.now() }));
  renderResumeBox();
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  currentRoomCode = null;
  renderResumeBox();
}

function resetLocalRoomStateForFreshJoin() {
  // Bersihkan bekas room lama di sisi browser supaya saat pindah room state benar-benar fresh.
  roomState = null;
  me = null;
  selectedActionType = 'heal';
  mayorVoteLockedTarget = null;
  activeGameTab = 'actions';
  reconnectInFlight = false;
  lastReconnectAttemptAt = 0;
  lastAutoReconnectAt = 0;
  hadSocketDisconnect = false;
  allowAutoReconnectOnce = false;
  localStorage.setItem('ryuuGameTab', activeGameTab);
  if (localStream) leaveVoice();
  peers.forEach(pc => pc.close());
  peers.clear();
  if (els.remoteAudios) els.remoteAudios.innerHTML = '';
}

function renderResumeBox() {
  const session = getSession();
  if (!els.resumeBox) return;
  els.resumeBox.classList.toggle('hidden', !session?.code || !session?.playerId);
  if (session?.code) els.resumeText.textContent = `Room ${session.code} tersimpan. Klik reconnect untuk masuk ulang.`;
}

function reconnectFromSavedSession(showError = true, reason = 'manual') {
  const session = getSession();
  if (!session?.code || !session?.playerId) {
    if (showError) toast('Tidak ada session', 'Belum ada room terakhir untuk reconnect.');
    return;
  }
  const now = Date.now();
  if (!showError && reason !== 'socket-reconnect' && reason !== 'auto-login-after-disconnect') return;
  if (!showError && currentRoomCode && session.code !== currentRoomCode) return;
  if (!showError && !hadSocketDisconnect && !allowAutoReconnectOnce) return;
  if (!showError && socket.id && lastRecoveredSocketId === socket.id) return;
  if (reconnectInFlight) return;
  if (!showError && now - lastAutoReconnectAt < 4500) return;
  if (now - lastReconnectAttemptAt < 900) return;
  lastReconnectAttemptAt = now;
  if (!showError) lastAutoReconnectAt = now;
  reconnectInFlight = true;
  if (!showError && socket.id) lastRecoveredSocketId = socket.id;
  setConnectionStatus('reconnecting', 'Reconnecting...');
  if (showError) setUiLoading(true, 'Menghubungkan ulang ke room...');
  const name = accountProfile?.username || els.nameInput.value.trim() || localStorage.getItem('werewolfName') || 'Player';
  socket.emit('room:reconnect', { code: session.code, playerId: session.playerId, name, reason, auth: authPayload() }, (res) => {
    reconnectInFlight = false;
    if (!res?.ok) {
      setConnectionStatus(socket.connected ? 'online' : 'offline', socket.connected ? 'Online' : 'Offline');
      if (showError) toast('Reconnect gagal', res?.error || 'Session sudah tidak tersedia.');
      if (showError) softHideLoader(250);
      return;
    }
    saveSession(res.code, res.playerId);
    currentRoomCode = res.code;
    hadSocketDisconnect = false;
    allowAutoReconnectOnce = false;
    setConnectionStatus('online', 'Online');
    enterGame();
    if (showError) toast('Reconnect berhasil', `Kamu kembali ke room ${res.code}.`);
    softHideLoader(showError ? 550 : 120);
  });
}

function setConnectionStatus(type, text) {
  if (!els.reconnectStatus) return;
  els.reconnectStatus.className = `reconnect-status ${type === 'offline' ? 'offline' : type === 'reconnecting' ? 'reconnecting' : ''}`;
  els.reconnectStatus.textContent = text;
}

els.createBtn.onclick = () => {
  if (!accountProfile) return toast('Login dulu', 'Daftar atau login akun pemain sebelum membuat room.');
  const name = accountProfile.username;
  els.nameInput.value = name;
  if (!name) return toast('Nama belum diisi', 'Isi nama pemain dulu.');
  const roomName = els.roomNameInput?.value?.trim() || `${name}'s Room`;
  const password = els.roomPasswordInput?.value?.trim() || '';
  localStorage.setItem('werewolfName', name);
  localStorage.setItem('werewolfRoomName', roomName);
  setUiLoading(true, 'Membuat room...');
  socket.emit('room:create', { name, roomName, password, clientId, auth: authPayload() }, (res) => {
    if (!res?.ok) { softHideLoader(250); return toast('Gagal buat room', res?.error || 'Coba lagi.'); }
    resetLocalRoomStateForFreshJoin();
    saveSession(res.code, res.playerId || clientId);
    enterGame();
  });
};

els.joinBtn.onclick = () => {
  if (!accountProfile) return toast('Login dulu', 'Daftar atau login akun pemain sebelum join room.');
  const name = accountProfile.username;
  els.nameInput.value = name;
  const code = els.codeInput.value.trim().toUpperCase();
  if (!name || !code) return toast('Data belum lengkap', 'Isi nama dan kode room.');
  localStorage.setItem('werewolfName', name);
  const password = els.roomPasswordInput?.value?.trim() || '';
  setUiLoading(true, 'Masuk ke room...');
  socket.emit('room:join', { name, code, password, clientId, auth: authPayload() }, (res) => {
    if (!res?.ok) { softHideLoader(250); return toast('Gagal join room', res?.error || 'Coba lagi.'); }
    resetLocalRoomStateForFreshJoin();
    saveSession(res.code, res.playerId || clientId);
    enterGame();
  });
};

els.refreshRoomsBtn?.addEventListener('click', () => requestRoomList(true));

function requestRoomList(showToast = false) {
  socket.emit('rooms:list-request', {}, (res) => {
    if (res?.ok) {
      latestRoomList = res.rooms || [];
      renderRoomBrowser();
      if (showToast) toast('Daftar room diperbarui', `${latestRoomList.length} room ditemukan.`);
    } else if (showToast) {
      toast('Gagal refresh room', res?.error || 'Coba lagi.');
    }
  });
}

function renderRoomBrowser() {
  if (!els.roomList) return;
  const rooms = latestRoomList || [];
  if (els.roomListStatus) {
    els.roomListStatus.textContent = rooms.length ? `${rooms.length} room tersedia. Pilih Join untuk masuk.` : 'Belum ada room aktif. Buat room baru sebagai host.';
  }
  els.roomList.innerHTML = rooms.map(room => {
    const locked = room.hasPassword ? '🔒' : '🌐';
    const phase = phaseName(room.phase);
    const disabled = room.phase !== 'lobby' ? 'disabled' : '';
    const status = room.phase === 'lobby' ? 'Bisa join' : 'Sudah mulai';
    return `<div class="room-card ${room.hasPassword ? 'locked' : ''}">
      <div class="room-card-main">
        <div class="room-card-title"><span>${locked}</span><b>${escapeHtml(room.name || 'Lobby Werewolf')}</b></div>
        <div class="room-card-meta">Kode ${escapeHtml(room.code)} • Host ${escapeHtml(room.hostName || '-')} • ${escapeHtml(phase)}</div>
        <div class="room-card-stats"><span>${room.connectedCount || 0}/${room.maxPlayers || 16} online</span><span>${room.playerCount || 0} pemain</span><span>${status}</span></div>
      </div>
      <button class="btn primary small" ${disabled} onclick="joinListedRoom('${room.code}', ${room.hasPassword ? 'true' : 'false'})">Join</button>
    </div>`;
  }).join('');
}

window.joinListedRoom = (code, hasPassword) => {
  if (!accountProfile) return toast('Login dulu', 'Daftar atau login akun pemain sebelum join lobby orang.');
  const name = accountProfile.username;
  els.nameInput.value = name;
  if (!name) return toast('Nama belum diisi', 'Isi nama pemain dulu sebelum join room.');
  let password = els.roomPasswordInput?.value?.trim() || '';
  if (hasPassword && !password) {
    password = prompt('Room ini memakai password. Masukkan password room:') || '';
  }
  localStorage.setItem('werewolfName', name);
  els.codeInput.value = code;
  if (els.roomPasswordInput && password) els.roomPasswordInput.value = password;
  setUiLoading(true, 'Masuk ke room...');
  socket.emit('room:join', { name, code, password, clientId, auth: authPayload() }, (res) => {
    if (!res?.ok) { softHideLoader(250); return toast('Gagal join room', res?.error || 'Coba lagi.'); }
    resetLocalRoomStateForFreshJoin();
    saveSession(res.code, res.playerId || clientId);
    enterGame();
  });
};

function enterGame() {
  els.accountPage?.classList.add('hidden');
  els.login.classList.add('hidden');
  els.game.classList.remove('hidden');
  softHideLoader(650);
}

function showMenuOnly() {
  softHideLoader(100);
  els.accountPage?.classList.add('hidden');
  els.game.classList.add('hidden');
  els.login.classList.remove('hidden');
  showMenuRoute('home');
  renderResumeBox();
  toast('Menu awal', 'Session room masih tersimpan. Buka halaman Buat Room lalu tekan Reconnect untuk kembali.');
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
  const shouldRecoverRoom = hadSocketDisconnect && !els.game.classList.contains('hidden') && !!getSession()?.code;
  autoLoginAccount(true, shouldRecoverRoom);
  requestRoomList(false);
});

socket.io.on('reconnect_attempt', () => setConnectionStatus('reconnecting', 'Reconnecting...'));
socket.on('disconnect', () => { hadSocketDisconnect = true; reconnectInFlight = false; setConnectionStatus('offline', 'Offline'); });
socket.on('connect_error', () => setConnectionStatus('offline', 'Koneksi gagal'));

socket.on('rooms:list', (rooms) => {
  latestRoomList = Array.isArray(rooms) ? rooms : [];
  renderRoomBrowser();
});

socket.on('shop:catalog', ({ shop, crates, leaderboards } = {}) => {
  if (Array.isArray(shop)) shopCatalog = shop;
  if (Array.isArray(crates)) crateCatalog = crates;
  if (leaderboards) latestLeaderboards = leaderboards;
  renderAccountHub();
});

socket.on('profile:update', ({ profile, shop, crates, social, leaderboards } = {}) => {
  if (profile) accountProfile = profile;
  if (Array.isArray(shop)) shopCatalog = shop;
  if (Array.isArray(crates)) crateCatalog = crates;
  if (social) latestSocial = social;
  if (leaderboards) latestLeaderboards = leaderboards;
  renderAccountHub();
});
socket.on('social:update', ({ social, profile } = {}) => {
  if (social) latestSocial = social;
  if (profile) accountProfile = profile;
  renderAccountHub();
  if (els.accountPage && !els.accountPage.classList.contains('hidden')) refreshAccountPage();
});
socket.on('social:room-invite', (invite) => {
  latestSocial.roomInvites = [invite, ...(latestSocial.roomInvites || [])].slice(0, 10);
  toast('Invite lobby', `${invite.from} mengajak kamu ke ${invite.roomName || invite.code}.`);
  renderAccountHub();
});

socket.on('reward:summary', ({ points, won, profile } = {}) => {
  if (profile) accountProfile = profile;
  renderAccountHub();
  toast(won ? 'Reward kemenangan' : 'Reward partisipasi', `+${points || 0} poin ditambahkan ke profilmu.`);
});

socket.on('room:state', (state) => {
  if (socket.connected) setConnectionStatus('online', 'Online');
  const prevPhase = roomState?.phase;
  roomState = state;
  if (state?.music && window.receiveSharedRoomMusic) window.receiveSharedRoomMusic(state.music, 'room-state');
  if (state?.code) currentRoomCode = state.code;
  if (state?.phase !== 'mayorVote') mayorVoteLockedTarget = null;
  if (prevPhase !== state?.phase && ['mayorVote','night','voting','hunter'].includes(state?.phase)) setGameTab('actions', true);
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
  if (els.roomNameLabel) els.roomNameLabel.textContent = roomState.name ? roomState.name : 'ROOM';
  els.phaseTitle.textContent = phaseName(roomState.phase);
  els.phaseLine.textContent = roomState.nightEvent ? `${phaseHint(roomState.phase)} • ${roomState.nightEvent.emoji} ${roomState.nightEvent.name}` : phaseHint(roomState.phase);
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
  renderVoiceMembers();
  renderActions();
  renderLogs();
  renderGameProfileBox();
  if (window.refreshRoomMusicControls) window.refreshRoomMusicControls();
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
  const roleVisible = !!(roomState?.gameStarted && roomState?.phase !== 'lobby' && me?.role);
  if (!roleVisible) {
    els.roleCard.className = 'role-card empty';
    els.roleCard.innerHTML = '<b>Belum ada role</b><span>Role akan diacak setelah host menekan Start Game.</span>';
    els.privateInfo.textContent = 'Belum ada informasi rahasia. Tunggu game dimulai.';
    return;
  }
  const meta = ROLE_META[me.role] || me.roleMeta || { emoji:'', aura:'', desc:'' };
  const art = roleAsset(me.role);
  els.roleCard.className = `role-card role-card-tcg ${meta.aura}`;
  els.roleCard.innerHTML = `<div class="role-card-art-wrap"><img class="role-card-art" src="${art}" alt="${escapeHtml(me.role)} TCG card" loading="lazy"></div><div class="role-name">${escapeHtml(me.role)}</div><div class="role-desc">${escapeHtml(meta.desc)}</div>${me.equippedPower ? `<div class="power-mini">Power aktif: ${escapeHtml(itemName(me.equippedPower))}</div>` : ''}`;
  const extra = [];
  if (me.isMayor) extra.push(`👑 Kamu adalah Kepala Desa. Vote kamu bernilai ${me.voteWeight || 2} suara.`);
  if (me.equippedPower) extra.push(`⚡ Power Item: ${itemName(me.equippedPower)}.`);
  if (roomState?.phase === 'night' && Number.isFinite(me.remainingActions)) extra.push(`🌙 Sisa aksi malam: ${me.remainingActions}.`);
  if (me.lastInfo) extra.push(`🔎 ${me.lastInfo}`);
  if (me.role === 'Witch') extra.push(`🧪 Heal: ${me.witchHealUsed ? 'habis' : 'tersedia'} • Poison: ${me.witchPoisonUsed ? 'habis' : 'tersedia'}`);
  if (me.role === 'Priest') extra.push(`⛪ Holy Shield: ${me.priestBlessUsed ? 'habis' : 'tersedia'}`);
  if (me.role === 'Prince') extra.push(`👑 Royal Immunity: ${me.princeShieldUsed ? 'sudah terpakai' : 'masih aktif'}`);
  if (me.role === 'Cursed Villager') extra.push(me.cursedTurned ? '🌘 Kutukan sudah bangkit. Kamu kini Werewolf.' : '🌘 Kutukan belum bangkit. Jika diserang Werewolf, kamu berubah.');
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
    const badge = p.badge ? `<span class="pill">${escapeHtml(itemEmoji(p.badge))} ${escapeHtml(itemName(p.badge))}</span>` : '';
    const power = p.power ? `<span class="pill">⚡ ${escapeHtml(itemName(p.power))}</span>` : '';
    const avatar = p.avatar ? `<img class="avatar-img ${escapeHtml(frameClass(p.frame))}" src="${escapeHtml(p.avatar)}" alt="avatar">` : escapeHtml(initial);
    return `<div class="player ${escapeHtml(p.skin || '')} ${p.alive ? '' : 'dead'} ${p.connected ? '' : 'offline'}">
      <div class="avatar">${avatar}</div>
      <div><div class="p-name">${escapeHtml(p.name)}${p.id === me?.id ? ' (Kamu)' : ''}</div><div class="p-meta">${host}${mayor}${dead}${offline}${voice}${role}${badge}${power}</div></div>
      ${me?.isHost && roomState.phase === 'lobby' && p.id !== me.id ? `<button class="btn danger small" onclick="kickPlayer('${p.id}')">Kick</button>` : ''}
    </div>`;
  }).join('');
}

window.kickPlayer = (id) => socket.emit('game:kick', { playerId: id });

function renderVoiceMembers() {
  if (!els.voiceMembers) return;
  const players = roomState?.players || [];
  const voiced = players.filter(p => p.voice && p.connected);
  if (!voiced.length) {
    els.voiceMembers.className = 'voice-members empty';
    els.voiceMembers.textContent = 'Belum ada yang join voice';
    return;
  }
  els.voiceMembers.className = 'voice-members';
  els.voiceMembers.innerHTML = voiced.map(p => {
    const initial = (p.name || '?').slice(0,1).toUpperCase();
    const avatar = p.avatar
      ? `<img src="${escapeHtml(p.avatar)}" alt="${escapeHtml(p.name)}" onerror="this.replaceWith(document.createTextNode('${escapeHtml(initial)}'))">`
      : `<span>${escapeHtml(initial)}</span>`;
    const self = p.id === me?.id ? '<small>Kamu</small>' : '';
    return `<div class="voice-member ${p.id === me?.id ? 'self' : ''}"><div class="voice-avatar">${avatar}</div><b>${escapeHtml(p.name)}</b>${self}<i></i></div>`;
  }).join('');
}

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
    const eventText = me.nightEvent ? ` Event: ${me.nightEvent.emoji} ${me.nightEvent.name}.` : '';
    if (me.actionDone) {
      hint = 'Aksi malam kamu sudah habis. Tunggu sampai pagi.' + eventText;
      buttons = [];
    } else if (role === 'Werewolf' || role === 'Alpha Werewolf' || role === 'Sorcerer') {
      hint = `Werewolf: pilih target untuk dibunuh. Sisa aksi: ${me.remainingActions ?? 1}.` + eventText;
      const wolfIds = new Set(me.wolfTeamIds || []);
      buttons = aliveOthers.filter(p => !wolfIds.has(p.id)).map(p => actionButton(p, 'wolfKill'));
    } else if (role === 'Seer') {
      hint = `Seer: pilih pemain untuk diterawang. Sisa terawangan: ${me.remainingActions ?? 1}.` + eventText;
      buttons = aliveOthers.map(p => actionButton(p, 'seer'));
    } else if (role === 'Doctor') {
      hint = `Doctor: pilih pemain untuk dilindungi. Sisa protect: ${me.remainingActions ?? 1}.` + eventText;
      buttons = aliveTargets.map(p => actionButton(p, 'doctor'));
    } else if (role === 'Bodyguard') {
      hint = `Bodyguard: pilih pemain lain untuk dijaga. Sisa guard: ${me.remainingActions ?? 1}.` + eventText;
      buttons = aliveOthers.map(p => actionButton(p, 'guard'));
    } else if (role === 'Priest') {
      hint = me.priestBlessUsed ? 'Holy Shield kamu sudah habis.' : 'Priest: pilih 1 pemain untuk Holy Shield. Skill ini hanya sekali per game.' + eventText;
      if (!me.priestBlessUsed) buttons = aliveTargets.map(p => actionButton(p, 'priest'));
    } else if (role === 'Witch') {
      hint = `Witch: pilih ramuan dulu, lalu target. Sisa aksi malam: ${me.remainingActions ?? 1}.` + eventText;
      const controls = document.createElement('div');
      controls.className = 'voice-actions';
      controls.innerHTML = `<button class="btn secondary small" id="healMode" ${me.witchHealUsed ? 'disabled' : ''}>Heal</button><button class="btn secondary small" id="poisonMode" ${me.witchPoisonUsed ? 'disabled' : ''}>Poison</button>`;
      els.targetGrid.appendChild(controls);
      setTimeout(() => {
        $('healMode')?.addEventListener('click', () => { selectedActionType = 'heal'; toast('Mode Witch', 'Pilih target untuk Heal.'); });
        $('poisonMode')?.addEventListener('click', () => { selectedActionType = 'poison'; toast('Mode Witch', 'Pilih target untuk Poison.'); });
      });
      if (!me.witchHealUsed || !me.witchPoisonUsed) buttons = aliveTargets.map(p => actionButton(p, 'witch'));
    } else if (role === 'Medium') {
      hint = 'Medium: kamu bisa membaca chat Dead/Medium. Pakai informasi arwah saat siang.' + eventText;
    } else if (role === 'Cursed Villager') {
      hint = 'Cursed Villager: tidak punya aksi aktif. Jika diserang Werewolf, kutukan bisa mengubahmu.' + eventText;
    } else if (role === 'Prince') {
      hint = 'Prince: tidak punya aksi malam. Kamu bisa selamat dari voting satu kali.' + eventText;
    } else {
      hint = 'Malam ini kamu tidak punya aksi. Perhatikan dan tunggu pagi.' + eventText;
    }
  }
  if (roomState.phase === 'day') hint = 'Diskusikan siapa yang mencurigakan sebelum voting.';
  if (roomState.phase === 'voting' && me.alive) {
    hint = `Pilih target eliminasi. Suara kamu bernilai ${me.voteWeight || (me.isMayor ? 2 : 1)}.`;
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
  const selected = (mode === 'mayor' && mayorVoteLockedTarget === p.id) || (mode === 'vote' && me?.voteTarget === p.id) || (me?.mayorVoteTarget === p.id && mode === 'mayor');
  return `<button class="target ${p.alive ? '' : 'dead'} ${selected ? 'selected' : ''}" ${selected ? 'disabled' : ''} onclick="doAction('${mode}','${p.id}')"><span class="name">${escapeHtml(p.name)}</span><span class="meta">${selected ? 'Terkunci' : escapeHtml(meta)}</span></button>`;
}

window.doAction = (mode, id) => {
  if (mode === 'mayor') {
    if (mayorVoteLockedTarget) return toast('Vote Kades sudah terkunci', 'Kamu sudah memilih Kades untuk fase ini.');
    mayorVoteLockedTarget = id;
    renderActions();
    return socket.emit('mayor:vote', { targetId: id });
  }
  if (mode === 'vote') return socket.emit('vote:cast', { targetId: id });
  if (mode === 'hunter') return socket.emit('hunter:shoot', { targetId: id });
  if (mode === 'wolfKill') return socket.emit('night:action', { targetId: id, type: 'kill' });
  if (mode === 'seer') return socket.emit('night:action', { targetId: id, type: 'scan' });
  if (mode === 'doctor') return socket.emit('night:action', { targetId: id, type: 'protect' });
  if (mode === 'guard') return socket.emit('night:action', { targetId: id, type: 'guard' });
  if (mode === 'priest') return socket.emit('night:action', { targetId: id, type: 'bless' });
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
    roleReveal: '/assets/tcg/templates/template-epic.svg', mayor: effectAsset('Mayor Crown'), nightRole: effectAsset('Blood Moon'), attack: effectAsset('Werewolf Maul'), death: effectAsset('Death Smoke'), saved: effectAsset('Guard Wall'), seer: effectAsset('Seer Vision'), heal: effectAsset('Doctor Pulse'), guard: effectAsset('Guard Wall'), poison: effectAsset('Witch Poison'), vote: effectAsset('Mayor Crown'), execution: effectAsset('Death Smoke'), hunter: effectAsset('Hunter Shot'), hunterShot: effectAsset('Hunter Shot'), victory: effectAsset('Victory Nova'), defeat: effectAsset('Death Smoke'), wolfWin: effectAsset('Alpha Rend'), villageWin: effectAsset('Victory Nova'), jesterWin: '/assets/tcg/roles/role-jester.svg', blocked: effectAsset('Guard Wall'), cursed: effectAsset('Blood Moon'), prince: effectAsset('Mayor Crown'), bless: effectAsset('Guard Wall'), powerItem: effectAsset('Double Vision'), crate: '/assets/tcg/templates/template-legendary.svg'
  };
  const actorAsset = map[a.type] || '/assets/wolf-attack.svg';
  const targetAsset = a.type === 'attack' ? '/assets/rarity-mythic.svg' : a.type === 'seer' ? '/assets/seer-orb.svg' : a.type === 'heal' ? '/assets/doctor-drone.svg' : a.type === 'death' ? '/assets/rarity-common.svg' : '/assets/rarity-legendary.svg';
  const card = els.cinematic?.querySelector('.cinematic-card');
  if (card) {
    card.className = `cinematic-card scene-${String(a.type || 'event').replace(/[^a-zA-Z0-9_-]/g,'')}`;
    let scene = card.querySelector('.cinematic-3d-scene');
    if (!scene) {
      scene = document.createElement('div');
      scene.className = 'cinematic-3d-scene';
      card.insertBefore(scene, card.firstChild);
    }
    scene.innerHTML = `<span class="scene-moon"></span><span class="scene-shadow"></span><span class="scene-actor asset-actor"><img src="${actorAsset}" alt=""></span><span class="scene-target asset-target"><img src="${targetAsset}" alt=""></span><span class="scene-particles"></span>`;
  }
  els.cinematicIcon.innerHTML = `<img class="cinematic-main-asset" src="${actorAsset}" alt="">`;
  els.cinematicTitle.textContent = a.title || 'Event';
  els.cinematicText.textContent = a.text || '';
  els.cinematicTitle.className = a.aura || '';
  els.cinematic.classList.remove('hidden');
  const duration = ['roleReveal','victory','defeat','wolfWin','villageWin','jesterWin','attack','death','seer','heal','guard','hunterShot'].includes(a.type) ? 4600 : 2800;
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

const CRATE_ASSETS = { crate_moon: '/assets/crate-moon.svg', crate_blood: '/assets/crate-blood.svg', crate_royal: '/assets/crate-royal.svg' };
const RARITY_ASSETS = { common: '/assets/rarity-common.svg', rare: '/assets/rarity-rare.svg', epic: '/assets/rarity-epic.svg', legendary: '/assets/rarity-legendary.svg', mythic: '/assets/rarity-mythic.svg' };
const ITEM_ASSETS = {
  skin: '/assets/wolf-attack.svg', frame: '/assets/guard-shield.svg', badge: '/assets/trophy.svg', power: '/assets/rarity-legendary.svg', points: '/assets/coin-stack.svg', item: '/assets/inventory-box.svg'
};
function crateAsset(crateId) { return CRATE_ASSETS[crateId] || '/assets/inventory-box.svg'; }
function rarityAsset(rarity) { return RARITY_ASSETS[String(rarity || 'common').toLowerCase()] || RARITY_ASSETS.common; }
function rewardAsset(reward = {}) {
  const name = String(reward.name || '').toLowerCase();
  if (reward.type === 'points' || name.includes('poin') || name.includes('jackpot')) return ITEM_ASSETS.points;
  if (name.includes('wolf') || name.includes('fang') || name.includes('abyss')) return '/assets/wolf-attack.svg';
  if (name.includes('seer') || name.includes('vision') || name.includes('lens')) return '/assets/seer-orb.svg';
  if (name.includes('doctor') || name.includes('kit')) return '/assets/doctor-drone.svg';
  if (name.includes('guard') || name.includes('shield') || name.includes('charm')) return '/assets/guard-shield.svg';
  if (name.includes('witch') || name.includes('vial')) return '/assets/witch-vial.svg';
  if (name.includes('hunter')) return '/assets/hunter-bow.svg';
  if (name.includes('badge') || name.includes('legend')) return '/assets/trophy.svg';
  return rarityAsset(reward.rarity);
}
function rewardLabel(reward = {}) {
  return `${reward.rarityLabel || 'Reward'}: ${reward.name || 'Hadiah'}${reward.qty ? ' x' + reward.qty : ''}`;
}
function pushInventoryToast(reward = {}) {
  const div = document.createElement('div');
  div.className = `toast loot-toast rarity-${escapeHtml(reward.rarity || 'common')}`;
  div.innerHTML = `<img src="${rewardAsset(reward)}" alt="reward"><div><b>Masuk Inventory</b><span>${escapeHtml(rewardLabel(reward))}</span></div>`;
  els.toastStack.appendChild(div);
  setTimeout(() => div.remove(), 6200);
}


// Account, shop, inventory, leaderboard
const AUTH_KEY = 'ryuuWerewolfAccountV3';
let selectedAvatarData = '';
let activeHubTab = 'profile';
let activeLbTab = 'points';

function itemById(id) { return shopCatalog.find(x => x.id === id) || null; }
function itemName(id) { return itemById(id)?.name || id || '-'; }
function itemEmoji(id) { return itemById(id)?.emoji || '🎁'; }
function frameClass(id) { return itemById(id)?.className || ''; }
function savedAuth() { try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch { return null; } }
function saveAuth(username, pin) { localStorage.setItem(AUTH_KEY, JSON.stringify({ username, pin })); }
function authPayload() {
  const saved = savedAuth();
  if (saved?.username && saved?.pin) return saved;
  const username = accountProfile?.username || els.authName?.value?.trim() || '';
  const pin = els.authPin?.value?.trim() || '';
  return { username, pin };
}

function autoLoginAccount(force = false, recoverRoomAfterLogin = false) {
  const saved = savedAuth();
  if (!saved?.username || !saved?.pin) { renderAccountHub(); return; }
  // Force re-auth after Socket.IO reconnect because the server auth session is tied to socket.id.
  if (!force && accountProfile) { renderAccountHub(); return; }
  socket.emit('auth:login', saved, (res) => {
    if (res?.ok) {
      accountProfile = res.profile;
      shopCatalog = res.shop || shopCatalog;
      crateCatalog = res.crates || crateCatalog;
      latestSocial = res.social || latestSocial;
      latestLeaderboards = res.leaderboards || latestLeaderboards;
      els.nameInput.value = accountProfile.username;
      renderAccountHub();
      if (recoverRoomAfterLogin && !els.game.classList.contains('hidden') && getSession()?.code) {
        allowAutoReconnectOnce = true;
        setTimeout(() => reconnectFromSavedSession(false, 'auto-login-after-disconnect'), 350);
      }
    } else {
      if (!accountProfile) renderAccountHub();
    }
  });
}

els.avatarInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 350000) return toast('Foto terlalu besar', 'Gunakan gambar kecil di bawah 350 KB agar cepat disimpan.');
  selectedAvatarData = await fileToDataUrl(file);
  if (accountProfile) {
    socket.emit('auth:avatar', { avatar: selectedAvatarData }, (res) => {
      if (!res?.ok) return toast('Upload gagal', res?.error || 'Coba gambar lain.');
      accountProfile = res.profile;
      renderAccountHub();
      toast('Avatar disimpan', 'Foto profil kamu berhasil diperbarui.');
    });
  } else toast('Avatar siap', 'Klik Daftar untuk memakai foto ini.');
});
function fileToDataUrl(file) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); }); }

els.registerBtn?.addEventListener('click', () => {
  const username = els.authName.value.trim();
  const pin = els.authPin.value.trim();
  socket.emit('auth:register', { username, pin, avatar: selectedAvatarData }, (res) => {
    if (!res?.ok) return toast('Daftar gagal', res?.error || 'Coba lagi.');
    accountProfile = res.profile;
    shopCatalog = res.shop || shopCatalog;
    crateCatalog = res.crates || crateCatalog;
    latestSocial = res.social || latestSocial;
    latestLeaderboards = res.leaderboards || latestLeaderboards;
    saveAuth(username, pin);
    els.nameInput.value = accountProfile.username;
    renderAccountHub();
    toast('Akun dibuat', `Selamat datang, ${accountProfile.username}. Bonus awal 500 poin.`);
  });
});
els.loginBtn?.addEventListener('click', () => {
  const username = els.authName.value.trim();
  const pin = els.authPin.value.trim();
  socket.emit('auth:login', { username, pin }, (res) => {
    if (!res?.ok) return toast('Login gagal', res?.error || 'Coba lagi.');
    accountProfile = res.profile;
    shopCatalog = res.shop || shopCatalog;
    crateCatalog = res.crates || crateCatalog;
    latestSocial = res.social || latestSocial;
    latestLeaderboards = res.leaderboards || latestLeaderboards;
    saveAuth(username, pin);
    els.nameInput.value = accountProfile.username;
    renderAccountHub();
    toast('Login berhasil', `Masuk sebagai ${accountProfile.username}.`);
  });
});

for (const [btn, tab] of [[els.profileTabBtn,'profile'],[els.shopTabBtn,'shop'],[els.invTabBtn,'inv'],[els.lbTabBtn,'lb'],[els.crateTabBtn,'crates'],[els.friendsTabBtn,'friends']]) btn?.addEventListener('click', () => openAccountPage(tab));
els.accountPageClose?.addEventListener('click', closeAccountPage);

function renderAccountHub() {
  if (!els.accountStatus) return;
  const p = accountProfile;
  els.accountHub?.classList.toggle('logged-in', !!p);
  els.accountStatus.textContent = p ? `Login: ${p.username}` : 'Belum login';
  if (p) {
    els.nameInput.value = p.username;
    els.nameInput.disabled = true;
    els.authName.value = p.username;
    els.authPin.value = '';
    els.profileSummary?.classList.remove('hidden');
    const s = p.stats || {};
    const eq = p.equipped || {};
    els.profileSummary.innerHTML = `<img class="profile-avatar ${escapeHtml(frameClass(eq.frame))}" src="${escapeHtml(p.avatar)}" alt="avatar"><div><div class="profile-name">${escapeHtml(p.username)} ${p.isAdmin ? '<span class="owner-chip">OWNER</span>' : ''} • ${escapeHtml(pointsText(p))} poin</div><div class="profile-stats"><span class="pill">🏆 ${s.wins || 0} Win</span><span class="pill">🎮 ${s.games || 0} Main</span><span class="pill">🐺 ${s.teamWins?.werewolf || 0} Wolf Win</span><span class="pill">🏡 ${s.teamWins?.village || 0} Village Win</span><span class="pill">🔥 Streak ${s.winStreak || 0}</span></div><div class="power-note">Equip: ${eq.skin ? itemName(eq.skin) : 'No skin'} • ${eq.frame ? itemName(eq.frame) : 'No frame'} • ${eq.badge ? itemName(eq.badge) : 'No badge'} • ${eq.power ? itemName(eq.power) : 'No power'} ${eq.power ? `• Stok ${accountProfile.inventory?.[eq.power] || 0}` : ''}</div></div>`;
  } else {
    els.nameInput.disabled = false;
    els.profileSummary?.classList.add('hidden');
  }
  renderProfilePanel(); renderShop(); renderInventory(); renderLeaderboard(); renderCrates(); renderFriends(); renderGameProfileBox();
  updateMenuAccountMini();
  if (els.accountPage && !els.accountPage.classList.contains('hidden')) refreshAccountPage();
}

function openAccountPage(tab = 'profile') {
  if (!accountProfile && tab !== 'profile') {
    showMenuRoute('account');
    return toast('Login dulu', 'Daftar atau login untuk membuka halaman ini.');
  }
  activeHubTab = tab;
  refreshAccountPage();
  els.game?.classList.add('hidden');
  els.login?.classList.add('hidden');
  els.accountPage?.classList.remove('hidden');
  if (els.accountPageClose) els.accountPageClose.textContent = '←';
  window.scrollTo({ top: 0, behavior: 'instant' });
}
function closeAccountPage() {
  els.accountPage?.classList.add('hidden');
  els.game?.classList.add('hidden');
  els.login?.classList.remove('hidden');
  showMenuRoute('home');
}
function refreshAccountPage() {
  const titles = {
    profile: ['Profil Pemain', 'Statistik, foto profil, badge, frame, dan equip aktif.'],
    shop: ['Shop', 'Beli skin permanen dan power item sekali pakai. Power bisa dibeli berkali-kali.'],
    inv: ['Inventory', 'Lihat stok item, equip skin/badge/frame, dan pilih power item yang akan dipakai.'],
    lb: ['Leaderboard Top 100', 'Peringkat berdasarkan poin, kemenangan, team Werewolf, dan team Village.'],
    crates: ['Open Crate / Gacha', 'Buka crate untuk mendapatkan item Common, Rare, Epic, Legendary, dan Mythic.'],
    friends: ['Friends & Invite Lobby', 'Tambah teman, terima request, dan invite teman ke lobby kamu.']
  };
  renderProfilePanel(); renderShop(); renderInventory(); renderLeaderboard(); renderCrates(); renderFriends();
  const [title, sub] = titles[activeHubTab] || titles.profile;
  if (els.accountPageTitle) els.accountPageTitle.textContent = title;
  if (els.accountPageSub) els.accountPageSub.textContent = sub;
  const source = activeHubTab === 'shop' ? els.shopPanel : activeHubTab === 'inv' ? els.inventoryPanel : activeHubTab === 'lb' ? els.leaderboardPanel : activeHubTab === 'crates' ? els.cratePanel : activeHubTab === 'friends' ? els.friendsPanel : els.profilePanel;
  if (els.accountPageContent && source) els.accountPageContent.innerHTML = source.innerHTML;
  attachCopiedProfileAvatarHandler();
}
function attachCopiedProfileAvatarHandler() {
  const input = els.accountPageContent?.querySelector('#profileAvatarInput');
  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 350000) return toast('Foto terlalu besar', 'Gunakan gambar kecil di bawah 350 KB.');
    const avatar = await fileToDataUrl(file);
    socket.emit('auth:avatar', { avatar }, (res) => {
      if (!res?.ok) return toast('Upload gagal', res?.error || 'Coba gambar lain.');
      accountProfile = res.profile;
      renderAccountHub();
      toast('Avatar disimpan', 'Foto profil berhasil diperbarui.');
    });
  });
}


function pointsText(p) { return p?.isAdmin ? '∞' : (p?.displayPoints || String(p?.points || 0)); }
function winRate(s = {}) { return s.games ? Math.round(((s.wins || 0) / s.games) * 100) : 0; }
function renderProfilePanel() {
  if (!els.profilePanel) return;
  const p = accountProfile;
  if (!p) {
    els.profilePanel.innerHTML = '<div class="mini-note">Login atau daftar dulu. Setelah login, kotak login otomatis hilang dan halaman ini berubah menjadi profil pemain.</div>';
    return;
  }
  const s = p.stats || {};
  const eq = p.equipped || {};
  els.profilePanel.innerHTML = `
    <div class="profile-page">
      <div class="profile-hero-card">
        <img class="profile-avatar big ${escapeHtml(frameClass(eq.frame))}" src="${escapeHtml(p.avatar)}" alt="avatar">
        <div>
          <div class="profile-name big">${escapeHtml(p.username)} ${p.isAdmin ? '<span class="owner-chip">OWNER</span>' : ''}</div>
          <div class="profile-points">💎 ${escapeHtml(pointsText(p))} poin</div>
          <div class="power-note">Equip: ${eq.skin ? itemName(eq.skin) : 'No skin'} • ${eq.frame ? itemName(eq.frame) : 'No frame'} • ${eq.badge ? itemName(eq.badge) : 'No badge'} • ${eq.power ? itemName(eq.power) : 'No power'}</div>
          <label class="btn secondary small avatar-change">Ganti Foto<input id="profileAvatarInput" type="file" accept="image/*"></label>
        </div>
      </div>
      <div class="stat-card-grid">
        <div class="stat-card"><b>${s.games || 0}</b><span>Total Main</span></div>
        <div class="stat-card"><b>${s.wins || 0}</b><span>Menang</span></div>
        <div class="stat-card"><b>${winRate(s)}%</b><span>Win Rate</span></div>
        <div class="stat-card"><b>${s.winStreak || 0}</b><span>Win Streak</span></div>
        <div class="stat-card"><b>${s.teamWins?.werewolf || 0}</b><span>Wolf Win</span></div>
        <div class="stat-card"><b>${s.teamWins?.village || 0}</b><span>Village Win</span></div>
      </div>
      <div class="mini-note">Shop, Inventory, dan Leaderboard sudah dipisah di tab sendiri agar layar HP/laptop lebih rapi.</div>
    </div>`;
  const input = document.getElementById('profileAvatarInput');
  input?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 350000) return toast('Foto terlalu besar', 'Gunakan gambar kecil di bawah 350 KB.');
    const avatar = await fileToDataUrl(file);
    socket.emit('auth:avatar', { avatar }, (res) => {
      if (!res?.ok) return toast('Upload gagal', res?.error || 'Coba gambar lain.');
      accountProfile = res.profile;
      renderAccountHub();
      toast('Avatar disimpan', 'Foto profil berhasil diperbarui.');
    });
  });
}

function renderShop() {
  if (!els.shopPanel) return;
  if (!accountProfile) { els.shopPanel.innerHTML = '<div class="mini-note">Login dulu untuk membuka Shop.</div>'; return; }
  if (!shopCatalog.length) { els.shopPanel.innerHTML = '<div class="mini-note">Shop belum dimuat.</div>'; return; }
  const points = accountProfile?.isAdmin ? Infinity : Number(accountProfile?.points || 0);
  els.shopPanel.innerHTML = `<div class="shop-grid">${shopCatalog.map(item => {
    const count = Number(accountProfile?.inventory?.[item.id] || 0);
    const owned = count > 0;
    const equipped = accountProfile?.equipped?.[item.type] === item.id;
    const isPower = item.type === 'power';
    const buyText = isPower ? 'Beli +1' : 'Beli';
    const status = isPower ? `<span class="owned">Stok x${count}</span>` : (owned ? '<span class="owned">Dimiliki</span>' : '');
    const equipBtn = owned ? (equipped ? '<span class="equip-now">Dipakai</span>' : `<button class="btn secondary small" onclick="equipItem('${item.id}')">Equip</button>`) : '';
    const buyBtn = (isPower || !owned) ? `<button class="btn primary small" ${points < item.price ? 'disabled' : ''} onclick="buyItem('${item.id}')">${buyText}</button>` : '';
    return `<div class="shop-item ${item.type} game-asset-item rarity-${item.rarity || 'common'}"><div class="shop-top"><img class="item-asset" src="${rewardAsset(item)}" alt="item"><div><div class="shop-name">${escapeHtml(item.name)}</div><div class="shop-desc">${escapeHtml(item.desc)}</div></div><span class="badge">${isPower ? 'sekali pakai' : item.type}</span></div><div class="shop-actions"><span class="price">${item.price} poin</span><div class="item-stack">${status}${equipBtn}${buyBtn}</div></div></div>`;
  }).join('')}</div><div class="mini-note">Power item bersifat konsumsi: beli 1 = stok 1. Saat efeknya dipakai di game, stok berkurang 1. Dalam satu game satu power hanya bisa aktif satu kali.</div>`;
}
function renderInventory() {
  if (!els.inventoryPanel) return;
  const inv = accountProfile?.inventory || {};
  const owned = shopCatalog.filter(x => Number(inv[x.id] || 0) > 0);
  if (!accountProfile) { els.inventoryPanel.innerHTML = '<div class="mini-note">Login dulu untuk melihat inventory.</div>'; return; }
  if (!owned.length) { els.inventoryPanel.innerHTML = '<div class="mini-note">Inventory kosong. Beli item di Shop.</div>'; return; }
  els.inventoryPanel.innerHTML = `<div class="shop-grid">${owned.map(item => {
    const count = Number(inv[item.id] || 0);
    const equipped = accountProfile?.equipped?.[item.type] === item.id;
    return `<div class="shop-item ${item.type} game-asset-item rarity-${item.rarity || 'common'}"><div class="shop-top"><img class="item-asset" src="${rewardAsset(item)}" alt="item"><div><div class="shop-name">${escapeHtml(item.name)}</div><div class="shop-desc">${escapeHtml(item.desc)}</div></div></div><div class="shop-actions"><span class="owned">${item.type === 'power' ? `Stok x${count}` : 'Dimiliki'}</span>${equipped ? '<span class="equip-now">Dipakai</span>' : `<button class="btn secondary small" onclick="equipItem('${item.id}')">Equip</button>`}</div></div>`;
  }).join('')}</div><div class="mini-note">Equip power menentukan item yang siap dipakai. Stok power akan berkurang setelah efeknya benar-benar aktif di game.</div>`;
}

function renderLeaderboard() {
  if (!els.leaderboardPanel) return;
  if (!latestLeaderboards) { els.leaderboardPanel.innerHTML = '<div class="mini-note">Leaderboard belum dimuat.</div>'; return; }
  const tabs = [['points','Poin'],['overall','Overall'],['werewolf','Werewolf'],['village','Village'],['seer','Seer'],['doctor','Doctor']];
  const list = latestLeaderboards[activeLbTab] || [];
  els.leaderboardPanel.innerHTML = `<div class="leader-tabs">${tabs.map(([id,label]) => `<button onclick="setLbTab('${id}')" class="${activeLbTab===id?'active':''}">${label}</button>`).join('')}</div>${list.slice(0,100).map((u,i) => `<div class="leader-row"><div class="rank">#${i+1}</div><div><div class="leader-name">${escapeHtml(u.username)}</div><div class="leader-meta">Win ${u.stats?.wins || 0} • Main ${u.stats?.games || 0} • Wolf ${u.stats?.teamWins?.werewolf || 0} • Village ${u.stats?.teamWins?.village || 0}</div></div><b>${u.points || 0}</b></div>`).join('')}`;
}
window.setLbTab = (id) => { activeLbTab = id; renderLeaderboard(); if (els.accountPage && !els.accountPage.classList.contains('hidden')) refreshAccountPage(); };
window.buyItem = (itemId) => socket.emit('shop:buy', { itemId }, (res) => { if (!res?.ok) return toast('Gagal beli', res?.error || 'Poin belum cukup.'); accountProfile = res.profile; renderAccountHub(); if (els.accountPage && !els.accountPage.classList.contains('hidden')) refreshAccountPage(); pushInventoryToast(res.item || { name: itemId, rarity: 'rare' }); });
window.equipItem = (itemId) => socket.emit('shop:equip', { itemId }, (res) => { if (!res?.ok) return toast('Gagal equip', res?.error || 'Belum dimiliki.'); accountProfile = res.profile; renderAccountHub(); if (els.accountPage && !els.accountPage.classList.contains('hidden')) refreshAccountPage(); toast('Item dipakai', `${res.item?.name || itemId} sekarang aktif.`); });


function renderCrates() {
  if (!els.cratePanel) return;
  if (!accountProfile) { els.cratePanel.innerHTML = '<div class="mini-note">Login dulu untuk membuka crate.</div>'; return; }
  if (!crateCatalog.length) { els.cratePanel.innerHTML = '<div class="mini-note">Crate belum dimuat.</div>'; return; }
  const points = accountProfile?.isAdmin ? Infinity : Number(accountProfile?.points || 0);
  els.cratePanel.innerHTML = `<div class="crate-grid cinematic-crate-grid">${crateCatalog.map(c => {
    const weights = c.weights || {};
    return `<div class="crate-card crate-card-modern rarity-${c.id === 'crate_royal' ? 'legendary' : c.id === 'crate_blood' ? 'epic' : 'rare'}">
      <div class="crate-box crate-box-asset"><img src="${crateAsset(c.id)}" alt="${escapeHtml(c.name)}"><span class="crate-glow"></span></div>
      <div class="crate-title">${escapeHtml(c.name)}</div>
      <div class="shop-desc">${escapeHtml(c.desc || '')}</div>
      <div class="crate-odds modern-odds"><span>Rare ${weights.rare || 0}%</span><span>Epic ${weights.epic || 0}%</span><span>Legendary ${weights.legendary || 0}%</span><span>Mythic ${weights.mythic || 0}%</span></div>
      <div class="shop-actions"><span class="price">${c.price} poin</span><button class="btn primary small crate-open-btn" ${points < c.price ? 'disabled' : ''} onclick="openCrate('${c.id}')">Open Crate</button></div>
    </div>`;
  }).join('')}</div><div class="mini-note">Animasi crate memakai model spinner seperti case opening game: reward tetap ditentukan server, lalu animasi menampilkan suspense sebelum hadiah masuk inventory.</div>`;
}
let crateAnimationTimer = null;
function buildFakeRewardPool(finalReward, crate) {
  const rarities = ['common','rare','common','epic','common','rare','legendary','common','rare','epic','common','mythic'];
  const names = ['Moon Shard','Fang Token','Village Coin','Mystic Dust','Hunter Mark','Guard Core','Royal Glow','Blood Spark','Seer Prism','Lucky Drop','Shadow Chip','Legend Core','Night Crystal','Wolf Crest','Oracle Glass','Royal Sigil'];
  const pool = [];
  // Pool dibuat panjang agar di HP tidak pernah terlihat kosong saat rail berhenti.
  for (let i = 0; i < 72; i++) {
    const rarity = rarities[(i + Math.floor(Math.random()*rarities.length)) % rarities.length];
    pool.push({ rarity, name: names[i % names.length], asset: rarityAsset(rarity) });
  }
  const finalIndex = 55;
  pool[finalIndex] = { rarity: finalReward.rarity || 'rare', name: finalReward.name || 'Reward', asset: rewardAsset(finalReward), final: true };
  return { pool, finalIndex };
}
function showCrateOpening(crateId, reward, done) {
  const crate = crateCatalog.find(c => c.id === crateId) || {};
  if (!els.crateOpening || !els.caseRail) { done?.(); return; }
  clearTimeout(crateAnimationTimer);
  els.crateOpeningTitle.textContent = crate.name || 'Opening Crate';
  els.crateOpeningPrice.textContent = reward.rarityLabel || 'Rolling...';
  els.crateOpeningAsset.src = crateAsset(crateId);
  els.crateResult.classList.add('hidden');
  els.crateOpening.classList.remove('hidden');
  const { pool, finalIndex } = buildFakeRewardPool(reward, crate);
  els.caseRail.className = 'case-rail';
  els.caseRail.style.transition = 'none';
  els.caseRail.style.transform = 'translate3d(0,0,0)';
  els.caseRail.innerHTML = pool.map((it, idx) => `<div class="case-item rarity-${escapeHtml(it.rarity)} ${it.final ? 'final-slot' : ''}"><img src="${it.asset}" alt="item"><b>${escapeHtml(it.name)}</b><span>${escapeHtml(it.rarity)}</span></div>`).join('');

  requestAnimationFrame(() => {
    const spinner = els.crateOpening.querySelector('.case-spinner');
    const firstItem = els.caseRail.querySelector('.case-item');
    const railStyle = window.getComputedStyle(els.caseRail);
    const gap = parseFloat(railStyle.columnGap || railStyle.gap || '0') || 0;
    const itemW = Math.max(72, (firstItem?.getBoundingClientRect().width || 112) + gap);
    const spinnerW = spinner?.clientWidth || Math.min(window.innerWidth - 28, 720);
    const center = Math.max(0, spinnerW / 2 - itemW / 2);
    const jitter = Math.floor(Math.random() * Math.min(34, itemW * .34)) - Math.floor(Math.min(34, itemW * .34) / 2);
    const distance = -(finalIndex * itemW) + center + jitter;
    // Force reflow supaya transisi selalu dimulai dari awal, termasuk di mobile Chrome.
    void els.caseRail.offsetWidth;
    els.caseRail.style.transition = 'transform 4.8s cubic-bezier(.07,.74,.11,1)';
    els.caseRail.style.transform = `translate3d(${distance}px,0,0)`;
  });
  crateAnimationTimer = setTimeout(() => {
    els.caseRail.classList.add('settled');
    els.crateResultAsset.src = rewardAsset(reward);
    els.crateResultRarity.textContent = reward.rarityLabel || 'Reward';
    els.crateResultName.textContent = `${reward.name || 'Hadiah'}${reward.qty ? ' x' + reward.qty : ''}`;
    els.crateResultDesc.textContent = reward.type === 'points' ? 'Poin langsung ditambahkan ke profil.' : 'Item sudah masuk ke inventory kamu.';
    els.crateResultCard.className = `crate-result-card rarity-${reward.rarity || 'common'}`;
    els.crateResult.classList.remove('hidden');
    if (['legendary','mythic'].includes(String(reward.rarity))) launchConfetti();
    done?.();
  }, 5100);
}
function closeCrateOpening() {
  clearTimeout(crateAnimationTimer);
  els.crateOpening?.classList.add('hidden');
}
els.crateDoneBtn?.addEventListener('click', closeCrateOpening);
els.crateSkipBtn?.addEventListener('click', closeCrateOpening);
function launchConfetti() {
  const wrap = document.createElement('div');
  wrap.className = 'loot-confetti';
  wrap.innerHTML = Array.from({ length: 28 }, (_, i) => `<i style="--x:${Math.random()*100}vw;--d:${Math.random()*1.8+1.2}s;--r:${Math.random()*360}deg"></i>`).join('');
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 2600);
}
window.openCrate = (crateId) => {
  const crate = crateCatalog.find(c => c.id === crateId) || {};
  if (els.crateOpening) {
    els.crateOpening.classList.remove('hidden');
    els.crateOpeningTitle.textContent = crate.name || 'Opening Crate';
    els.crateOpeningPrice.textContent = 'Menghubungi server...';
    els.crateOpeningAsset.src = crateAsset(crateId);
    els.caseRail.innerHTML = '<div class="case-loading">Menyiapkan crate...</div>';
    els.crateResult.classList.add('hidden');
  } else setUiLoading(true, 'Membuka crate...');
  socket.emit('crate:open', { crateId }, (res) => {
    softHideLoader(250);
    if (!res?.ok) { closeCrateOpening(); return toast('Open crate gagal', res?.error || 'Poin belum cukup.'); }
    const r = res.reward || {};
    if (res.profile) accountProfile = res.profile;
    renderAccountHub();
    if (els.accountPage && !els.accountPage.classList.contains('hidden')) refreshAccountPage();
    showCrateOpening(crateId, r, () => {
      pushInventoryToast(r);
      toast('Crate terbuka', rewardLabel(r));
    });
  });
};

function renderFriends() {
  if (!els.friendsPanel) return;
  if (!accountProfile) { els.friendsPanel.innerHTML = '<div class="mini-note">Login dulu untuk fitur teman.</div>'; return; }
  const social = latestSocial || { friends: [], requests: [], sent: [], roomInvites: [] };
  els.friendsPanel.innerHTML = `
    <div class="friends-page">
      <div class="friend-search"><input id="friendSearchInput" placeholder="Cari username teman..." maxlength="18"><button class="btn primary small" onclick="searchFriend()">Cari</button></div>
      <div id="friendSearchResults" class="friend-list">${renderFriendSearchResults()}</div>
      <h4>📩 Invite Lobby</h4>
      <div class="friend-list">${(social.roomInvites || []).length ? social.roomInvites.map(inv => `<div class="friend-row"><div><b>${escapeHtml(inv.from)}</b><span>Mengajak ke ${escapeHtml(inv.roomName || inv.code)} • ${escapeHtml(inv.code)}</span></div><button class="btn primary small" onclick="joinInviteRoom('${escapeHtml(inv.code)}')">Join</button></div>`).join('') : '<div class="mini-note">Belum ada invite lobby.</div>'}</div>
      <h4>✅ Teman</h4>
      <div class="friend-list">${(social.friends || []).length ? social.friends.map(f => `<div class="friend-row"><div><b>${escapeHtml(f.username)} ${f.online ? '🟢' : '⚫'}</b><span>${f.online ? 'Online' : 'Offline'}</span></div><div class="item-stack"><button class="btn primary small" onclick="inviteFriend('${escapeHtml(f.username)}')">Invite</button><button class="btn secondary small" onclick="removeFriend('${escapeHtml(f.username)}')">Hapus</button></div></div>`).join('') : '<div class="mini-note">Belum ada teman. Cari username lalu Add Friend.</div>'}</div>
      <h4>⏳ Request Masuk</h4>
      <div class="friend-list">${(social.requests || []).length ? social.requests.map(f => `<div class="friend-row"><div><b>${escapeHtml(f.username)}</b><span>Ingin berteman denganmu</span></div><button class="btn primary small" onclick="acceptFriend('${escapeHtml(f.username)}')">Terima</button></div>`).join('') : '<div class="mini-note">Tidak ada request masuk.</div>'}</div>
      <h4>📤 Request Terkirim</h4>
      <div class="friend-list">${(social.sent || []).length ? social.sent.map(f => `<div class="friend-row"><div><b>${escapeHtml(f.username)}</b><span>Menunggu diterima</span></div></div>`).join('') : '<div class="mini-note">Tidak ada request terkirim.</div>'}</div>
    </div>`;
}
function renderFriendSearchResults() {
  if (!friendSearchResults.length) return '<div class="mini-note">Cari username untuk menambahkan teman.</div>';
  return friendSearchResults.map(u => `<div class="friend-row"><div><b>${escapeHtml(u.username)} ${u.online ? '🟢' : '⚫'}</b><span>${u.isFriend ? 'Sudah berteman' : u.pending ? 'Request masuk' : u.requested ? 'Request terkirim' : 'Belum berteman'}</span></div>${u.isFriend ? `<button class="btn primary small" onclick="inviteFriend('${escapeHtml(u.username)}')">Invite</button>` : u.pending ? `<button class="btn primary small" onclick="acceptFriend('${escapeHtml(u.username)}')">Terima</button>` : u.requested ? '<span class="owned">Pending</span>' : `<button class="btn primary small" onclick="addFriend('${escapeHtml(u.username)}')">Add Friend</button>`}</div>`).join('');
}
window.searchFriend = () => {
  const q = els.accountPageContent?.querySelector('#friendSearchInput')?.value || '';
  socket.emit('social:search', { query: q }, (res) => {
    if (!res?.ok) return toast('Search gagal', res?.error || 'Coba lagi.');
    friendSearchResults = res.users || [];
    const box = els.accountPageContent?.querySelector('#friendSearchResults');
    if (box) box.innerHTML = renderFriendSearchResults();
  });
};
window.addFriend = (username) => socket.emit('social:request', { username }, (res) => { if (!res?.ok) return toast('Gagal add', res?.error || 'Coba lagi.'); latestSocial = res.social || latestSocial; friendSearchResults = []; refreshAccountPage(); toast('Request terkirim', `Request teman ke ${username}`); });
window.acceptFriend = (username) => socket.emit('social:accept', { username }, (res) => { if (!res?.ok) return toast('Gagal terima', res?.error || 'Coba lagi.'); latestSocial = res.social || latestSocial; refreshAccountPage(); toast('Teman baru', `${username} sekarang temanmu.`); });
window.removeFriend = (username) => socket.emit('social:remove', { username }, (res) => { if (!res?.ok) return toast('Gagal hapus', res?.error || 'Coba lagi.'); latestSocial = res.social || latestSocial; refreshAccountPage(); toast('Teman dihapus', username); });
window.inviteFriend = (username) => socket.emit('social:invite-room', { username }, (res) => { if (!res?.ok) return toast('Gagal invite', res?.error || 'Kamu harus berada di room.'); toast('Invite dikirim', `${username} diajak ke lobby ${res.invite?.code || ''}`); });
window.joinInviteRoom = (code) => {
  if (!accountProfile) return toast('Login dulu', 'Login dulu sebelum menerima invite room.');
  els.codeInput.value = code;
  setUiLoading(true, 'Masuk ke room invite...');
  socket.emit('room:join', { name: accountProfile?.username || '', code, password: '', clientId, auth: authPayload() }, (res) => {
    if (!res?.ok) { softHideLoader(250); return toast('Gagal join invite', res?.error || 'Coba lagi.'); }
    resetLocalRoomStateForFreshJoin();
    saveSession(res.code, res.playerId || clientId);
    enterGame();
  });
};

function renderGameProfileBox() {
  if (!els.gameProfileBox) return;
  if (!accountProfile) { els.gameProfileBox.classList.add('hidden'); return; }
  const eq = accountProfile.equipped || {};
  els.gameProfileBox.classList.remove('hidden');
  els.gameProfileBox.innerHTML = `<b>👤 ${escapeHtml(accountProfile.username)}</b><div class="mini-note">${pointsText(accountProfile)} poin • ${eq.power ? '⚡ '+escapeHtml(itemName(eq.power)) : 'Power belum dipakai'}</div>`;
}
renderAccountHub();

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
    renderVoiceMembers();
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
  renderVoiceMembers();
}

socket.on('voice:peers', async ({ peers: ids }) => {
  for (const id of ids) await createPeer(id, true);
});
socket.on('voice:peer-joined', async ({ peerId, name }) => {
  toast('Voice', `${name || 'Pemain'} masuk voice.`);
  renderVoiceMembers();
  await createPeer(peerId, false);
});
socket.on('voice:peer-left', ({ peerId }) => {
  removePeer(peerId);
  renderVoiceMembers();
});
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

// Online Music Player: YouTube search/embed + iTunes previews + public radio + local upload + host-shared room music. Built-in playlist removed.
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
    youtubeSearch: document.getElementById('musicYoutubeSearch'),
    radioSearch: document.getElementById('musicRadioSearch'),
    tabAll: document.getElementById('musicTabAll'),
    tabYoutube: document.getElementById('musicTabYoutube'),
    tabOnline: document.getElementById('musicTabOnline'),
    tabRadio: document.getElementById('musicTabRadio'),
    ytBox: document.getElementById('ytPlayerBox'),
    ytMount: document.getElementById('ytPlayerMount'),
    ytHide: document.getElementById('ytHideBtn'),
    roomBar: document.getElementById('roomMusicBar'),
    roomInfo: document.getElementById('roomMusicInfo'),
    enableRoom: document.getElementById('enableRoomMusic'),
    shareRoom: document.getElementById('shareRoomMusic'),
    pauseRoom: document.getElementById('pauseRoomMusic'),
    stopRoom: document.getElementById('stopRoomMusic')
  };
  if (!musicEls.player) return;

  const builtInSongs = [];

  const musicState = {
    songs: [],
    filtered: [],
    index: 0,
    playing: false,
    ctx: null,
    gain: null,
    filter: null,
    timer: null,
    step: 0,
    audio: null,
    ytPlayer: null,
    ytReady: false,
    ytReadyPromise: null,
    ytApiPromise: null,
    currentYoutubeId: null,
    tab: 'all',
    loading: false,
    roomMusic: null,
    roomMusicKey: '',
    roomActivated: false,
    applyingShared: false
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
    try { if (musicState.ytPlayer?.setVolume) musicState.ytPlayer.setVolume(Math.round(v * 100)); } catch {}
  }

  function noteFreq(root, semi) { return root * Math.pow(2, semi / 12); }

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
    osc.connect(env); env.connect(musicState.filter);
    osc.start(now); osc.stop(now + stepDuration);
    if (musicState.step % 4 === 0) {
      const bass = musicState.ctx.createOscillator();
      const bassEnv = musicState.ctx.createGain();
      bass.type = 'sine';
      bass.frequency.setValueAtTime(song.root / 2, now);
      bassEnv.gain.setValueAtTime(0.0001, now);
      bassEnv.gain.exponentialRampToValueAtTime(0.26, now + 0.02);
      bassEnv.gain.exponentialRampToValueAtTime(0.0001, now + stepDuration * 1.7);
      bass.connect(bassEnv); bassEnv.connect(musicState.gain);
      bass.start(now); bass.stop(now + stepDuration * 1.8);
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
    try { if (musicState.ytPlayer?.stopVideo) musicState.ytPlayer.stopVideo(); } catch {}
    musicState.playing = false;
    if (!keepButton) musicEls.play.textContent = '▶';
    renderMusicList();
  }

  function normalizeSongForPlayback(song) {
    if (!song) return null;
    if (song.source === 'built-in') return builtInSongs.find(x => x.id === song.id) || song;
    return song;
  }

  async function playIndex(index, opts = {}) {
    const song = normalizeSongForPlayback(musicState.songs[index]);
    if (!song) return;
    stopCurrent(true);
    musicState.index = index;
    musicState.playing = true;
    musicEls.play.textContent = '⏸';
    musicEls.title.textContent = `${song.title} — ${song.artist}`;
    renderMusicList();

    if (song.source === 'youtube' && song.videoId) {
      await playYouTube(song, opts.startSec || 0);
      return;
    }

    if (song.url) {
      const audio = new Audio(song.url);
      audio.crossOrigin = 'anonymous';
      audio.loop = song.source === 'local' || song.source === 'radio';
      audio.playsInline = true;
      audio.preload = 'auto';
      if (opts.startSec) audio.currentTime = Math.max(0, Number(opts.startSec || 0));
      musicState.audio = audio;
      applyVolume();
      audio.addEventListener('ended', () => { if (song.source === 'online') move(1); });
      audio.addEventListener('error', () => { toast('Music error', 'Stream/preview tidak bisa diputar. Coba lagu lain.'); stopCurrent(); });
      try { await audio.play(); }
      catch {
        musicState.playing = false;
        musicEls.play.textContent = '▶';
        musicEls.player.classList.add('needs-tap');
        toast('HP memblokir audio', 'Tekan tombol ▶ atau Aktifkan di HP sekali lagi.');
      }
      return;
    }

    ensureAudio();
    if (opts.startSec && song.bpm) {
      const stepDuration = 60 / song.bpm / 2;
      musicState.step = Math.floor(Number(opts.startSec || 0) / stepDuration);
    }
    const stepMs = (60 / song.bpm / 2) * 1000;
    scheduleSynthNote(song);
    musicState.timer = setInterval(() => scheduleSynthNote(song), stepMs);
  }

  function togglePlay() {
    if (musicState.playing) return stopCurrent();
    musicState.roomActivated = true;
    musicEls.player.classList.remove('needs-tap');
    playIndex(musicState.index);
  }

  function move(delta) {
    const visible = currentVisibleIndexes();
    if (!visible.length) return;
    const pos = visible.indexOf(musicState.index);
    const nextPos = pos >= 0 ? (pos + delta + visible.length) % visible.length : 0;
    musicState.roomActivated = true;
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
    if (musicState.tab === 'youtube') return song.source === 'youtube';
    if (musicState.tab === 'online') return song.source === 'online';
    if (musicState.tab === 'radio') return song.source === 'radio';
    return true;
  }

  function setTab(tab) {
    musicState.tab = tab;
    for (const [name, el] of [['all', musicEls.tabAll], ['youtube', musicEls.tabYoutube], ['online', musicEls.tabOnline], ['radio', musicEls.tabRadio]]) {
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
      const msg = musicState.loading ? 'Sedang mencari online...' : 'Tidak ada lagu yang cocok. Coba tekan Cari YouTube, Preview, atau Radio.';
      musicEls.list.innerHTML = `<div class="music-note">${msg}</div>`;
      return;
    }
    musicEls.list.innerHTML = musicState.filtered.map(({ song, index }) => {
      const active = index === musicState.index;
      const sourceLabel = song.source === 'youtube' ? 'YouTube' : song.source === 'online' ? 'Preview online' : song.source === 'radio' ? 'Internet radio' : song.source === 'local' ? 'Lokal' : 'Online';
      const canShare = !!(me?.isHost && roomState?.code && song.source !== 'local');
      return `<div class="song-row ${active ? 'active' : ''} ${escapeHtml(song.source || '')}">
        <div class="song-art">${song.thumbnail ? `<img class="song-thumb" src="${escapeHtml(song.thumbnail)}" alt="" loading="lazy" />` : escapeHtml(song.emoji || '🎵')}</div>
        <div>
          <div class="song-name">${escapeHtml(song.title)}</div>
          <div class="song-meta">${escapeHtml(song.artist)} • ${sourceLabel}${song.duration ? ` • <span class="song-duration">${escapeHtml(song.duration)}</span>` : ''}${song.mood ? ' • ' + escapeHtml(song.mood) : ''}</div>
        </div>
        <div class="song-actions">
          ${canShare ? `<button class="song-room-play" data-room-song-index="${index}" title="Putar lagu ini untuk semua pemain">Room</button>` : ''}
          <button class="song-play" data-song-index="${index}">${active && musicState.playing ? '⏸' : '▶'}</button>
        </div>
      </div>`;
    }).join('');
    musicEls.list.querySelectorAll('[data-song-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.songIndex);
        musicState.roomActivated = true;
        musicEls.player.classList.remove('needs-tap');
        if (idx === musicState.index && musicState.playing) stopCurrent();
        else playIndex(idx);
      });
    });
    musicEls.list.querySelectorAll('[data-room-song-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.roomSongIndex);
        shareSongToRoom(musicState.songs[idx], idx);
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

  function loadYouTubeApi() {
    if (window.YT?.Player) return Promise.resolve();
    if (musicState.ytApiPromise) return musicState.ytApiPromise;
    musicState.ytApiPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-yt-api="true"]');
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === 'function') previousReady();
        resolve();
      };
      if (!existing) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.dataset.ytApi = 'true';
        tag.onerror = () => reject(new Error('YouTube API gagal dimuat'));
        document.head.appendChild(tag);
      }
      setTimeout(() => { if (window.YT?.Player) resolve(); }, 2500);
    });
    return musicState.ytApiPromise;
  }

  async function ensureYouTubePlayer() {
    await loadYouTubeApi();
    if (musicState.ytPlayer && musicState.ytReady) return musicState.ytPlayer;
    if (musicState.ytReadyPromise) return musicState.ytReadyPromise;
    musicEls.ytBox?.classList.remove('hidden');
    musicState.ytReadyPromise = new Promise((resolve, reject) => {
      try {
        musicState.ytPlayer = new YT.Player('ytPlayerMount', {
          width: '100%',
          height: '160',
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            rel: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: window.location.origin
          },
          events: {
            onReady: (event) => {
              musicState.ytReady = true;
              event.target.setVolume(Number(musicEls.volume.value || 45));
              resolve(event.target);
            },
            onStateChange: (event) => {
              if (event.data === YT.PlayerState.ENDED) move(1);
              if (event.data === YT.PlayerState.PLAYING) {
                musicState.playing = true;
                musicEls.player.classList.remove('needs-tap');
                musicEls.play.textContent = '⏸';
                renderMusicList();
              }
              if (event.data === YT.PlayerState.PAUSED) {
                musicState.playing = false;
                musicEls.play.textContent = '▶';
                renderMusicList();
              }
            },
            onError: () => {
              toast('YouTube error', 'Video ini tidak bisa diputar sebagai embed. Coba pilihan lain.');
              stopCurrent();
            }
          }
        });
      } catch (err) { reject(err); }
    });
    return musicState.ytReadyPromise;
  }

  async function playYouTube(song, startSec = 0) {
    try {
      const player = await ensureYouTubePlayer();
      musicEls.ytBox?.classList.remove('hidden');
      applyVolume();
      musicState.currentYoutubeId = song.videoId;
      player.loadVideoById({ videoId: song.videoId, startSeconds: Math.max(0, Number(startSec || 0)) });
      setTimeout(() => {
        try { player.playVideo(); } catch {}
      }, 80);
      setTimeout(() => {
        try {
          const state = player.getPlayerState?.();
          if (musicState.playing && state !== YT.PlayerState.PLAYING) {
            musicEls.player.classList.add('needs-tap');
            toast('Tekan aktifkan di HP', 'Kalau lagu belum bunyi, tekan tombol Aktifkan di HP atau tombol play di player YouTube.');
          }
        } catch {}
      }, 1800);
    } catch (err) {
      toast('YouTube gagal', 'Player YouTube gagal dimuat. Refresh atau pilih lagu lain.');
      stopCurrent();
    }
  }

  function getCurrentMusicPositionSec() {
    try {
      if (musicState.ytPlayer?.getCurrentTime) return Math.max(0, Number(musicState.ytPlayer.getCurrentTime() || 0));
    } catch {}
    try { if (musicState.audio) return Math.max(0, Number(musicState.audio.currentTime || 0)); } catch {}
    return 0;
  }

  function songToShare(song) {
    if (!song || song.source === 'local') return null;
    const base = {
      source: song.source,
      id: song.id,
      emoji: song.emoji,
      title: song.title,
      artist: song.artist,
      mood: song.mood,
      duration: song.duration,
      thumbnail: song.thumbnail
    };
    if (song.source === 'youtube') return { ...base, videoId: song.videoId, watchUrl: song.watchUrl };
    if (song.source === 'online' || song.source === 'radio') return { ...base, url: song.url };
    return base;
  }

  function shareSongToRoom(song, index = musicState.index) {
    if (!me?.isHost || !roomState?.code) return toast('Host only', 'Hanya host room yang bisa memutar musik bersama.');
    const share = songToShare(song);
    if (!share) return toast('Tidak bisa dishare', 'Lagu lokal hanya bisa didengar di perangkatmu sendiri. Pakai YouTube/Preview/Radio untuk musik bersama.');
    musicState.roomActivated = true;
    musicEls.player.classList.remove('needs-tap');
    musicState.index = index;
    playIndex(index);
    socket.emit('music:room-play', { song: share, positionSec: 0 }, (res) => {
      if (!res?.ok) return toast('Gagal musik room', res?.error || 'Coba lagi.');
      toast('Musik bersama', 'Lagu dikirim ke semua pemain di room.');
    });
  }

  function pauseRoomMusic() {
    if (!me?.isHost) return;
    socket.emit('music:room-pause', { positionSec: getCurrentMusicPositionSec() }, (res) => {
      if (!res?.ok) return toast('Gagal pause', res?.error || 'Coba lagi.');
      stopCurrent();
    });
  }

  function stopRoomMusic() {
    if (!me?.isHost) return;
    socket.emit('music:room-stop', {}, (res) => {
      if (!res?.ok) return toast('Gagal stop', res?.error || 'Coba lagi.');
      stopCurrent();
    });
  }

  function musicKey(state) {
    if (!state) return 'none';
    return `${state.status}|${state.song?.id || state.song?.videoId || state.song?.url || ''}|${state.startedAt || ''}|${Math.floor(Number(state.positionSec || 0))}|${state.updatedAt || ''}`;
  }

  function calcSharedStartSec(state) {
    let sec = Number(state?.positionSec || 0);
    if (state?.status === 'playing' && state.startedAt) sec += Math.max(0, (Date.now() - Number(state.startedAt)) / 1000);
    return sec;
  }

  function findOrAddSharedSong(song) {
    if (!song) return -1;
    const id = song.id || song.videoId || song.url;
    let idx = musicState.songs.findIndex(s => (s.id || s.videoId || s.url) === id && s.source === song.source);
    if (idx >= 0) return idx;
    const playable = normalizeSongForPlayback(song);
    musicState.songs.push(playable);
    return musicState.songs.length - 1;
  }

  async function applyRoomMusic(state, force = false) {
    if (!state?.song || state.status === 'stopped') {
      if (force) stopCurrent();
      return;
    }
    const idx = findOrAddSharedSong(state.song);
    if (idx < 0) return;
    if (state.status === 'paused') {
      stopCurrent();
      musicState.index = idx;
      musicEls.title.textContent = `${state.song.title} — ${state.song.artist}`;
      return;
    }
    if (state.status === 'playing') {
      if (!musicState.roomActivated && !force) {
        musicEls.player.classList.add('needs-tap');
        renderRoomMusicControls();
        return;
      }
      musicState.applyingShared = true;
      await playIndex(idx, { startSec: calcSharedStartSec(state) });
      musicState.applyingShared = false;
    }
  }

  function receiveRoomMusic(state, source = 'socket') {
    musicState.roomMusic = state || null;
    const key = musicKey(state);
    const changed = key !== musicState.roomMusicKey;
    if (changed) musicState.roomMusicKey = key;
    renderRoomMusicControls();
    if (!state || !changed) return;
    if (state.status === 'stopped') return stopCurrent();
    if (state.status === 'playing') applyRoomMusic(state, false);
    if (state.status === 'paused') stopCurrent();
  }

  function renderRoomMusicControls() {
    const inRoom = !!roomState?.code;
    const state = musicState.roomMusic || roomState?.music || null;
    musicEls.roomBar?.classList.toggle('hidden', !inRoom);
    const isHost = !!me?.isHost;
    if (musicEls.shareRoom) musicEls.shareRoom.classList.toggle('hidden', !isHost);
    if (musicEls.pauseRoom) musicEls.pauseRoom.classList.toggle('hidden', !isHost);
    if (musicEls.stopRoom) musicEls.stopRoom.classList.toggle('hidden', !isHost);
    if (musicEls.enableRoom) {
      musicEls.enableRoom.classList.toggle('hidden', !(state?.song && state.status !== 'stopped'));
      musicEls.enableRoom.textContent = musicState.roomActivated ? 'Sync Sekarang' : 'Aktifkan di HP';
    }
    if (musicEls.roomInfo) {
      if (!state?.song || state.status === 'stopped') musicEls.roomInfo.textContent = isHost ? 'Pilih lagu lalu tekan Room / Putar ke Room agar terdengar bersama.' : 'Belum ada musik bersama dari host.';
      else musicEls.roomInfo.textContent = `${state.status === 'paused' ? 'Pause' : 'Playing'}: ${state.song.title} — ${state.song.artist}${state.by ? ` • host: ${state.by}` : ''}`;
    }
    renderMusicList();
  }

  function enableRoomMusic() {
    musicState.roomActivated = true;
    musicEls.player.classList.remove('needs-tap');
    const state = musicState.roomMusic || roomState?.music;
    if (!state?.song) return toast('Belum ada musik', 'Host belum memutar musik bersama.');
    applyRoomMusic(state, true);
    toast('Musik aktif', 'HP kamu sudah diizinkan memutar audio room.');
  }

  async function searchYouTube() {
    const term = musicEls.search.value.trim();
    if (!term) return toast('Masukkan judul lagu', 'Contoh: The Cure Boys Don\'t Cry, Hindia, Joji, anime opening.');
    musicState.loading = true;
    setTab('youtube');
    renderMusicList();
    try {
      const res = await fetch(`/api/music/youtube?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Search gagal');
      const songs = (data.results || []).map(x => ({
        source: 'youtube',
        id: `yt-${x.videoId}`,
        emoji: '▶',
        title: x.title || 'YouTube Video',
        artist: x.artist || 'YouTube',
        mood: x.views ? `${Number(x.views).toLocaleString('id-ID')} views` : 'YouTube result',
        duration: x.duration || '',
        videoId: x.videoId,
        thumbnail: x.thumbnail || '',
        watchUrl: x.url
      }));
      addOrReplaceSongs(songs, 'youtube');
      toast('Hasil YouTube', songs.length ? `${songs.length} pilihan ditemukan.` : 'Tidak ada hasil YouTube.');
    } catch (err) {
      toast('Cari YouTube gagal', 'Server belum bisa mencari YouTube. Coba deploy ulang atau kata kunci lain.');
    } finally {
      musicState.loading = false;
      renderMusicList();
    }
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

  let musicDragMoved = false;
  function clampMusicFloat(left, top) {
    const player = musicEls.player;
    const rect = player.getBoundingClientRect();
    const margin = 10;
    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    return {
      left: Math.min(Math.max(margin, left), maxLeft),
      top: Math.min(Math.max(margin, top), maxTop)
    };
  }
  function setMusicFloatPosition(left, top, save = true) {
    const p = clampMusicFloat(left, top);
    musicEls.player.style.left = `${p.left}px`;
    musicEls.player.style.top = `${p.top}px`;
    musicEls.player.style.right = 'auto';
    musicEls.player.style.bottom = 'auto';
    musicEls.player.style.transform = 'none';
    musicEls.player.classList.add('free-float');
    if (save) localStorage.setItem('ryuuMusicFloatPos', JSON.stringify(p));
  }
  function restoreMusicFloatPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem('ryuuMusicFloatPos') || 'null');
      if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) return setMusicFloatPosition(saved.left, saved.top, false);
    } catch {}
    const w = musicEls.player.classList.contains('collapsed') ? 62 : Math.min(520, window.innerWidth - 20);
    setMusicFloatPosition(window.innerWidth - w - 14, window.innerHeight - 76, false);
  }
  function initMusicDrag() {
    restoreMusicFloatPosition();
    window.addEventListener('resize', () => {
      const rect = musicEls.player.getBoundingClientRect();
      setMusicFloatPosition(rect.left, rect.top, false);
    });
    let drag = null;
    const start = (e) => {
      const target = e.target;
      // Desktop fix: do not treat buttons/inputs/search/player controls as drag handles.
      // Drag only from the small cover button while collapsed, or from the title area when open.
      const isInteractive = target.closest('button,input,label,select,textarea,.music-controls,.music-drawer,.music-volume,.song-row');
      const canDrag = musicEls.player.classList.contains('collapsed')
        ? (target === musicEls.toggle || target.closest('.music-cover'))
        : (!isInteractive && (target.closest('.music-title-wrap') || target.closest('.music-now')));
      if (!canDrag) return;
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        left: musicEls.player.getBoundingClientRect().left,
        top: musicEls.player.getBoundingClientRect().top,
        moved: false
      };
      musicDragMoved = false;
      musicEls.player.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 7) {
        drag.moved = true;
        musicDragMoved = true;
        musicEls.player.classList.add('dragging');
      }
      if (drag.moved) {
        e.preventDefault();
        setMusicFloatPosition(drag.left + dx, drag.top + dy, false);
      }
    };
    const end = (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      musicEls.player.classList.remove('dragging');
      const rect = musicEls.player.getBoundingClientRect();
      setMusicFloatPosition(rect.left, rect.top, true);
      setTimeout(() => { musicDragMoved = false; }, 80);
      drag = null;
    };
    musicEls.player.addEventListener('pointerdown', start);
    musicEls.player.addEventListener('pointermove', move);
    musicEls.player.addEventListener('pointerup', end);
    musicEls.player.addEventListener('pointercancel', end);
  }
  initMusicDrag();
  musicEls.toggle.addEventListener('click', (e) => {
    if (musicDragMoved) { e.preventDefault(); return; }
    musicEls.player.classList.toggle('collapsed');
    requestAnimationFrame(() => {
      const rect = musicEls.player.getBoundingClientRect();
      setMusicFloatPosition(rect.left, rect.top, true);
    });
  });
  musicEls.play.addEventListener('click', togglePlay);
  musicEls.prev.addEventListener('click', () => move(-1));
  musicEls.next.addEventListener('click', () => move(1));
  musicEls.volume.addEventListener('input', applyVolume);
  musicEls.search.addEventListener('input', renderMusicList);
  musicEls.search.addEventListener('keydown', (e) => { if (e.key === 'Enter') searchYouTube(); });
  musicEls.youtubeSearch?.addEventListener('click', searchYouTube);
  musicEls.onlineSearch?.addEventListener('click', searchOnline);
  musicEls.radioSearch?.addEventListener('click', searchRadio);
  musicEls.ytHide?.addEventListener('click', () => musicEls.ytBox?.classList.add('hidden'));
  musicEls.tabAll?.addEventListener('click', () => setTab('all'));
  musicEls.tabYoutube?.addEventListener('click', () => setTab('youtube'));
  musicEls.tabOnline?.addEventListener('click', () => setTab('online'));
  musicEls.tabRadio?.addEventListener('click', () => setTab('radio'));
  musicEls.enableRoom?.addEventListener('click', enableRoomMusic);
  musicEls.shareRoom?.addEventListener('click', () => shareSongToRoom(musicState.songs[musicState.index], musicState.index));
  musicEls.pauseRoom?.addEventListener('click', pauseRoomMusic);
  musicEls.stopRoom?.addEventListener('click', stopRoomMusic);
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
    if (files.length) toast('Playlist ditambah', `${files.length} lagu lokal masuk playlist. Lagu lokal tidak bisa diputar bersama.`);
  });

  window.receiveSharedRoomMusic = receiveRoomMusic;
  socket.on('music:room-state', (state) => receiveRoomMusic(state, 'socket'));
  socket.on('connect', () => {
    if (roomState?.code) socket.emit('music:room-request');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && musicState.ctx) musicState.ctx.suspend?.();
    if (!document.hidden && musicState.playing && musicState.ctx) musicState.ctx.resume?.();
  });

  // Preload the official YouTube API early. On mobile, the user still has to tap once
  // before audible playback is allowed, but this makes that first tap much more reliable.
  loadYouTubeApi().catch(() => null);

  window.refreshRoomMusicControls = () => {
    const state = roomState?.music || null;
    if (state) receiveRoomMusic(state, 'room-state');
    else renderRoomMusicControls();
  };

  renderMusicList();
  renderRoomMusicControls();
  musicEls.title.textContent = 'Cari lagu untuk mulai';
})();


// === v3.9 Game Room Polish: mobile game tabs, asset fallback, reconnect guard helpers ===
(function initGameRoomPolish(){
  const fallbackSvg = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#1e293b"/><stop offset="1" stop-color="#020617"/></linearGradient></defs><rect width="220" height="220" rx="34" fill="url(#g)"/><circle cx="110" cy="92" r="42" fill="#7c3aed" opacity=".55"/><path d="M55 165c22-28 88-28 110 0" stroke="#38bdf8" stroke-width="12" stroke-linecap="round" fill="none" opacity=".75"/><text x="110" y="202" text-anchor="middle" font-family="Arial" font-size="20" font-weight="700" fill="#cbd5e1">RYUU</text></svg>`);
  const fallbackSrc = `data:image/svg+xml;charset=utf-8,${fallbackSvg}`;
  document.addEventListener('error', (event) => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fallbackApplied === '1') return;
    img.dataset.fallbackApplied = '1';
    img.removeAttribute('alt');
    img.src = fallbackSrc;
    img.classList.add('asset-fallback-img');
  }, true);

  function ensureGameTabbar(){
    if (document.getElementById('gameTabbar')) return;
    const game = document.getElementById('game');
    const topbar = game?.querySelector('.topbar');
    if (!game || !topbar) return;
    const nav = document.createElement('nav');
    nav.id = 'gameTabbar';
    nav.className = 'game-tabbar glass';
    nav.innerHTML = `
      <button type="button" data-game-tab="actions">Aksi</button>
      <button type="button" data-game-tab="role">Role</button>
      <button type="button" data-game-tab="players">Pemain</button>
      <button type="button" data-game-tab="chat">Chat</button>
      <button type="button" data-game-tab="logs">Log</button>`;
    topbar.insertAdjacentElement('afterend', nav);
    nav.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-game-tab]');
      if (!btn) return;
      setGameTab(btn.dataset.gameTab);
    });
    setGameTab(activeGameTab || 'actions', true);
  }
  window.setGameTab = function(tab, silent = false){
    activeGameTab = tab || 'actions';
    localStorage.setItem('ryuuGameTab', activeGameTab);
    document.body.dataset.gameTab = activeGameTab;
    document.querySelectorAll('#gameTabbar [data-game-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.gameTab === activeGameTab));
    if (!silent && window.innerWidth <= 760) window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  ensureGameTabbar();
  window.addEventListener('resize', ensureGameTabbar);
})();
