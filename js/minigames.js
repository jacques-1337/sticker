// ═══════════════════════════════════════════════
//  MINI-GAME MONATS-CHALLENGE
//  Design + Placeholder-Daten — Spiele folgen später
//  Benötigt: ui.js, auth.js, supabaseClient.js
// ═══════════════════════════════════════════════

// ── Game-Definitionen ────────────────────────────────────────
// live: true → Spiel spielbar, false → Coming Soon
const MGC_GAMES = [
  { key: 'racing',     icon: '🏎', name: 'Racing',      unit: 'Runden',  live: true,  prize: 30 },
  { key: 'connect4',   icon: '🔴', name: '4 gewinnt',   unit: 'Siege',   live: false, prize: 20 },
  { key: 'flappy',     icon: '🐤', name: 'Flappy Bird', unit: 'Meter',   live: false, prize: 20 },
  { key: 'tetris',     icon: '🧱', name: 'Tetris',      unit: 'Punkte',  live: false, prize: 20 },
  { key: 'snake',      icon: '🐍', name: 'Snake',       unit: 'Länge',   live: false, prize: 20 },
];

// ── Beispiel-Highscores (werden später aus DB geladen) ───────
const MGC_MOCK_SCORES = {
  flappy:      [
    { username:'felix32',  score:2847, me:false },
    { username:'eley',     score:1923, me:false },
    { username:'marco99',  score:1455, me:false },
    { username:'paula_s',  score:1102, me:false },
    { username:'Du',       score:342,  me:true  },
  ],
  tetris:      [
    { username:'marco99',  score:48200, me:false },
    { username:'Du',       score:31500, me:true  },
    { username:'felix32',  score:29800, me:false },
  ],
  snake:       [],
  dino:        [],
  pong:        [],
  memory:      [],
  minesweeper: [],
  '2048':      [],
};

// ── State ────────────────────────────────────────────────────
let mgcActiveGame  = MGC_GAMES[0].key;
let mgcCountdownTimer = null;

// ── Sektion ein-/ausklappen ──────────────────────────────────
function toggleMgcSection() {
  const content = document.getElementById('mgc-content');
  const icon    = document.getElementById('mgc-toggle-icon');
  if (!content) return;
  const collapsed = content.style.display === 'none';
  content.style.display = collapsed ? '' : 'none';
  if (icon) icon.style.transform = collapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
  try { localStorage.setItem('mgc-collapsed', collapsed ? '0' : '1'); } catch(_){}
}

function applyMgcCollapseState() {
  let collapsed = false;
  try { collapsed = localStorage.getItem('mgc-collapsed') === '1'; } catch(_){}
  const content = document.getElementById('mgc-content');
  const icon    = document.getElementById('mgc-toggle-icon');
  if (!content) return;
  content.style.display = collapsed ? 'none' : '';
  if (icon) icon.style.transform = collapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
}

// ── Countdown ────────────────────────────────────────────────
function startMgcCountdown() {
  updateMgcCountdown();
  if (mgcCountdownTimer) return;
  mgcCountdownTimer = setInterval(updateMgcCountdown, 60000);
}

function updateMgcCountdown() {
  const el = document.getElementById('mgc-countdown');
  if (!el) return;
  const now      = new Date();
  const deadline = new Date('2026-06-01T23:59:59');
  const diff     = deadline - now;
  if (diff <= 0) { el.textContent = 'beendet'; return; }
  const days  = Math.floor(diff / (1000*60*60*24));
  const hours = Math.floor((diff / (1000*60*60)) % 24);
  el.textContent = days > 0 ? `noch ${days}T ${hours}h` : `noch ${hours}h`;
}

// ── Haupt-Render ─────────────────────────────────────────────
function renderMgcSection() {
  renderMgcTabs();
  renderMgcBoard(mgcActiveGame);
  applyMgcCollapseState();
  startMgcCountdown();
}

function renderMgcTabs() {
  const container = document.getElementById('mgc-tabs');
  if (!container) return;

  container.innerHTML = MGC_GAMES.map(g => {
    const scores  = MGC_MOCK_SCORES[g.key] || [];
    const myEntry = scores.find(s => s.me);
    const badge   = myEntry
      ? `<span class="mgc-tab-badge">${scores.indexOf(myEntry)+1}.</span>`
      : (g.live ? '<span class="mgc-tab-badge" style="background:var(--green)">▶</span>' : '');

    return `<button class="mgc-tab${g.key === mgcActiveGame ? ' active' : ''}"
        onclick="switchMgcGame('${g.key}')">
      <span class="mgc-tab-icon">${g.icon}</span>
      <span>${g.name}</span>
      ${badge}
    </button>`;
  }).join('');
}

function switchMgcGame(key) {
  mgcActiveGame = key;
  // Tabs aktualisieren
  document.querySelectorAll('.mgc-tab').forEach((btn, i) => {
    btn.classList.toggle('active', MGC_GAMES[i].key === key);
  });
  renderMgcBoard(key);
}

function renderMgcBoard(key) {
  const host = document.getElementById('mgc-board');
  if (!host) return;

  const game    = MGC_GAMES.find(g => g.key === key);
  if (!game) return;

  const scores  = (MGC_MOCK_SCORES[key] || []).slice();
  const myEntry = scores.find(s => s.me);
  const myRank  = myEntry ? scores.indexOf(myEntry) + 1 : null;
  const top3    = scores.slice(0, 3);

  // Leaderboard-Zeilen bauen
  let rowsHtml = '';

  if (!scores.length) {
    rowsHtml = `<div class="mgc-empty">
      <div class="mgc-empty-icon">🏁</div>
      Noch keine Scores.<br>
      <span style="font-size:11px">Sei der Erste!</span>
    </div>`;
  } else {
    // Top-3 immer anzeigen
    top3.forEach((entry, i) => {
      rowsHtml += mgcRow(entry, i + 1, game.unit, game.lowerIsBetter);
    });

    // Trenner + eigene Position wenn nicht in Top 3
    if (myEntry && myRank > 3) {
      rowsHtml += `<div class="mgc-row mgc-separator">· · ·</div>`;
      rowsHtml += mgcRow(myEntry, myRank, game.unit, game.lowerIsBetter);
    }

    // Platz 4–10 (ohne eigenen falls schon dabei)
    scores.slice(3, 10).filter(e => !e.me).forEach((entry, i) => {
      rowsHtml += mgcRow(entry, i + 4, game.unit, game.lowerIsBetter);
    });
  }

  // Gewinner-Bonus-Hinweis
  const leaderBanner = scores.length > 0
    ? `<div class="mgc-leader-banner">
        👑 Aktuell führt <strong style="color:var(--accent);margin:0 3px">${escHtml(scores[0].username)}</strong>
        — Gewinner erhält <strong style="color:var(--accent)">${game.prize} Bonuspunkte</strong>
      </div>`
    : '';

  // Play-Button
  const playBtn = game.live
    ? `<button class="mgc-play-btn" onclick="launchMgcGame('${game.key}')">▶ Spielen</button>`
    : `<button class="mgc-play-btn" disabled title="Kommt bald">🔒 Bald</button>`;

  host.innerHTML = `<div class="mgc-board-inner">
    <div class="mgc-board-header">
      <div class="mgc-board-title">
        ${game.icon} ${escHtml(game.name)}
        <span class="mgc-board-unit">in ${escHtml(game.unit)}</span>
      </div>
      ${playBtn}
    </div>
    ${leaderBanner}
    ${rowsHtml}
    <div class="mgc-coming-soon">
      <div class="mgc-coming-soon-dot${game.live ? ' live' : ''}"></div>
      ${game.live
        ? 'Spiel ist live — starte und schlage den Rekord!'
        : 'Dieses Spiel wird gerade gebaut — kommt bald!'}
    </div>
  </div>`;
}

function mgcRow(entry, rank, unit, lowerIsBetter = false) {
  const rankIcon  = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
  const rankClass = rank <= 3 ? `r${rank}` : '';
  const initial   = (entry.username[0] || '?').toUpperCase();
  const score     = typeof entry.score === 'number'
    ? entry.score.toLocaleString('de')
    : '–';

  return `<div class="mgc-row${entry.me ? ' mgc-me' : ''}">
    <div class="mgc-rank ${rankClass}">${rankIcon}</div>
    <div class="mgc-avatar">${escHtml(initial)}</div>
    <div class="mgc-name">
      ${escHtml(entry.username)}${entry.me ? ' <span style="color:var(--accent);font-size:10px">(Du)</span>' : ''}
      ${entry.date ? `<small>${escHtml(entry.date)}</small>` : ''}
    </div>
    <div class="mgc-score">
      ${score}
      <small>${escHtml(unit)}</small>
    </div>
  </div>`;
}

// ── Tägliche Spielversuche prüfen ────────────────────────────
async function checkDailyAttempts(gameKey) {
  if (!currentUser || !useSupabase) return { allowed: true, count: 0, max: GAME_MAX_PLAYS_PER_DAY };
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const { data } = await db.from('minigame_attempts')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('game_key', gameKey)
      .gte('played_at', today + 'T00:00:00Z');
    const count = (data || []).length;
    return { allowed: count < GAME_MAX_PLAYS_PER_DAY, count, max: GAME_MAX_PLAYS_PER_DAY };
  } catch(e) { return { allowed: true, count: 0, max: GAME_MAX_PLAYS_PER_DAY }; }
}

async function trackAttempt(gameKey) {
  if (!currentUser || !useSupabase) return;
  try {
    await db.from('minigame_attempts').insert({ user_id: currentUser.id, game_key: gameKey });
  } catch(e) { /* ignorieren */ }
}

// ── Spiel starten ─────────────────────────────────────────────
async function launchMgcGame(key) {
  const game = MGC_GAMES.find(g => g.key === key);
  if (!game) return;
  if (!currentUser) { toast('🔒 Bitte einloggen', 'error'); return; }
  if (!game.live)   { toast(`🔒 ${game.name} kommt bald!`); return; }

  // Limit prüfen wenn Feature aktiv
  if (FEATURE_FLAGS.games_active) {
    const { allowed, count, max } = await checkDailyAttempts(key);
    if (!allowed) {
      toast(`Heute schon ${max}× gespielt — morgen wieder!`, 'error');
      return;
    }
    if (count > 0) toast(`Versuch ${count + 1} von ${max}`, '');
  }

  if (key === 'racing') {
    _openSoloRacingOverlay();
  } else {
    toast(`▶ ${game.name} startet…`, 'success');
  }
}

function _openSoloRacingOverlay() {
  if (typeof RacingGame === 'undefined') { toast('Racing-Modul fehlt', 'error'); return; }

  // Game-Overlay im Solo-Modus öffnen (ohne VS-Header)
  const overlay = document.getElementById('ch-game-overlay');
  const stage   = document.getElementById('ch-game-stage');
  const title   = document.getElementById('ch-game-title');
  const vsRow   = document.querySelector('.ch-vs');
  if (!overlay || !stage) return;

  if (title)  title.textContent = '🏎 Racing — Monatlicher Highscore';
  if (vsRow)  vsRow.style.display = 'none';
  overlay.classList.add('open');

  RacingGame.start(stage, async (score) => {
    if (vsRow) vsRow.style.display = '';
    overlay.classList.remove('open');
    await trackAttempt('racing');
    await submitMgcScore('racing', score);
  });
}

// ── Score eintragen (Placeholder — wird nach Spielimplementierung genutzt) ───
async function submitMgcScore(gameKey, score) {
  if (!currentUser || !useSupabase) return;
  try {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const game  = MGC_GAMES.find(g => g.key === gameKey);

    // Nur speichern wenn kein bestehender Score oder neuer ist besser
    const { data: existing } = await db.from('minigame_scores')
      .select('score').eq('user_id', currentUser.id)
      .eq('game_key', gameKey).eq('month', month).maybeSingle();

    const isBetter = !existing ||
      (game?.lowerIsBetter ? score < existing.score : score > existing.score);

    if (!isBetter) {
      toast(`Score: ${score} Pkt (Bestleistung: ${existing.score})`, '');
      return;
    }

    const { error } = await db.from('minigame_scores').upsert(
      { user_id: currentUser.id, game_key: gameKey, score, month },
      { onConflict: 'user_id,game_key,month' }
    );
    if (error) throw error;
    toast(`🏆 Neuer Highscore: ${score} Pkt!`, 'success');
    await loadMgcScores(gameKey);
    renderMgcBoard(gameKey);
  } catch(e) {
    logInternal('mgc/submit', e);
    toast('Score konnte nicht gespeichert werden', 'error');
  }
}

// ── Scores aus DB laden (sobald Tabelle existiert) ────────────
async function loadMgcScores(gameKey) {
  if (!useSupabase) return;
  try {
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;
    const { data, error } = await db.from('minigame_scores')
      .select('user_id, score, users(username)')
      .eq('game_key', gameKey)
      .eq('month', month)
      .order('score', { ascending: false })
      .limit(20);
    if (error) throw error;

    const game = MGC_GAMES.find(g => g.key === gameKey);
    const sorted = (data || []).sort((a, b) =>
      game?.lowerIsBetter ? a.score - b.score : b.score - a.score
    );
    MGC_MOCK_SCORES[gameKey] = sorted.map(row => ({
      username: row.users?.username || '?',
      score:    row.score,
      me:       row.user_id === currentUser?.id
    }));
  } catch(e) {
    // Tabelle existiert noch nicht → Mock-Daten behalten
  }
}

async function loadAllMgcScores() {
  if (!useSupabase) return;
  await Promise.all(MGC_GAMES.map(g => loadMgcScores(g.key)));
  if (document.getElementById('mgc-section')) renderMgcSection();
}
