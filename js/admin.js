// ═══════════════════════════════════════════════
//  ADMIN — Admin-Panel (Supabase Auth Login)
//  Benötigt: supabaseClient.js, ui.js, stickers.js
// ═══════════════════════════════════════════════

let isAdmin = false;

async function adminLogin() {
  if (!useSupabase) { toast('Supabase nicht verbunden', 'error'); return; }
  const email    = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  if (!email || !password) { toast('E-Mail und Passwort eingeben', 'error'); return; }
  try {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw error;
    isAdmin = true;
    document.getElementById('admin-login-form').style.display = 'none';
    document.getElementById('admin-logged-in').style.display  = 'block';
    renderStickerList();
    loadPinRequests();
    loadUserList();
    renderAdminFeatureToggles();
    applyFeatureFlags(); // Challenge/Game-Buttons für Admin sichtbar machen
    toast('✅ Admin-Modus aktiv', 'success');
  } catch(e) {
    toast('Anmeldung fehlgeschlagen – Passwort falsch?', 'error');
  }
}

async function loadPinRequests() {
  const el = document.getElementById('pin-requests-list');
  if (!el) return;
  if (!useSupabase || !isAdmin) { el.innerHTML = '—'; return; }
  el.textContent = 'Lade…';
  try {
    const { data, error } = await db.from('pin_requests')
      .select('*').eq('resolved', false).order('created_at', { ascending: false });
    if (error) throw error;
    if (!data || !data.length) {
      el.innerHTML = '<div style="padding:8px 0;color:var(--text2)">Keine offenen Anfragen ✅</div>';
      return;
    }
    const usernames = [...new Set(data.map(r => r.username))];
    const { data: users } = await db.from('users').select('username, pin').in('username', usernames);
    const pinMap = {};
    (users||[]).forEach(u => pinMap[u.username] = u.pin);

    el.innerHTML = data.map(r => `
      <div class="pin-request-item">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span class="pr-user">${escHtml(r.username)}</span>
          <span style="font-size:11px;color:var(--text2)">${new Date(r.created_at).toLocaleString('de')}</span>
        </div>
        <div>PIN: <span class="pr-pin">${pinMap[r.username] ? escHtml(pinMap[r.username]) : '❓ User nicht gefunden'}</span></div>
        <button onclick="resolvePinRequest('${r.id}')" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 10px;color:var(--text2);cursor:pointer;font-size:11px;margin-top:6px">✓ Als erledigt markieren</button>
      </div>`).join('');
  } catch(e) {
    console.error('PIN-Requests:', e);
    el.innerHTML = '<div style="color:var(--red)">Fehler beim Laden</div>';
  }
}

async function resolvePinRequest(id) {
  if (!useSupabase) return;
  try {
    await db.from('pin_requests').update({ resolved: true }).eq('id', id);
    loadPinRequests();
  } catch(e) { console.error(e); }
}

async function loadUserList() {
  const el = document.getElementById('user-list');
  if (!el) return;
  if (!useSupabase || !isAdmin) { el.innerHTML = '—'; return; }
  const query = (document.getElementById('user-search')?.value||'').trim().toLowerCase();
  el.textContent = 'Lade…';
  try {
    const { data: users, error } = await db.from('users')
      .select('id, username, pin, created_at, last_login').order('created_at', { ascending: false });
    if (error) throw error;
    let list = users||[];
    if (query) list = list.filter(u => u.username.toLowerCase().includes(query));
    if (!list.length) { el.innerHTML = '<div style="padding:8px 0;color:var(--text2)">Keine User gefunden</div>'; return; }

    const { data: allStickers } = await db.from('stickers').select('owner_id, points');
    const stickerCounts = {};
    const pointsSum     = {};
    (allStickers||[]).forEach(s => {
      if (!s.owner_id) return;
      stickerCounts[s.owner_id] = (stickerCounts[s.owner_id]||0)+1;
      pointsSum[s.owner_id]     = (pointsSum[s.owner_id]||0)+(s.points||0);
    });

    el.innerHTML = list.slice(0,50).map(u => `
      <div class="pin-request-item" style="background:var(--surface);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span class="pr-user">${escHtml(u.username)}</span>
          <span style="font-size:11px;color:var(--text2)">seit ${u.created_at?new Date(u.created_at).toLocaleDateString('de'):'?'}</span>
        </div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:6px">
          📌 ${stickerCounts[u.id]||0} Sticker · 🏆 ${pointsSum[u.id]||0} Pkt · PIN: <span class="pr-pin">${escHtml(u.pin)}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button onclick="adminResetUserPassword('${u.id}','${escHtml(u.username)}')" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;color:var(--text2);cursor:pointer;font-size:11px">🔑 PW zurücksetzen</button>
          <button onclick="adminResetUserPin('${u.id}','${escHtml(u.username)}')" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;color:var(--text2);cursor:pointer;font-size:11px">🔢 PIN ändern</button>
          <button onclick="adminDeleteUser('${u.id}','${escHtml(u.username)}')" style="background:rgba(232,74,106,0.1);border:1px solid var(--red);border-radius:6px;padding:4px 10px;color:var(--red);cursor:pointer;font-size:11px">🗑 Löschen</button>
        </div>
      </div>`).join('') + (list.length>50 ? `<div style="text-align:center;color:var(--text2);font-size:12px;padding:6px">… ${list.length-50} weitere</div>` : '');
  } catch(e) {
    console.error('User-List:', e);
    el.innerHTML = '<div style="color:var(--red)">Fehler: ' + escHtml(e.message||'') + '</div>';
  }
}

async function adminResetUserPassword(userId, username) {
  const newPass = prompt(`Neues Passwort für "${username}" (min. 6 Zeichen):`);
  if (!newPass) return;
  if (newPass.length < 6) { toast('Passwort zu kurz', 'error'); return; }
  try {
    const password_hash = await sha256(newPass);
    const { error } = await db.from('users').update({ password_hash, session_token: null }).eq('id', userId);
    if (error) throw error;
    toast(`✅ PW für ${username} neu gesetzt`, 'success');
    loadUserList();
  } catch(e) { console.error(e); toast('Fehler: ' + e.message, 'error'); }
}

async function adminResetUserPin(userId, username) {
  const newPin = prompt(`Neuer PIN für "${username}" (4-6 Ziffern):`);
  if (!newPin) return;
  if (!/^\d{4,6}$/.test(newPin)) { toast('PIN muss 4-6 Ziffern haben', 'error'); return; }
  try {
    const { error } = await db.from('users').update({ pin: newPin }).eq('id', userId);
    if (error) throw error;
    toast(`✅ PIN für ${username} geändert`, 'success');
    loadUserList();
  } catch(e) { console.error(e); toast('Fehler: ' + e.message, 'error'); }
}

async function adminDeleteUser(userId, username) {
  if (!confirm(`Account "${username}" wirklich löschen?\n\nDie Sticker bleiben als Community-Sticker erhalten.`)) return;
  try {
    await db.from('stickers').update({ owner_id: null }).eq('owner_id', userId);
    const { error } = await db.from('users').delete().eq('id', userId);
    if (error) throw error;
    toast(`🗑 Account ${username} gelöscht`, 'success');
    loadUserList();
  } catch(e) { console.error(e); toast('Fehler: ' + e.message, 'error'); }
}

async function adminLogout() {
  await db.auth?.signOut();
  isAdmin = false;
  document.getElementById('admin-login-form').style.display = 'block';
  document.getElementById('admin-logged-in').style.display  = 'none';
  renderStickerList();
  toast('Abgemeldet', '');
}

// ── Feature-Flag Toggles ──────────────────────
function renderAdminFeatureToggles() {
  const el = document.getElementById('admin-feature-toggles');
  if (!el) return;

  const flags = [
    { key: 'challenges_active', label: '⚔️ Challenges', desc: 'Max. 1× täglich · Punkte aktiv' },
    { key: 'games_active',      label: '🎮 Mini-Games',  desc: 'Max. 3× täglich · Punkte aktiv' },
  ];

  el.innerHTML = flags.map(f => {
    const on = FEATURE_FLAGS[f.key];
    return `
      <div class="feature-toggle-row">
        <div class="feature-toggle-info">
          <div class="feature-toggle-label">${f.label}</div>
          <div class="feature-toggle-desc">${f.desc}</div>
        </div>
        <button class="feature-toggle-btn ${on ? 'on' : 'off'}"
                onclick="adminToggleFeature('${f.key}')">
          ${on ? 'AN' : 'AUS'}
        </button>
      </div>`;
  }).join('');
}

async function adminToggleFeature(key) {
  const newVal = !FEATURE_FLAGS[key];
  await setFeatureFlag(key, newVal);
  renderAdminFeatureToggles();
  toast(`${key}: ${newVal ? '✅ aktiviert' : '⛔ deaktiviert'}`, newVal ? 'success' : '');
}

async function deleteSticker(id, event) {
  event.stopPropagation();
  if (!isAdmin) return;
  if (!confirm('Diesen Sticker wirklich löschen?')) return;
  try {
    if (useSupabase) {
      const { error } = await db.from('stickers').delete().eq('id', id);
      if (error) throw error;
    }
    stickers = stickers.filter(s => s.id !== id);
    saveLocal(stickers);
    renderMarkers();
    renderStickerList();
    toast('🗑 Sticker gelöscht', 'success');
  } catch(e) { console.error(e); toast('Fehler beim Löschen', 'error'); }
}
