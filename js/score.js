// ═══════════════════════════════════════════════
//  SCORE — Leaderboard, Score-Karte, Tabs
//  Benötigt: supabaseClient.js, auth.js, ui.js
// ═══════════════════════════════════════════════

let currentScoreTab = 'players';

function switchScoreTab(tab) {
  currentScoreTab = tab;
  document.querySelectorAll('.score-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  document.querySelectorAll('.score-tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'tab-' + tab);
  });
  if (tab === 'countries') loadCountryScoreboard();
  if (tab === 'players')   loadLeaderboard();
  if (tab === 'friends')   loadFriendsLeaderboard();
}

function loadFriendsLeaderboard() {
  const listEl = $id('friends-leaderboard-list');
  if (!listEl) return;

  if (!currentUser) {
    listEl.innerHTML = `
      <div class="empty-state">
        <span class="es-icon">🔒</span>
        <h3>Login erforderlich</h3>
        <p>Melde dich an, um deine Freunde hier zu sehen.</p>
      </div>`;
    return;
  }

  const cache = typeof friendsCache !== 'undefined' ? friendsCache : [];
  const myPts = (currentUser.points || 0) +
    stickers.filter(s => s.owner_id === currentUser.id).reduce((s,x) => s + (x.points||x.pts||0), 0);

  const entries = [
    { id: currentUser.id, username: currentUser.username, pts: myPts, isSelf: true },
    ...cache.map(f => ({ ...f, isSelf: false }))
  ].sort((a, b) => b.pts - a.pts);

  if (cache.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <span class="es-icon">👥</span>
        <h3>Noch keine Freunde</h3>
        <p>Füge Freunde im Social-Tab hinzu, um hier ein Ranking zu sehen.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = entries.map((e, i) => {
    const rank = i + 1;
    const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    const rankClass = rank <= 3 ? `top${rank}` : '';
    const meClass   = e.isSelf ? 'is-me' : '';
    const tag       = e.isSelf ? ' <small style="font-size:10px;color:var(--text2)">(du)</small>' : '';
    return `
      <div class="lb-row ${meClass}">
        <div class="lb-rank ${rankClass}">${rankLabel}</div>
        <div class="lb-name">${escHtml(e.username)}${tag}</div>
        <div class="lb-pts">${e.pts} <small>Pkt</small></div>
      </div>`;
  }).join('');
}

// ── Score-Karte ───────────────────────────────────────────────
function updateMyScoreCard(me, rank, total) {
  const legacySetup = document.getElementById('name-setup');
  if (legacySetup) legacySetup.classList.remove('show');

  if (!currentUser) {
    document.getElementById('my-name-text').textContent = '🔒 Nicht angemeldet';
    document.getElementById('my-name-sub').textContent  = 'Einloggen um eigene Stats zu sehen';
  } else {
    document.getElementById('my-name-text').textContent = currentUser.username;
    document.getElementById('my-name-sub').textContent  = rank
      ? `Platz ${rank} von ${total} Spielern`
      : 'Noch keine Sticker gesetzt';
  }

  const badge = document.getElementById('my-rank-badge');
  if (rank === 1)      badge.textContent = '🥇';
  else if (rank === 2) badge.textContent = '🥈';
  else if (rank === 3) badge.textContent = '🥉';
  else                 badge.textContent = rank ? `#${rank}` : '#–';

  const myStickers = stickers.filter(s => {
    if (currentUser && s.owner_id === currentUser.id) return true;
    if (!currentUser && s.session_id === mySessionId) return true;
    if (!currentUser && myUserId && s.user_id === myUserId) return true;
    return false;
  });
  const src            = me || null;
  const stickerPts     = src ? src.stickerPts : myStickers.reduce((sum,s)=>sum+(s.points||s.pts||0),0);
  const challengeBonus = src ? (src.challengeBonus||0) : (currentUser?.points || 0);
  const totalPts       = stickerPts + challengeBonus;
  const stickerCount   = src ? src.stickers  : myStickers.length;
  const countryCount   = src ? src.countries : new Set(myStickers.map(s=>s.country_code||s.countryCode||s.cc)).size;
  const continentCount = src ? src.continents: new Set(myStickers.map(s=>s.continent)).size;
  const photoCount     = src ? src.photos    : myStickers.filter(s=>s.photo_url||s.photoData).length;

  // Punkte-Anzeige: Basis + Challenge-Bonus/Malus separat
  const bonusStr = challengeBonus !== 0
    ? ` <small style="font-size:12px;color:${challengeBonus>0?'var(--green)':'var(--red)'}">${challengeBonus>0?'+':''}${challengeBonus} CH</small>`
    : '';
  document.getElementById('my-pts-big').innerHTML = `${totalPts}${bonusStr} <small>Pkt</small>`;
  document.getElementById('my-sticker-count').textContent  = stickerCount;
  document.getElementById('my-country-count').textContent  = countryCount;
  document.getElementById('my-continent-count').textContent= continentCount;
  document.getElementById('my-photo-count').textContent    = photoCount;

  const bd = { dist:0, capital:0, newCountry:0, photo:0 };
  myStickers.forEach(s => {
    const b = s.pts_breakdown || s.breakdown || {};
    bd.dist       += b.dist       || 0;
    bd.capital    += b.capital    || 0;
    bd.newCountry += b.newCountry || 0;
    bd.photo      += b.photo      || 0;
  });
  const bsEl = document.getElementById('score-breakdown');
  if (bsEl && stickerCount > 0) {
    bsEl.style.display = '';
    document.getElementById('bd-score-dist').textContent         = `+${bd.dist} Pkt`;
    document.getElementById('bds-capital-row').style.display     = bd.capital    ? '' : 'none';
    document.getElementById('bd-score-capital').textContent      = `+${bd.capital} Pkt`;
    document.getElementById('bds-newcountry-row').style.display  = bd.newCountry ? '' : 'none';
    document.getElementById('bd-score-newcountry').textContent   = `+${bd.newCountry} Pkt`;
    document.getElementById('bds-photo-row').style.display       = bd.photo      ? '' : 'none';
    document.getElementById('bd-score-photo').textContent        = `+${bd.photo} Pkt`;
    document.getElementById('bd-score-total').textContent        = `${totalPts} Pkt`;
  } else if (bsEl) { bsEl.style.display = 'none'; }

  document.getElementById('score-header-sub').textContent = rank
    ? `Du bist auf Platz ${rank}`
    : 'Globale Rangliste';
}

function updateScore() {
  if (document.getElementById('screen-score').classList.contains('active')) {
    loadLeaderboard();
  } else {
    updateMyScoreCard(null, null, 0);
  }
}

// ── Globales Leaderboard ──────────────────────────────────────
async function loadLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  list.innerHTML = '<div class="lb-loading">Lade Rangliste…</div>';
  if (!useSupabase) { list.innerHTML = '<div class="lb-loading">⚠️ Keine Datenbankverbindung</div>'; return; }

  try {
    const timeout = (ms) => new Promise((_,reject) => setTimeout(()=>reject(new Error('timeout')),ms));
    const [stickersRes, usersRes] = await Promise.all([
      Promise.race([db.from('stickers').select('owner_id, session_id, username, points, country_code, continent, photo_url'), timeout(7000)]),
      // points = Challenge-Bonus/Malus (kann negativ sein)
      Promise.race([db.from('users').select('id, username, points'), timeout(7000)])
    ]);
    if (stickersRes.error) throw stickersRes.error;
    const allStickers = stickersRes.data || [];
    const users       = usersRes.data   || [];

    const userNameMap    = {};
    const userBonusMap   = {}; // id → challenge bonus/malus
    users.forEach(u => {
      userNameMap[u.id]  = u.username;
      userBonusMap[u.id] = u.points || 0;
    });

    const playerMap = {};
    allStickers.forEach(s => {
      const key = s.owner_id || s.session_id;
      if (!key) return;
      if (!playerMap[key]) {
        playerMap[key] = {
          name: userNameMap[s.owner_id] || s.username || null,
          ownerId: s.owner_id || null, sid: s.session_id || null,
          isRegistered: !!s.owner_id,
          stickerPts:0, pts:0, challengeBonus:0,
          stickers:0, countries:new Set(), continents:new Set(), photos:0
        };
      }
      if (s.owner_id && userNameMap[s.owner_id]) playerMap[key].name = userNameMap[s.owner_id];
      else if (s.username && !playerMap[key].name) playerMap[key].name = s.username;
      playerMap[key].stickerPts += s.points || 0;
      playerMap[key].stickers++;
      if (s.country_code) playerMap[key].countries.add(s.country_code);
      if (s.continent)    playerMap[key].continents.add(s.continent);
      if (s.photo_url)    playerMap[key].photos++;
    });

    // Challenge-Bonus/Malus pro Spieler addieren
    Object.values(playerMap).forEach(p => {
      p.challengeBonus = p.ownerId ? (userBonusMap[p.ownerId] || 0) : 0;
      p.pts            = p.stickerPts + p.challengeBonus;
    });

    const allPlayers    = Object.values(playerMap)
      .map(p => ({ ...p, countries: p.countries.size, continents: p.continents.size }))
      .sort((a,b) => b.pts - a.pts);
    const publicPlayers = allPlayers.filter(p => p.name);

    const isMe = (p) => {
      if (currentUser && p.ownerId === currentUser.id) return true;
      if (!currentUser && p.sid === mySessionId) return true;
      return false;
    };
    const myIdx     = allPlayers.findIndex(isMe);
    const myInPublic= publicPlayers.findIndex(isMe);
    const myRank    = myInPublic >= 0 ? myInPublic + 1 : null;

    updateMyScoreCard(myIdx >= 0 ? allPlayers[myIdx] : null, myRank, publicPlayers.length);

    if (!publicPlayers.length) {
      list.innerHTML = `<div class="lb-loading" style="padding:24px">
        Noch keine Einträge mit Namen.<br>
        <span style="font-size:12px;opacity:0.6;margin-top:6px;display:block">Account erstellen um teilzunehmen.</span>
      </div>`;
      return;
    }

    const showTop = 10;
    let html = '';
    publicPlayers.slice(0, showTop).forEach((p, i) => {
      const rank      = i + 1;
      const me        = isMe(p);
      const rankIcon  = rank===1?'🥇': rank===2?'🥈': rank===3?'🥉':`#${rank}`;
      const rankClass = rank <= 3 ? `top${rank}` : '';
      const regBadge  = p.isRegistered ? ' ✓' : '';
      html += `<div class="lb-row${me?' is-me':''}">
        <div class="lb-rank ${rankClass}">${rankIcon}</div>
        <div class="lb-name">
          ${escHtml(p.name)}${regBadge}${me?' <span style="color:var(--accent);font-size:11px">(Du)</span>':''}
          <small>${p.stickers} Sticker · ${p.countries} Länder · ${p.continents} Kontinente</small>
        </div>
        <div class="lb-pts">${p.pts}<small>Pkt</small></div>
      </div>`;
    });

    if (myRank && myRank > showTop) {
      html += '<div class="lb-separator">· · ·</div>';
      const me = publicPlayers[myInPublic];
      html += `<div class="lb-row is-me">
        <div class="lb-rank">#${myRank}</div>
        <div class="lb-name">${escHtml(me.name)} <span style="color:var(--accent);font-size:11px">(Du)</span>
          <small>${me.stickers} Sticker · ${me.countries} Länder</small>
        </div>
        <div class="lb-pts">${me.pts}<small>Pkt</small></div>
      </div>`;
    }
    list.innerHTML = html;

  } catch(e) {
    console.error('Leaderboard error:', e);
    const isMissingCol = e.message?.includes('column') || e.message?.includes('does not exist');
    list.innerHTML = `<div class="lb-loading">
      ⚠️ ${isMissingCol ? 'Datenbank-Spalten fehlen' : 'Fehler beim Laden'}
      <br><small style="font-size:11px;opacity:0.6;display:block;margin-top:6px">${escHtml(e.message||'')}</small>
    </div>`;
  }
}

// ── Länder-Scoreboard ─────────────────────────────────────────
async function loadCountryScoreboard() {
  const list = document.getElementById('country-scoreboard-list');
  list.innerHTML = '<div class="lb-loading">Lade Länder…</div>';
  if (!useSupabase) { list.innerHTML = '<div class="lb-loading">⚠️ Keine Datenbankverbindung</div>'; return; }

  try {
    const timeout = (ms) => new Promise((_,reject) => setTimeout(()=>reject(new Error('timeout')),ms));
    const [stickersRes, usersRes] = await Promise.all([
      Promise.race([db.from('stickers').select('owner_id, session_id, username, points, country, country_code, flag'), timeout(7000)]),
      Promise.race([db.from('users').select('id, username'), timeout(7000)])
    ]);
    if (stickersRes.error) throw stickersRes.error;
    const allStickers = stickersRes.data || [];
    const users       = usersRes.data   || [];
    const userNameMap = {};
    users.forEach(u => { userNameMap[u.id] = u.username; });

    const countryMap = {};
    allStickers.forEach(s => {
      const cc = s.country_code || '??';
      if (!countryMap[cc]) {
        countryMap[cc] = { cc, name: s.country||'Unbekannt', flag: s.flag||ccToFlag(cc), stickers:0, points:0, contributors:{} };
      }
      const c         = countryMap[cc];
      c.stickers++;
      c.points += s.points || 0;
      const playerKey  = s.owner_id || s.session_id || 'anon';
      const playerName = userNameMap[s.owner_id] || s.username || '?';
      if (!c.contributors[playerKey]) c.contributors[playerKey] = { name: playerName, count:0 };
      c.contributors[playerKey].count++;
    });

    const countries = Object.values(countryMap).map(c => {
      const contribArr = Object.values(c.contributors).sort((a,b) => b.count-a.count);
      return { ...c, contributorCount: contribArr.length, topContributor: contribArr[0]?.name||'–' };
    }).sort((a,b) => b.stickers - a.stickers);

    if (!countries.length) {
      list.innerHTML = '<div class="lb-loading" style="padding:24px">Noch keine Sticker.</div>';
      return;
    }
    list.innerHTML = countries.map((c, i) => {
      const rank     = i+1;
      const rankIcon = rank===1?'🥇': rank===2?'🥈': rank===3?'🥉':`#${rank}`;
      return `<div class="country-row">
        <div class="country-rank">${rankIcon}</div>
        <div class="country-flag">${c.flag}</div>
        <div class="country-info">
          <div class="country-name">${escHtml(c.name)}
            <small>👥 ${c.contributorCount} Spieler · Top: ${escHtml(c.topContributor)}</small>
          </div>
        </div>
        <div class="country-stats">${c.stickers}<small>Sticker · ${c.points} Pkt</small></div>
      </div>`;
    }).join('');
  } catch(e) {
    console.error('Country scoreboard error:', e);
    list.innerHTML = `<div class="lb-loading">⚠️ Fehler: ${escHtml(e.message||'')}</div>`;
  }
}

// ── Segmented Control (Profil-Tab) ────────────────────────────
let currentFriendsSeg = 'friends';

function switchFriendsSeg(seg) {
  currentFriendsSeg = seg;
  document.querySelectorAll('.seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.seg === seg);
  });
  document.getElementById('seg-friends-content') ?.classList.toggle('active', seg === 'friends');
  document.getElementById('seg-requests-content')?.classList.toggle('active', seg === 'requests');
}
