// ═══════════════════════════════════════════════
//  UI — DOM-Helfer, Toast, Navigation
// ═══════════════════════════════════════════════

function $id(id) { return document.getElementById(id); }

function setHTML(id, html) {
  const el = $id(id);
  if (!el) { console.warn(`[dom] #${id} fehlt – setHTML übersprungen`); return false; }
  el.innerHTML = html;
  return true;
}

function setStyle(id, prop, val) {
  const el = $id(id); if (!el) return false;
  el.style[prop] = val; return true;
}

function logInternal(scope, e) {
  console.warn(`[${scope}]`, e?.message || e, e);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toast ──────────────────────────────────────
let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Navigation ────────────────────────────────
const SCREENS = ['map', 'score', 'social', 'info'];

function showScreen(name) {
  SCREENS.forEach(s => {
    document.getElementById(`screen-${s}`)?.classList.remove('active');
    document.getElementById(`nav-${s}`)?.classList.remove('active');
  });
  document.getElementById(`screen-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');

  if (name === 'map') { setTimeout(() => map?.invalidateSize(), 100); }
  if (name === 'score') {
    updateMyScoreCard(null, null, 0);
    if (currentScoreTab === 'players')   loadLeaderboard();
    if (currentScoreTab === 'countries') loadCountryScoreboard();
  }
  if (name === 'social') renderSocialTab();
  if (name === 'info') updateAccountInfoBox();
}

// ── Social Badge ──────────────────────────────
function updateSocialBadge(n) {
  const badge = document.getElementById('nav-social-badge');
  if (!badge) return;
  if (n > 0) {
    badge.textContent = n > 9 ? '9+' : String(n);
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function updateSocialBadgeFromState() {
  const reqs   = (incomingRequests || []).length;
  const unrMap = (typeof unreadCounts !== 'undefined') ? unreadCounts : {};
  const unread = Object.values(unrMap).reduce((s, n) => s + (n || 0), 0);
  updateSocialBadge(reqs + unread);
}

// ── Sticker-Detail Modal ──────────────────────
function openStickerDetail(idx) {
  const s = stickers[idx];
  const pts = s.points || s.pts || 0;
  const hasPhoto = s.photo_url || s.photoData;

  document.getElementById('modal-content').innerHTML = `
    ${hasPhoto ? `<img src="${s.photo_url||s.photoData}" style="width:100%;border-radius:12px;margin-bottom:16px;aspect-ratio:1/1;max-height:320px;object-fit:contain;object-position:center;background:#0a0a0a" onerror="this.style.display='none'">` : ''}
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <span style="font-size:48px">${s.flag||'📍'}</span>
      <div>
        <div style="font-size:20px;font-weight:800">${s.city}</div>
        <div style="color:var(--text2);font-size:14px">${s.country}</div>
      </div>
      <div style="margin-left:auto;font-size:36px;font-weight:900;color:var(--accent)">${pts}<div style="font-size:11px;color:var(--text2);text-align:center">Pkt</div></div>
    </div>
    <div style="background:var(--surface2);border-radius:12px;padding:14px;font-size:13px;color:var(--text2)">
      📏 ${(s.distanceKm||s.distance_km||0).toLocaleString('de')} km von Stahnsdorf<br>
      🌍 ${getContinent({cont:s.continent||'?'})}<br>
      ${s.isCapital||s.is_capital?'🏛 Hauptstadt<br>':''}
      ${s.note?`<br>💬 ${s.note}`:''}
    </div>
    <button onclick="closeModal();showScreen('map');setTimeout(()=>map.setView([${s.lat||s.city_lat},${s.lng||s.city_lng}],12,{animate:true}),300)" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px;color:var(--text);font-size:14px;cursor:pointer;margin-top:12px">
      📍 Auf Karte zeigen
    </button>
  `;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

// ── Logo-Injektion ────────────────────────────
function injectLogos() {
  document.querySelectorAll('.brand-logo').forEach(el => {
    if (el.dataset.injected === '1') return;
    const size = parseInt(el.dataset.logoSize || '24', 10);
    const glow = el.dataset.logoGlow === '1';
    if (LOGO_URL) {
      el.innerHTML = '';
      el.style.background = 'transparent';
      el.style.color = 'inherit';
      const img = document.createElement('img');
      img.src = LOGO_URL;
      img.alt = '32er Stahnsdorf';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.borderRadius = '50%';
      img.style.objectFit = 'cover';
      if (glow) img.style.boxShadow = '0 4px 24px rgba(232,200,74,0.25)';
      el.appendChild(img);
    } else {
      if (!el.textContent.trim()) el.textContent = '32';
    }
    el.dataset.injected = '1';
  });
}
