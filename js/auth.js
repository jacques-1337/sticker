// ═══════════════════════════════════════════════
//  AUTH — Login, Logout, Register, Session
//  Benötigt: supabaseClient.js, ui.js
// ═══════════════════════════════════════════════

let currentUser = null; // { id, username, pin, points, ... }
let myUsername  = null; // Legacy-Alias
let mySessionId = localStorage.getItem('32er_session') || null;
if (!mySessionId) {
  mySessionId = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
  localStorage.setItem('32er_session', mySessionId);
}

async function sha256(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

function showAuthOverlay() { document.getElementById('auth-overlay').classList.remove('hidden'); }
function hideAuthOverlay() { document.getElementById('auth-overlay').classList.add('hidden'); }

function switchAuthTab(tab) {
  ['login','register','pw-reset','pin-reset'].forEach(t => {
    const form  = document.getElementById(`form-${t}`);
    const tabBtn= document.getElementById(`tab-${t}`);
    if (form)   form.classList.toggle('active', t === tab);
    if (tabBtn) tabBtn.classList.toggle('active', t === tab);
  });
  ['login-error','register-error','pwreset-error','pwreset-success','pinreset-error','pinreset-success'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('show');
  });
}

function showAuthError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}
function showAuthSuccess(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.add('show');
}

// ── REGISTER ──────────────────────────────────
async function doRegister() {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const pin      = document.getElementById('register-pin').value.trim();
  const errEl    = document.getElementById('register-error');
  errEl.classList.remove('show');

  if (username.length < 3) return showAuthError('register-error', 'Username zu kurz (min. 3 Zeichen)');
  if (!/^[a-zA-Z0-9_äöüÄÖÜß-]+$/.test(username)) return showAuthError('register-error', 'Username nur Buchstaben, Zahlen, _ und -');
  if (password.length < 6) return showAuthError('register-error', 'Passwort zu kurz (min. 6 Zeichen)');
  if (!/^\d{4,6}$/.test(pin)) return showAuthError('register-error', 'PIN muss 4-6 Ziffern haben');
  if (!useSupabase) return showAuthError('register-error', 'Keine Datenbankverbindung');

  const btn = document.getElementById('register-btn');
  btn.disabled = true; btn.textContent = 'Erstelle Account…';

  try {
    const { data: existing } = await db.from('users').select('id').eq('username', username).maybeSingle();
    if (existing) { btn.disabled = false; btn.textContent = 'Account erstellen'; return showAuthError('register-error', 'Username schon vergeben'); }

    const password_hash  = await sha256(password);
    const session_token  = 'tok_' + Date.now() + '_' + Math.random().toString(36).slice(2,12);

    const { data, error } = await db.from('users').insert([{
      username, password_hash, pin, session_token,
      last_login: new Date().toISOString()
    }]).select().single();
    if (error) throw error;

    setCurrentUser(data, session_token);
    hideAuthOverlay();
    toast(`👋 Willkommen, ${username}!`, 'success');
    await postLoginInit();
  } catch(e) {
    console.error('Register error:', e);
    showAuthError('register-error', 'Fehler: ' + (e.message || 'Unbekannt'));
  } finally {
    btn.disabled = false; btn.textContent = 'Account erstellen';
  }
}

// ── LOGIN ─────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');
  errEl.classList.remove('show');

  if (!username || !password) return showAuthError('login-error', 'Username und Passwort eingeben');
  if (!useSupabase) return showAuthError('login-error', 'Keine Datenbankverbindung');

  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Prüfe…';

  try {
    const { data: user, error } = await db.from('users').select('*').eq('username', username).maybeSingle();
    if (error) throw error;
    if (!user) return showAuthError('login-error', 'User nicht gefunden');

    const password_hash = await sha256(password);
    if (password_hash !== user.password_hash) return showAuthError('login-error', 'Falsches Passwort');

    const session_token = 'tok_' + Date.now() + '_' + Math.random().toString(36).slice(2,12);
    await db.from('users').update({ session_token, last_login: new Date().toISOString() }).eq('id', user.id);

    setCurrentUser({ ...user, session_token }, session_token);
    hideAuthOverlay();
    toast(`👋 Willkommen zurück, ${username}!`, 'success');
    await postLoginInit();
  } catch(e) {
    console.error('Login error:', e);
    showAuthError('login-error', 'Fehler: ' + (e.message || 'Unbekannt'));
  } finally {
    btn.disabled = false; btn.textContent = 'Anmelden';
  }
}

// ── PASSWORT-RESET ─────────────────────────────
async function doPasswordReset() {
  const username = document.getElementById('pwreset-username').value.trim();
  const pin      = document.getElementById('pwreset-pin').value.trim();
  const newPass  = document.getElementById('pwreset-newpass').value;

  if (!username || !pin || !newPass) return showAuthError('pwreset-error', 'Alle Felder ausfüllen');
  if (newPass.length < 6) return showAuthError('pwreset-error', 'Neues Passwort min. 6 Zeichen');
  if (!useSupabase) return showAuthError('pwreset-error', 'Keine Datenbankverbindung');

  const btn = document.getElementById('pwreset-btn');
  btn.disabled = true; btn.textContent = 'Prüfe…';
  try {
    const { data: user, error } = await db.from('users').select('id, pin').eq('username', username).maybeSingle();
    if (error) throw error;
    if (!user) return showAuthError('pwreset-error', 'User nicht gefunden');
    if (user.pin !== pin) return showAuthError('pwreset-error', 'PIN falsch');

    const password_hash = await sha256(newPass);
    const { error: upErr } = await db.from('users').update({ password_hash, session_token: null }).eq('id', user.id);
    if (upErr) throw upErr;

    showAuthSuccess('pwreset-success', '✅ Passwort zurückgesetzt! Du kannst dich jetzt neu anmelden.');
    ['pwreset-username','pwreset-pin','pwreset-newpass'].forEach(id => document.getElementById(id).value = '');
    setTimeout(() => switchAuthTab('login'), 1800);
  } catch(e) {
    console.error('Password-Reset error:', e);
    showAuthError('pwreset-error', 'Fehler: ' + (e.message || 'Unbekannt'));
  } finally {
    btn.disabled = false; btn.textContent = 'Passwort zurücksetzen';
  }
}

// ── PIN-RESET ──────────────────────────────────
async function doPinReset() {
  const username = document.getElementById('pinreset-username').value.trim();
  const password = document.getElementById('pinreset-password').value;
  if (!username || !password) return showAuthError('pinreset-error', 'Username und Passwort eingeben');
  if (!useSupabase) return showAuthError('pinreset-error', 'Keine Datenbankverbindung');

  const btn = document.getElementById('pinreset-btn');
  btn.disabled = true; btn.textContent = 'Prüfe…';
  try {
    const { data: user, error } = await db.from('users').select('id, password_hash').eq('username', username).maybeSingle();
    if (error) throw error;
    if (!user) return showAuthError('pinreset-error', 'User nicht gefunden');

    const password_hash = await sha256(password);
    if (password_hash !== user.password_hash) return showAuthError('pinreset-error', 'Passwort falsch');

    const { error: insErr } = await db.from('pin_requests').insert([{ username }]);
    if (insErr) throw insErr;

    showAuthSuccess('pinreset-success', '✅ Anfrage gesendet! Der Admin wird sich melden.');
    document.getElementById('pinreset-username').value = '';
    document.getElementById('pinreset-password').value = '';
  } catch(e) {
    console.error('PIN-Reset error:', e);
    showAuthError('pinreset-error', 'Fehler: ' + (e.message || 'Unbekannt'));
  } finally {
    btn.disabled = false; btn.textContent = 'Admin benachrichtigen';
  }
}

// ── LOGOUT ────────────────────────────────────
async function doLogout() {
  if (currentUser && useSupabase) {
    try { await db.from('users').update({ session_token: null }).eq('id', currentUser.id); }
    catch(e) { console.warn('Logout server-update:', e); }
  }
  currentUser = null;
  myUsername  = null;
  localStorage.removeItem('32er_auth');
  localStorage.removeItem('32er_username');
  document.getElementById('account-section').style.display = 'none';
  friendsCache      = [];
  incomingRequests  = [];
  outgoingRequests  = [];
  updateSocialBadge(0);
  if (document.getElementById('screen-social')?.classList.contains('active')) renderSocialTab();
  if (currentMapFilter !== 'all') {
    currentMapFilter = 'all';
    document.querySelectorAll('.map-filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === 'all');
    });
  }
  if (typeof renderMarkers === 'function') renderMarkers();
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  switchAuthTab('login');
  showAuthOverlay();
  toast('Abgemeldet', '');
}

// ── SESSION ───────────────────────────────────
function setCurrentUser(user, token) {
  currentUser = user;
  myUsername  = user.username;
  localStorage.setItem('32er_auth', JSON.stringify({
    id: user.id, username: user.username, token
  }));
  localStorage.setItem('32er_username', user.username);
  updateAccountInfoBox();
  loadFriendsTab();
  if (typeof renderMarkers === 'function') renderMarkers();
}

async function restoreSession() {
  const raw = localStorage.getItem('32er_auth');
  if (!raw) return false;
  let saved;
  try { saved = JSON.parse(raw); } catch { return false; }
  if (!saved.id || !saved.token || !useSupabase) return false;
  try {
    const { data: user, error } = await db.from('users').select('*').eq('id', saved.id).maybeSingle();
    if (error || !user) return false;
    if (user.session_token !== saved.token) {
      localStorage.removeItem('32er_auth');
      return false;
    }
    setCurrentUser(user, saved.token);
    return true;
  } catch(e) {
    console.warn('Session-Restore:', e);
    return false;
  }
}

// ── ACCOUNT INFO BOX ──────────────────────────
function updateAccountInfoBox() {
  const box = document.getElementById('account-info-box');
  const sec = document.getElementById('account-section');
  const cta = document.getElementById('login-cta-section');
  if (!currentUser) {
    sec.style.display = 'none';
    if (cta) cta.style.display = '';
    return;
  }
  sec.style.display = '';
  if (cta) cta.style.display = 'none';

  const myStickers  = stickers.filter(s => s.owner_id === currentUser.id);
  const myPts       = myStickers.reduce((sum, s) => sum + (s.points || 0), 0);
  const myCountries = new Set(myStickers.map(s => s.country_code)).size;

  box.innerHTML = `
    <div class="acc-row"><span class="acc-label">Username</span><span class="acc-val">${escHtml(currentUser.username)}</span></div>
    <div class="acc-row"><span class="acc-label">Sticker</span><span class="acc-val">${myStickers.length}</span></div>
    <div class="acc-row"><span class="acc-label">Länder</span><span class="acc-val">${myCountries}</span></div>
    <div class="acc-row"><span class="acc-label">Punkte</span><span class="acc-val">${myPts}</span></div>
    <div class="acc-row"><span class="acc-label">Account seit</span><span class="acc-val">${currentUser.created_at ? new Date(currentUser.created_at).toLocaleDateString('de') : '–'}</span></div>
  `;

  renderAccountBadges(myStickers, myPts);
  renderAccountHistory(myStickers);
}

// ── BADGES ────────────────────────────────────
const BADGE_DEFS = [
  { id:'first',        icon:'🏅', title:'Erster Post',   desc:'1. Sticker gesetzt',         check:(s)=> s.length >= 1 },
  { id:'sticker_5',    icon:'🎯', title:'5 Sticker',     desc:'5 Sticker verklebt',          check:(s)=> s.length >= 5 },
  { id:'sticker_10',   icon:'📌', title:'10 Sticker',    desc:'10 Sticker verklebt',         check:(s)=> s.length >= 10 },
  { id:'sticker_25',   icon:'📍', title:'25 Sticker',    desc:'25 Sticker verklebt',         check:(s)=> s.length >= 25 },
  { id:'pts_50',       icon:'⭐',  title:'50 Punkte',     desc:'50 Punkte erreicht',          check:(_,p)=> p >= 50 },
  { id:'pts_100',      icon:'🌟', title:'100 Punkte',    desc:'100 Punkte erreicht',         check:(_,p)=> p >= 100 },
  { id:'pts_500',      icon:'💫', title:'500 Punkte',    desc:'500 Punkte erreicht',         check:(_,p)=> p >= 500 },
  { id:'pts_1000',     icon:'🏆', title:'1000 Punkte',   desc:'1000 Punkte erreicht',        check:(_,p)=> p >= 1000 },
  { id:'continents_3', icon:'🌍', title:'3 Kontinente',  desc:'Sticker auf 3 Kontinenten',   check:(s)=> new Set(s.map(x=>x.continent)).size >= 3 },
  { id:'continents_5', icon:'🌎', title:'5 Kontinente',  desc:'Sticker auf 5 Kontinenten',   check:(s)=> new Set(s.map(x=>x.continent)).size >= 5 },
  { id:'countries_5',  icon:'🗺️', title:'5 Länder',      desc:'5 verschiedene Länder',       check:(s)=> new Set(s.map(x=>x.country_code)).size >= 5 },
  { id:'countries_10', icon:'🧭', title:'10 Länder',     desc:'10 verschiedene Länder',      check:(s)=> new Set(s.map(x=>x.country_code)).size >= 10 },
  { id:'photos_5',     icon:'📷', title:'Fotograf',      desc:'5 Sticker mit Foto',          check:(s)=> s.filter(x=>x.photo_url).length >= 5 },
  { id:'capital',      icon:'🏛',  title:'Hauptstadt',    desc:'Sticker in einer Hauptstadt', check:(s)=> s.some(x=>x.is_capital) },
  { id:'far_10k',      icon:'🚀', title:'Weltreisender', desc:'Sticker über 10.000 km',      check:(s)=> s.some(x=>(x.distance_km||0)>=10000) },
];

function computeBadges(myStickers, myPts) {
  return BADGE_DEFS.map(b => ({ ...b, earned: b.check(myStickers, myPts) }));
}

function renderAccountBadges(myStickers, myPts) {
  const el = document.getElementById('account-badges');
  if (!el) return;
  const badges = computeBadges(myStickers, myPts);
  const earned = badges.filter(b => b.earned).length;
  el.innerHTML = `
    <div style="grid-column:1/-1;font-size:12px;color:var(--text2);margin-bottom:4px">
      <strong style="color:var(--accent)">${earned}</strong> von ${badges.length} Badges erreicht
    </div>
  ` + badges.map(b => `
    <div class="badge-card ${b.earned ? 'earned' : 'locked'}" title="${escHtml(b.desc)}">
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-title">${escHtml(b.title)}</div>
      <div class="badge-desc">${escHtml(b.desc)}</div>
    </div>
  `).join('');
}

function renderAccountHistory(myStickers) {
  const el = document.getElementById('account-history');
  if (!el) return;
  if (!myStickers.length) {
    el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:13px">Noch keine Sticker gesetzt</div>';
    return;
  }
  const sorted = [...myStickers].sort((a,b)=> new Date(b.created_at||0) - new Date(a.created_at||0));
  const maxShow = 20;
  const shown = sorted.slice(0, maxShow);

  el.innerHTML = shown.map((s, i) => {
    const idx  = stickers.indexOf(s);
    const date = s.created_at ? new Date(s.created_at).toLocaleDateString('de', { day:'2-digit', month:'short', year:'numeric' }) : '–';
    const pts  = s.points || 0;
    return `<div class="history-item" onclick="openStickerDetail(${idx >= 0 ? idx : 0})" style="cursor:pointer">
      <div class="hist-flag">${s.flag||'📍'}</div>
      <div class="hist-info">
        <div class="hist-city">${escHtml(s.city||'?')}, ${escHtml(s.country||'')}</div>
        <div class="hist-date">${date} · ${(s.distance_km||0).toLocaleString('de')} km</div>
      </div>
      <div class="hist-pts">+${pts}<small style="font-size:9px;display:block;color:var(--text2);text-align:center">Pkt</small></div>
    </div>`;
  }).join('') + (sorted.length > maxShow
    ? `<div style="text-align:center;color:var(--text2);font-size:12px;padding:6px">… ${sorted.length - maxShow} ältere Sticker</div>`
    : '');
}

async function postLoginInit() {
  stickers = await loadStickers();
  renderMarkers();
  updateScore();
  loadFriendsTab();
}

function showNameEdit() {
  if (currentUser) {
    toast('Username: ' + currentUser.username, '');
  } else {
    switchAuthTab('login');
    showAuthOverlay();
  }
}
function saveUsername() { /* deprecated */ }

// ── Enter-Tasten ──────────────────────────────
['login-password','register-pin','pinreset-username'].forEach(id => {
  document.getElementById(id)?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      if (id === 'login-password')    doLogin();
      else if (id === 'register-pin') doRegister();
      else if (id === 'pinreset-username') doPinReset();
    }
  });
});

document.getElementById('username-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') saveUsername();
});
