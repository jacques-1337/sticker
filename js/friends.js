// ═══════════════════════════════════════════════
//  FRIENDS — Freundesliste, Anfragen, Social-Tab
//  Benötigt: auth.js, ui.js, supabaseClient.js
// ═══════════════════════════════════════════════

let friendsCache      = [];
let incomingRequests  = [];
let outgoingRequests  = [];
let friendSearchTimeout = null;

// ── Social-Tab rendern ───────────────────────────────────────
let votingCountdownTimer   = null;
let socialFriendSearchTimer= null;

async function renderSocialTab() {
  if (!$id('social-incoming-list')) {
    console.warn('[social] Tab-DOM nicht da – render abgebrochen');
    return;
  }

  startVotingCountdown();

  if (!currentUser) {
    setStyle('social-login-cta', 'display', 'block');
    setHTML('social-incoming-list', '<div class="muted-empty">Login erforderlich</div>');
    setHTML('social-outgoing-list', '');
    setHTML('social-conversations', '<div class="muted-empty">Login erforderlich</div>');
    setStyle('social-accept-all',  'display', 'none');
    setStyle('social-req-count',   'display', 'none');
    setStyle('social-msg-count',   'display', 'none');
    updateSocialBadge(0);
    return;
  }
  setStyle('social-login-cta', 'display', 'none');

  setHTML('social-incoming-list', '<div class="muted-empty">Lade…</div>');
  setHTML('social-conversations', '<div class="muted-empty">Lade…</div>');

  try {
    await Promise.all([
      loadIncomingRequests(),
      loadOutgoingRequests(),
      loadFriendsList(),
      loadMonthlyVotes(),
      loadChallenges(),
      typeof refreshUnreadCounts === 'function' ? refreshUnreadCounts() : Promise.resolve()
    ]);
  } catch (e) {
    logInternal('social/load', e);
  }
  renderSocialIncoming();
  renderSocialOutgoing();
  renderSocialConversations();
  renderChallenges();
  updateSocialBadgeFromState();
  ensureMessageSubscription();
  ensureChallengeSubscription();
  renderVotingGallery();
}

function renderSocialIncoming() {
  const list  = document.getElementById('social-incoming-list');
  const badge = document.getElementById('social-req-count');
  const accept= document.getElementById('social-accept-all');
  if (!list) return;

  const reqs = incomingRequests || [];
  if (!reqs.length) {
    list.innerHTML = '<div class="muted-empty">Keine offenen Anfragen</div>';
    if (badge)  badge.style.display  = 'none';
    if (accept) accept.style.display = 'none';
    return;
  }
  if (badge)  { badge.style.display  = 'inline-block'; badge.textContent = reqs.length; }
  if (accept) accept.style.display = reqs.length >= 2 ? 'block' : 'none';

  list.innerHTML = reqs.map(r => {
    const initial = (r.username?.[0] || '?').toUpperCase();
    return `<div class="social-req-row">
      <div class="social-avatar">${escHtml(initial)}</div>
      <div class="social-req-info">
        <div class="social-req-name">${escHtml(r.username || '–')}</div>
        <small>möchte dein Freund werden</small>
      </div>
      <button class="btn-accept"  onclick="acceptFriendRequest('${r.id}','${r.from_user}')" title="Annehmen">✓</button>
      <button class="btn-decline" onclick="declineFriendRequest('${r.id}')" title="Ablehnen">✕</button>
    </div>`;
  }).join('');
}

function renderSocialOutgoing() {
  const list = document.getElementById('social-outgoing-list');
  if (!list) return;
  const reqs = outgoingRequests || [];
  if (!reqs.length) { list.innerHTML = ''; return; }
  list.innerHTML = `<div class="social-out-title">Ausgehend (${reqs.length})</div>` +
    reqs.map(() => `<div class="social-out-row">⏳ Warte auf Antwort</div>`).join('');
}

function renderSocialConversations() {
  const list     = document.getElementById('social-conversations');
  const msgBadge = document.getElementById('social-msg-count');
  if (!list) return;

  const friends  = friendsCache || [];
  if (!friends.length) {
    list.innerHTML = '<div class="muted-empty">Noch keine Freunde — füge oben jemanden hinzu</div>';
    if (msgBadge) msgBadge.style.display = 'none';
    return;
  }

  const unreadMap   = (typeof unreadCounts !== 'undefined') ? unreadCounts : {};
  const totalUnread = friends.reduce((sum, f) => sum + (unreadMap[f.id] || 0), 0);
  if (msgBadge) {
    if (totalUnread > 0) { msgBadge.style.display = 'inline-block'; msgBadge.textContent = totalUnread; }
    else msgBadge.style.display = 'none';
  }

  list.innerHTML = friends.map(f => {
    const initial  = (f.username?.[0] || '?').toUpperCase();
    const unread   = unreadMap[f.id] || 0;
    const safeName = escHtml(f.username || '').replace(/'/g, '&#39;');
    return `<div class="social-conv-row" onclick="openChat('${f.id}','${safeName}')">
      <div class="social-avatar">${escHtml(initial)}</div>
      <div class="social-conv-text">
        <div class="social-conv-name">${escHtml(f.username || '–')}</div>
        <div class="social-conv-last">${unread ? 'Neue Nachrichten ungelesen' : 'Tippen zum Schreiben…'}</div>
      </div>
      ${unread ? `<span class="social-unread">${unread}</span>` : ''}
      <button class="friend-action-btn ghost" style="font-size:16px;padding:4px 8px"
        onclick="event.stopPropagation(); openChallengeModal('${f.id}','${safeName}')"
        title="Herausfordern">⚔️</button>
    </div>`;
  }).join('');
}

function onSocialFriendSearch(e) {
  const q   = (e.target.value || '').trim();
  const out = document.getElementById('social-friend-results');
  if (!out) return;
  clearTimeout(socialFriendSearchTimer);
  if (q.length < 2) { out.innerHTML = ''; out.style.display = 'none'; return; }
  if (!currentUser) {
    out.style.display = 'block';
    out.innerHTML = '<div class="muted-empty">Bitte erst einloggen</div>';
    return;
  }
  socialFriendSearchTimer = setTimeout(async () => {
    out.style.display = 'block';
    out.innerHTML = '<div class="muted-empty">Suche…</div>';
    try {
      const results  = await searchFriends(q);
      if (!results || !results.length) {
        out.innerHTML = '<div class="muted-empty">Keine Treffer</div>';
        return;
      }
      const friendIds   = (friendsCache || []).map(f => f.id);
      const outgoingIds = (outgoingRequests || []).map(r => r.to_user);
      const incomingIds = (incomingRequests || []).map(r => r.from_user);

      out.innerHTML = results.map(u => {
        const initial   = (u.username?.[0] || '?').toUpperCase();
        const isFriend  = friendIds.includes(u.id);
        const isPending = outgoingIds.includes(u.id);
        const isIncoming= incomingIds.includes(u.id);
        let btn;
        if (isFriend)        btn = `<button class="btn-add-friend" disabled style="opacity:0.5">✓ Freund</button>`;
        else if (isPending)  btn = `<button class="btn-add-friend" disabled style="opacity:0.5">⏳ Wartet</button>`;
        else if (isIncoming) btn = `<button class="btn-add-friend" disabled style="opacity:0.7">📨 Eingegangen</button>`;
        else                 btn = `<button class="btn-add-friend" onclick="sendFriendRequest('${u.id}','${escHtml(u.username||'').replace(/'/g,'&#39;')}')">+ Freund</button>`;
        return `<div class="search-result-row">
          <div class="social-avatar">${escHtml(initial)}</div>
          <span class="search-result-name">${escHtml(u.username)}</span>
          ${btn}
        </div>`;
      }).join('');
    } catch (err) {
      out.innerHTML = `<div class="muted-empty">⚠️ ${escHtml(err.message || 'Fehler')}</div>`;
    }
  }, 250);
}

// ── Friends-Daten laden ──────────────────────────────────────
async function loadFriendsTab() {
  if (!currentUser) {
    incomingRequests = [];
    outgoingRequests = [];
    friendsCache     = [];
    updateSocialBadge(0);
    return;
  }
  try {
    await Promise.all([
      loadIncomingRequests(),
      loadOutgoingRequests(),
      typeof refreshUnreadCounts === 'function' ? refreshUnreadCounts() : Promise.resolve(),
      loadFriendsList()
    ]);
  } catch (e) {
    logInternal('friends/tab', e);
  }
  if ($id('screen-social')?.classList.contains('active')) {
    renderSocialIncoming();
    renderSocialOutgoing();
    renderSocialConversations();
  }
  updateSocialBadgeFromState();
}

async function loadIncomingRequests() {
  try {
    const { data, error } = await db.from('friend_requests')
      .select('id, from_user, status')
      .eq('to_user', currentUser.id)
      .eq('status', 'pending');
    if (error) throw error;

    const ids = (data || []).map(r => r.from_user);
    let userMap = {};
    if (ids.length) {
      const usrs = await db.from('users').select('id, username').in('id', ids);
      (usrs.data || []).forEach(u => { userMap[u.id] = u.username; });
    }
    incomingRequests = (data || []).map(r => ({
      id: r.id, from_user: r.from_user, username: userMap[r.from_user] || '?'
    }));
  } catch(e) {
    console.error('Incoming requests:', e);
    incomingRequests = [];
  }
}

async function loadOutgoingRequests() {
  try {
    const { data } = await db.from('friend_requests')
      .select('id, to_user')
      .eq('from_user', currentUser.id)
      .eq('status', 'pending');
    outgoingRequests = data || [];
  } catch(e) {
    outgoingRequests = [];
  }
}

async function loadFriendsList() {
  // Nur setHTML wenn Element vorhanden (kein Warning wenn Social-Tab nicht aktiv)
  if ($id('friends-list')) {
    setHTML('friends-list', '<div class="friends-empty">Lade Freunde…</div>');
  }

  if (!currentUser) {
    friendsCache = [];
    renderFriendsList();
    return;
  }

  try {
    const { data: friendsRows, error } = await db.from('friends')
      .select('friend_id')
      .eq('user_id', currentUser.id);
    if (error) throw error;

    const friendIds = (friendsRows || []).map(r => r.friend_id);
    if (!friendIds.length) {
      friendsCache = [];
      renderFriendsList();
      return;
    }

    const [usrRes, stkRes] = await Promise.all([
      db.from('users').select('id, username').in('id', friendIds),
      db.from('stickers').select('owner_id, points, country_code').in('owner_id', friendIds)
    ]);
    const usrs = usrRes.data || [];
    const stks = stkRes.data || [];

    const statMap = {};
    friendIds.forEach(id => { statMap[id] = { pts:0, stickers:0, countries:new Set() }; });
    stks.forEach(s => {
      const m = statMap[s.owner_id]; if (!m) return;
      m.pts += s.points || 0;
      m.stickers++;
      if (s.country_code) m.countries.add(s.country_code);
    });

    friendsCache = usrs.map(u => ({
      id:       u.id,
      username: u.username,
      pts:      statMap[u.id].pts,
      stickers: statMap[u.id].stickers,
      countries:statMap[u.id].countries.size
    })).sort((a,b) => b.pts - a.pts);

    renderFriendsList();
  } catch (e) {
    logInternal('friends/list', e);
    friendsCache = [];
    if ($id('friends-list')) {
      setHTML('friends-list', '<div class="friends-empty">⚠️ Konnte Freunde nicht laden</div>');
    }
  }
}

function renderFriendsList() {
  const el    = document.getElementById('friends-list');
  const badge = document.getElementById('seg-friend-count');
  if (!el) return;

  if (badge) {
    if (friendsCache.length > 0) { badge.style.display = ''; badge.textContent = friendsCache.length; }
    else badge.style.display = 'none';
  }

  if (!currentUser || !friendsCache.length) {
    el.innerHTML = `<div class="friends-empty">
      Noch keine Freunde.<br>
      <span style="font-size:11px;display:block;margin-top:4px">Suche oben Spieler nach Username und sende eine Anfrage.</span>
    </div>`;
    return;
  }

  const myStickers  = stickers.filter(s => s.owner_id === currentUser.id);
  const myPts       = myStickers.reduce((s,x) => s + (x.points||0), 0);
  const myCountries = new Set(myStickers.map(s => s.country_code)).size;

  const all = [
    ...friendsCache,
    { id: currentUser.id, username: currentUser.username, pts: myPts, stickers: myStickers.length, countries: myCountries, isMe: true }
  ].sort((a,b) => b.pts - a.pts);

  el.innerHTML = all.map((f, i) => {
    const rank     = i + 1;
    const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const initial  = (f.username[0] || '?').toUpperCase();
    return `<div class="friend-row" style="${f.isMe ? 'border-color:var(--accent);background:rgba(232,200,74,0.06)' : ''}">
      <div class="friend-avatar" title="${rankIcon}">${escHtml(initial)}</div>
      <div class="friend-name">${escHtml(f.username)}${f.isMe ? ' <span style="color:var(--accent);font-size:11px">(Du)</span>' : ''} <span style="color:var(--text2);font-size:11px;margin-left:4px">${rankIcon}</span>
        <small>${f.stickers} Sticker · ${f.countries} Länder</small>
      </div>
      <div class="friend-pts">${f.pts}<small>Pkt</small></div>
      ${f.isMe ? '' : `
        <button class="friend-action-btn ghost" onclick="messageFriend('${f.id}','${escHtml(f.username)}')" title="Nachricht">
          💬${typeof unreadCounts !== 'undefined' && unreadCounts[f.id] ? '<span class="unread-dot"></span>' : ''}
        </button>
        <button class="friend-action-btn ghost" onclick="openChallengeModal('${f.id}','${escHtml(f.username).replace(/'/g,'&#39;')}')" title="Herausfordern">⚔️</button>
        <button class="friend-action-btn ghost" onclick="removeFriend('${f.id}','${escHtml(f.username)}')" title="Entfernen">✕</button>
      `}
    </div>`;
  }).join('');
}

// ── Freund-Aktionen ──────────────────────────────────────────
async function searchFriends(q) {
  if (!currentUser) return [];
  const { data, error } = await db.from('users')
    .select('id, username')
    .ilike('username', `%${q}%`)
    .neq('id', currentUser.id)
    .limit(10);
  if (error) throw error;
  return data || [];
}

async function sendFriendRequest(toUserId, username) {
  if (!currentUser) { toast('Bitte einloggen', 'error'); return; }
  try {
    const { data: existing } = await db.from('friend_requests')
      .select('id, status')
      .eq('from_user', currentUser.id)
      .eq('to_user', toUserId)
      .in('status', ['pending','accepted'])
      .maybeSingle();
    if (existing) {
      toast(existing.status === 'accepted' ? 'Schon befreundet' : 'Anfrage läuft schon', 'error');
      return;
    }
    const { error } = await db.from('friend_requests').insert({
      from_user: currentUser.id, to_user: toUserId, status: 'pending'
    });
    if (error) throw error;
    toast(`📨 Anfrage an ${username} gesendet`, 'success');
    await loadOutgoingRequests();
    const input = document.getElementById('social-friend-search');
    const out   = document.getElementById('social-friend-results');
    if (input) input.value = '';
    if (out)   { out.innerHTML = ''; out.style.display = 'none'; }
    if (document.getElementById('screen-social')?.classList.contains('active')) renderSocialOutgoing();
  } catch(e) {
    console.error('sendFriendRequest:', e);
    toast('Fehler: ' + (e.message || 'Anfrage fehlgeschlagen'), 'error');
  }
}

async function acceptFriendRequest(requestId, fromUserId) {
  if (!currentUser) return;
  try {
    const { error: e1 } = await db.from('friend_requests').update({ status:'accepted' }).eq('id', requestId);
    if (e1) throw e1;
    const rows = [
      { user_id: currentUser.id, friend_id: fromUserId },
      { user_id: fromUserId,    friend_id: currentUser.id }
    ];
    const { error: e2 } = await db.from('friends').upsert(rows, { onConflict:'user_id,friend_id', ignoreDuplicates:true });
    if (e2 && e2.code !== '23505' && e2.status !== 409) throw e2;
    toast('✅ Freund hinzugefügt', 'success');
    await loadFriendsTab();
  } catch (e) {
    logInternal('friends/accept', e);
    toast('Konnte Anfrage nicht annehmen', 'error');
  }
}

async function declineFriendRequest(requestId) {
  if (!currentUser) return;
  try {
    const { error } = await db.from('friend_requests').update({ status:'declined' }).eq('id', requestId);
    if (error) throw error;
    toast('Abgelehnt', 'success');
    await loadIncomingRequests();
    if ($id('screen-social')?.classList.contains('active')) renderSocialIncoming();
    updateSocialBadgeFromState();
  } catch (e) {
    logInternal('friends/decline', e);
    toast('Konnte nicht ablehnen', 'error');
  }
}

async function removeFriend(friendId, username) {
  if (!currentUser) return;
  if (!confirm(`${username} aus deiner Freundesliste entfernen?`)) return;
  try {
    const { error } = await db.from('friends').delete().or(
      `and(user_id.eq.${currentUser.id},friend_id.eq.${friendId}),` +
      `and(user_id.eq.${friendId},friend_id.eq.${currentUser.id})`
    );
    if (error) throw error;
    await db.from('friend_requests').delete().or(
      `and(from_user.eq.${currentUser.id},to_user.eq.${friendId}),` +
      `and(from_user.eq.${friendId},to_user.eq.${currentUser.id})`
    );
    toast(`${username} entfernt`, 'success');
    await loadFriendsTab();
  } catch (e) {
    logInternal('friends/remove', e);
    toast('Entfernen fehlgeschlagen', 'error');
  }
}

async function acceptAllRequests() {
  if (!incomingRequests.length) return;
  const btn = document.getElementById('accept-all-btn') || document.getElementById('social-accept-all');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Bearbeite…'; }
  let ok = 0, fail = 0;
  for (const r of [...incomingRequests]) {
    try {
      const { error: e1 } = await db.from('friend_requests').update({ status:'accepted' }).eq('id', r.id);
      if (e1) throw e1;
      const { error: e2 } = await db.from('friends').insert([
        { user_id: currentUser.id, friend_id: r.from_user },
        { user_id: r.from_user,    friend_id: currentUser.id }
      ]);
      if (e2 && !e2.message?.includes('duplicate')) throw e2;
      ok++;
    } catch(e) {
      console.error('AcceptAll error:', e);
      fail++;
    }
  }
  if (btn) { btn.disabled = false; btn.textContent = '✅ Alle annehmen'; }
  toast(fail ? `${ok} angenommen, ${fail} Fehler` : `✅ ${ok} Freunde hinzugefügt`, fail ? 'error' : 'success');
  await loadFriendsTab();
}

function onFriendSearchInput(e) {
  const out = document.getElementById('friend-search-results');
  if (out) out.innerHTML = '';
}

// ── Voting-Countdown (benötigt voting.js) ────────────────────
function startVotingCountdown() {
  updateVotingCountdown();
  if (votingCountdownTimer) return;
  votingCountdownTimer = setInterval(updateVotingCountdown, 60000);
}

function updateVotingCountdown() {
  const el = document.getElementById('voting-countdown');
  if (!el) return;
  const now      = new Date();
  const deadline = new Date('2026-06-01T23:59:59');
  const diff     = deadline - now;
  if (diff <= 0) { el.textContent = 'beendet'; return; }
  const days  = Math.floor(diff / (1000*60*60*24));
  const hours = Math.floor((diff / (1000*60*60)) % 24);
  el.textContent = days > 0 ? `noch ${days}T ${hours}h` : `noch ${hours}h`;
}
