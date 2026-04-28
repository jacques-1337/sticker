// ═══════════════════════════════════════════════
//  CHALLENGES — Erstellen, Annehmen, Ablehnen, Status
//  Benötigt: ui.js, auth.js, games/index.js, supabaseClient.js
// ═══════════════════════════════════════════════

let challengesCache = [];
let activeChallenge = null;
let challengeChannel = null;
let pendingChallengeTarget = null; // { id, username, liveScore }

// ── Daten laden ──────────────────────────────────────────────
async function loadChallenges() {
  if (!currentUser || !db) { challengesCache = []; return; }
  try {
    const { data, error } = await db.from('challenges')
      .select('id, challenger_id, opponent_id, game_type, points_stake, status, winner_id, game_state, created_at, updated_at')
      .or(`challenger_id.eq.${currentUser.id},opponent_id.eq.${currentUser.id}`)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false });
    if (error) throw error;

    const otherIds = [...new Set((data || []).map(c =>
      c.challenger_id === currentUser.id ? c.opponent_id : c.challenger_id))];
    let userMap = {};
    if (otherIds.length) {
      const { data: us } = await db.from('users').select('id, username').in('id', otherIds);
      (us || []).forEach(u => { userMap[u.id] = u.username; });
    }
    challengesCache = (data || []).map(c => ({
      ...c,
      _other_id: c.challenger_id === currentUser.id ? c.opponent_id : c.challenger_id,
      _other_username: userMap[c.challenger_id === currentUser.id ? c.opponent_id : c.challenger_id] || '?',
      _i_am_challenger: c.challenger_id === currentUser.id
    }));
  } catch (e) {
    logInternal('challenges/load', e);
    challengesCache = [];
  }
}

// ── Challenges-Liste rendern ─────────────────────────────────
function renderChallenges() {
  const host = $id('challenges-list');
  const badge = $id('ch-badge');
  if (!host) return;

  const incomingPending = challengesCache.filter(c => !c._i_am_challenger && c.status === 'pending');
  if (badge) {
    if (incomingPending.length) { badge.style.display = ''; badge.textContent = incomingPending.length; }
    else badge.style.display = 'none';
  }

  if (!challengesCache.length) {
    host.innerHTML = `<div class="muted-empty" style="padding:8px 4px">
      Keine offenen Challenges.<br>
      <span style="font-size:11px">Klicke ⚔️ neben einem Freund, um eine Herausforderung zu senden.</span>
    </div>`;
    return;
  }

  host.innerHTML = `<div class="ch-list">${challengesCache.map(c => {
    const g = GAMES[c.game_type] || { name: c.game_type, icon: '🎮' };
    const me = c._i_am_challenger;
    let cls = 'ch-row';
    let actions = '';
    let title;
    let sub = `${g.name} · 💰 ${c.points_stake} Pkt`;

    if (c.status === 'pending' && !me) {
      cls += ' pending-in';
      title = `${escHtml(c._other_username)} fordert dich heraus`;
      actions = `
        <button class="ch-btn" onclick="acceptChallenge('${c.id}')">✓</button>
        <button class="ch-btn ghost" onclick="declineChallenge('${c.id}')">✕</button>`;
    } else if (c.status === 'pending' && me) {
      title = `Wartet auf ${escHtml(c._other_username)}…`;
      actions = `<button class="ch-btn ghost" onclick="cancelChallenge('${c.id}')">Zurückziehen</button>`;
    } else if (c.status === 'active') {
      cls += ' active';
      title = `vs. ${escHtml(c._other_username)}`;
      sub = `${g.name} · 💰 ${c.points_stake} Pkt · läuft`;
      actions = `<button class="ch-btn" onclick="resumeChallenge('${c.id}')">▶ Fortsetzen</button>`;
    }

    return `<div class="${cls}">
      <div class="ch-icon">${g.icon}</div>
      <div class="ch-body">
        <div class="ch-title">${title}</div>
        <div class="ch-sub">${sub}</div>
      </div>
      <div class="ch-actions">${actions}</div>
    </div>`;
  }).join('')}</div>`;
}

// ── Modal: Challenge erstellen ───────────────────────────────
function openChallengeModal(friendId, friendUsername) {
  if (!currentUser) { toast('🔒 Bitte einloggen', 'error'); return; }

  // Gesamtscore = Sticker-Punkte + Challenge-Bonus/Malus
  const stickerScore   = stickers
    .filter(s => s.owner_id === currentUser.id)
    .reduce((sum, s) => sum + (s.points || 0), 0);
  const challengeBonus = currentUser.points || 0;
  const liveScore      = Math.max(0, stickerScore + challengeBonus);

  pendingChallengeTarget = { id: friendId, username: friendUsername, liveScore };
  $id('ch-create-friend-name').textContent = friendUsername;
  $id('ch-stake-input').value = 10;

  // Game-Grid aus Registry rendern
  renderGameGrid();
  $id('ch-create-modal').classList.add('open');
}

function closeChallengeModal() {
  $id('ch-create-modal').classList.remove('open');
  pendingChallengeTarget = null;
}

async function submitChallenge() {
  if (!pendingChallengeTarget || !currentUser) return;
  const selected = document.querySelector('#ch-game-grid .ch-game.selected');
  const gameType = selected?.dataset.game || 'connect4';
  const stakeRaw = parseInt($id('ch-stake-input').value, 10);
  const stake    = isNaN(stakeRaw) ? 0 : Math.max(0, Math.min(9999, stakeRaw));

  // Live-Score verwenden (korrekte Punkte, die der User im UI sieht)
  const myPts = pendingChallengeTarget.liveScore ?? 0;
  if (stake > myPts) {
    toast(`Du hast nur ${myPts} Punkte`, 'error');
    return;
  }
  await sendChallenge(pendingChallengeTarget.id, gameType, stake);
  closeChallengeModal();
}

// ── Aktionen ─────────────────────────────────────────────────
async function sendChallenge(opponentId, gameType, stake) {
  if (!currentUser) return;
  if (!GAMES[gameType]) { toast('Unbekanntes Spiel', 'error'); return; }
  try {
    const { data, error } = await db.from('challenges').insert({
      challenger_id: currentUser.id,
      opponent_id:   opponentId,
      game_type:     gameType,
      points_stake:  stake,
      status:        'pending',
      game_state:    {}
    }).select('id').single();
    if (error) throw error;
    toast('⚔️ Herausforderung gesendet', 'success');
    await loadChallenges();
    if ($id('screen-social')?.classList.contains('active')) renderChallenges();
  } catch (e) {
    logInternal('ch/send', e);
    toast('Senden fehlgeschlagen', 'error');
  }
}

async function acceptChallenge(challengeId) {
  if (!currentUser) return;
  const cached = challengesCache.find(x => x.id === challengeId);
  const initGs = cached?.game_type === 'connect4'
    ? { board: Array(6).fill(null).map(() => Array(7).fill(null)), turn: cached.challenger_id }
    : {};
  try {
    const { data, error } = await db.from('challenges')
      .update({ status: 'active', updated_at: new Date().toISOString(), game_state: initGs })
      .eq('id', challengeId)
      .eq('opponent_id', currentUser.id)
      .eq('status', 'pending')
      .select('*').single();
    if (error) throw error;
    toast('✅ Challenge angenommen', 'success');
    await loadChallenges();
    renderChallenges();
    openGameOverlay(data.id);
  } catch (e) {
    logInternal('ch/accept', e);
    toast('Annehmen fehlgeschlagen', 'error');
  }
}

async function declineChallenge(challengeId) {
  if (!currentUser) return;
  try {
    const { error } = await db.from('challenges')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', challengeId)
      .eq('opponent_id', currentUser.id);
    if (error) throw error;
    toast('Challenge abgelehnt', '');
    await loadChallenges(); renderChallenges();
  } catch (e) {
    logInternal('ch/decline', e);
    toast('Ablehnen fehlgeschlagen', 'error');
  }
}

async function cancelChallenge(challengeId) {
  if (!currentUser) return;
  try {
    const { error } = await db.from('challenges')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', challengeId)
      .eq('challenger_id', currentUser.id)
      .eq('status', 'pending');
    if (error) throw error;
    toast('Challenge zurückgezogen', '');
    await loadChallenges(); renderChallenges();
  } catch (e) {
    logInternal('ch/cancel', e);
    toast('Zurückziehen fehlgeschlagen', 'error');
  }
}

async function finishChallenge(challengeId, winnerId) {
  try {
    const { data, error } = await db.rpc('finish_challenge', {
      p_challenge_id: challengeId,
      p_winner_id:    winnerId
    });
    if (error) throw error;
    // currentUser.points nach Challenge aus DB neu laden
    await refreshUserPoints();
    return data;
  } catch (e) {
    logInternal('ch/finish', e);
    toast('Konnte Spiel nicht abschließen', 'error');
    return null;
  }
}

// Lädt users.points frisch aus der DB und aktualisiert currentUser
async function refreshUserPoints() {
  if (!currentUser || !useSupabase) return;
  try {
    const { data } = await db.from('users').select('points').eq('id', currentUser.id).single();
    if (data) currentUser.points = data.points || 0;
  } catch(e) { /* ignorieren */ }
}

async function transferPoints(winnerId, loserId, amount) {
  if (!winnerId || !loserId || winnerId === loserId || amount <= 0) return false;
  try {
    const { data: l } = await db.from('users').select('points').eq('id', loserId).single();
    const { data: w } = await db.from('users').select('points').eq('id', winnerId).single();
    await db.from('users').update({ points: Math.max(0, (l?.points || 0) - amount) }).eq('id', loserId);
    await db.from('users').update({ points: (w?.points || 0) + amount }).eq('id', winnerId);
    return true;
  } catch (e) {
    logInternal('ch/transfer', e);
    return false;
  }
}

// ── Game-Overlay ─────────────────────────────────────────────
function openGameOverlay(challengeId) {
  const c = challengesCache.find(x => x.id === challengeId);
  if (!c) { toast('Challenge nicht gefunden', 'error'); return; }
  activeChallenge = c;
  const g = GAMES[c.game_type] || { name: c.game_type, icon: '🎮' };

  $id('ch-game-title').textContent  = `${g.icon} ${g.name}`;
  $id('ch-game-status').textContent = '';
  $id('ch-vs-me').textContent       = currentUser.username || 'Ich';
  $id('ch-vs-opp').textContent      = c._other_username;
  $id('ch-vs-stake').textContent    = c.points_stake;

  if (c.game_type === 'connect4') {
    $id('ch-game-overlay').classList.add('open');
    renderConnect4(c);
  } else {
    $id('ch-game-stage').innerHTML = `<div style="text-align:center;color:var(--text2);padding:40px 16px">
      🎮 ${g.name} kommt im nächsten Update.<br>
      <span style="font-size:11px">Du kannst die Challenge bereits akzeptieren — das Spiel selbst folgt.</span>
      <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
        <button class="ch-btn" onclick="testFinishWin()">Testweise gewinnen</button>
        <button class="ch-btn ghost" onclick="testFinishTie()">Unentschieden</button>
        <button class="ch-btn danger" onclick="testFinishLose()">Testweise verlieren</button>
      </div>
    </div>`;
    $id('ch-game-overlay').classList.add('open');
  }
}

function closeGameOverlay() {
  $id('ch-game-overlay').classList.remove('open');
  activeChallenge = null;
}

async function resumeChallenge(challengeId) {
  openGameOverlay(challengeId);
}

async function testFinishWin() {
  if (!activeChallenge) return;
  const res = await finishChallenge(activeChallenge.id, currentUser.id);
  if (res) {
    toast(`🏆 +${activeChallenge.points_stake} Pkt!`, 'success');
    await loadChallenges(); renderChallenges(); closeGameOverlay();
  }
}
async function testFinishLose() {
  if (!activeChallenge) return;
  const loserId  = currentUser.id;
  const winnerId = activeChallenge._other_id;
  const res = await finishChallenge(activeChallenge.id, winnerId);
  if (res) {
    toast(`💔 -${activeChallenge.points_stake} Pkt`, 'error');
    await loadChallenges(); renderChallenges(); closeGameOverlay();
  }
}
async function testFinishTie() {
  if (!activeChallenge) return;
  const res = await finishChallenge(activeChallenge.id, null);
  if (res) {
    toast('🤝 Unentschieden', 'info');
    await loadChallenges(); renderChallenges(); closeGameOverlay();
  }
}

// ── Realtime ─────────────────────────────────────────────────
function subscribeToChallenges() {
  if (!currentUser || !db?.channel) return null;
  if (challengeChannel) return challengeChannel;
  challengeChannel = db
    .channel(`challenges:user:${currentUser.id}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'challenges',
        filter: `opponent_id=eq.${currentUser.id}` },
      payload => onChallengeChange(payload))
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'challenges',
        filter: `challenger_id=eq.${currentUser.id}` },
      payload => onChallengeChange(payload))
    .subscribe(s => { if (s === 'SUBSCRIBED') console.info('[ch] realtime aktiv'); });
  return challengeChannel;
}

function ensureChallengeSubscription() {
  if (!challengeChannel) subscribeToChallenges();
}

function unsubscribeFromChallenges() {
  if (challengeChannel && db?.removeChannel) {
    db.removeChannel(challengeChannel);
    challengeChannel = null;
  }
}

async function onChallengeChange(payload) {
  const row = payload.new || payload.old;
  if (!row) return;
  await loadChallenges();
  if ($id('screen-social')?.classList.contains('active')) renderChallenges();

  if (activeChallenge && row.id === activeChallenge.id) {
    const updated = challengesCache.find(x => x.id === row.id);
    if (updated) {
      activeChallenge = updated;
      if (updated.game_type === 'connect4') renderConnect4(updated);
    }
  }

  if (payload.eventType === 'INSERT' && row.opponent_id === currentUser.id && row.status === 'pending') {
    toast('⚔️ Neue Challenge!', 'info');
  }
  if (payload.eventType === 'UPDATE' && row.challenger_id === currentUser.id) {
    if (row.status === 'active')   toast('🎮 Challenge angenommen!', 'success');
    if (row.status === 'declined') toast('❌ Challenge abgelehnt', 'info');
    if (row.status === 'finished') {
      const won = row.winner_id === currentUser.id;
      if (won)             toast(`🏆 +${row.points_stake} Pkt!`, 'success');
      else if (row.winner_id) toast(`💔 -${row.points_stake} Pkt`, 'error');
      else                 toast('🤝 Unentschieden', 'info');
    }
  }
}
