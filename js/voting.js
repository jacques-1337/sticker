// ═══════════════════════════════════════════════
//  VOTING — Sticker of the Month
//  Benötigt: auth.js, stickers.js, ui.js, supabaseClient.js
// ═══════════════════════════════════════════════

let votingState = {
  month:      null,
  myVote:     null,
  voteCounts: {},
  lastWinner: null,
  loading:    false
};

function getCurrentMonth(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function getPreviousMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth()-1, 1);
  return getCurrentMonth(x);
}

async function loadMonthlyVotes() {
  const month = getCurrentMonth();
  votingState.month = month;
  if (!useSupabase || !db) return;

  try {
    const { data: votes, error } = await db.from('sticker_votes')
      .select('voter_id, sticker_id').eq('month', month);
    if (error) throw error;
    const counts = {};
    let myVote = null;
    (votes||[]).forEach(v => {
      counts[v.sticker_id] = (counts[v.sticker_id]||0)+1;
      if (currentUser && v.voter_id === currentUser.id) myVote = v.sticker_id;
    });
    votingState.voteCounts = counts;
    votingState.myVote     = myVote;
  } catch (e) {
    logInternal('vote/load', e);
    votingState.voteCounts = {};
    votingState.myVote = null;
  }

  try {
    const prev = getPreviousMonth();
    const { data: winRow } = await db.from('sticker_month_winners')
      .select('month, sticker_id, winner_id, votes').eq('month', prev).maybeSingle();
    if (winRow) {
      const { data: u } = await db.from('users').select('username').eq('id', winRow.winner_id).maybeSingle();
      votingState.lastWinner = { month: winRow.month, sticker_id: winRow.sticker_id, winner_username: u?.username||'?', votes: winRow.votes };
    } else {
      votingState.lastWinner = null;
    }
  } catch (e) { votingState.lastWinner = null; }
}

async function voteForSticker(stickerId) {
  if (!currentUser) { toast('🔒 Bitte einloggen', 'error'); return; }
  const sticker = stickers.find(s => String(s.id) === String(stickerId));
  if (!sticker) { toast('Sticker nicht gefunden', 'error'); return; }
  if (sticker.owner_id === currentUser.id) { toast('Du kannst nicht für deinen eigenen Sticker voten', 'error'); return; }
  if (votingState.myVote && String(votingState.myVote) === String(stickerId)) return;

  const month     = getCurrentMonth();
  const prevVote  = votingState.myVote;
  const prevCounts= { ...votingState.voteCounts };

  if (prevVote) votingState.voteCounts[prevVote] = Math.max(0, (votingState.voteCounts[prevVote]||1)-1);
  votingState.voteCounts[stickerId] = (votingState.voteCounts[stickerId]||0)+1;
  votingState.myVote = stickerId;
  renderVotingGallery();

  try {
    const { error } = await db.from('sticker_votes')
      .upsert({ voter_id: currentUser.id, sticker_id: sticker.id, month }, { onConflict:'voter_id,month' });
    if (error) throw error;
    toast(prevVote ? '🔄 Vote geändert' : '✅ Vote abgegeben', 'success');
  } catch (e) {
    votingState.voteCounts = prevCounts;
    votingState.myVote = prevVote;
    renderVotingGallery();
    const msg = e?.message||'';
    if (/self_vote_not_allowed/.test(msg))    toast('Eigener Sticker — kein Vote möglich', 'error');
    else if (/row-level security|policy/i.test(msg)) toast('⚠️ RLS blockiert Voten – Policy in Supabase prüfen', 'error');
    else { logInternal('vote/upsert', e); toast('Vote fehlgeschlagen', 'error'); }
  }
}

function toggleVotingSection() {
  const content  = $id('voting-content');
  const icon     = $id('voting-toggle-icon');
  if (!content) return;
  const collapsed= content.style.display === 'none';
  if (collapsed) {
    content.style.display = '';
    if (icon) icon.style.transform = 'rotate(0deg)';
    try { localStorage.setItem('voting-collapsed','0'); } catch(_){}
  } else {
    content.style.display = 'none';
    if (icon) icon.style.transform = 'rotate(-90deg)';
    try { localStorage.setItem('voting-collapsed','1'); } catch(_){}
  }
}

function applyVotingCollapseState() {
  let collapsed = false;
  try { collapsed = localStorage.getItem('voting-collapsed') === '1'; } catch(_){}
  const content = $id('voting-content');
  const icon    = $id('voting-toggle-icon');
  if (!content) return;
  if (collapsed) { content.style.display='none'; if(icon) icon.style.transform='rotate(-90deg)'; }
  else           { content.style.display='';     if(icon) icon.style.transform='rotate(0deg)';   }
}

function renderVotingGallery() {
  const host = $id('voting-content');
  if (!host) return;

  const pool = (stickers||[]).filter(s => !!(s.photo_url||s.photoData));
  if (!pool.length) {
    host.innerHTML = `<div class="vote-empty">📷 Noch keine Sticker mit Foto.</div>`;
    applyVotingCollapseState();
    return;
  }

  const counts = votingState.voteCounts || {};
  const sorted = pool.slice().sort((a,b) => {
    const ca=counts[a.id]||0, cb=counts[b.id]||0;
    if (cb !== ca) return cb-ca;
    return (b.points||0)-(a.points||0);
  });

  const topCount = counts[sorted[0]?.id]||0;
  const myVote   = votingState.myVote;

  let header = `
    <div class="vote-meta-row">
      <span>📅 <strong>${escHtml(votingState.month||getCurrentMonth())}</strong> · ${pool.length} Sticker</span>
      <span>${myVote ? '✅ Du hast gevotet (änderbar)' : (currentUser ? '🗳️ Wähle deinen Favoriten' : '🔒 Login zum Voten')}</span>
    </div>`;

  if (votingState.lastWinner) {
    const w = votingState.lastWinner;
    header += `
      <div class="vote-winner-card">
        🏆 <strong>Gewinner ${escHtml(w.month)}:</strong>
        ${escHtml(w.winner_username)} mit ${w.votes} Vote${w.votes===1?'':'s'} (+10 Pkt)
      </div>`;
  }

  const cards = sorted.slice(0,60).map(s => {
    const count   = counts[s.id]||0;
    const isMine  = currentUser && s.owner_id === currentUser.id;
    const voted   = String(myVote) === String(s.id);
    const leading = topCount > 0 && count === topCount;
    const owner   = s.owner_id === currentUser?.id
      ? (currentUser.username||'Du')
      : (friendsCache.find(f => f.id===s.owner_id)?.username||'Unbekannt');
    const cls = ['vote-card'];
    if (voted)   cls.push('voted');
    if (isMine)  cls.push('self');
    if (leading) cls.push('leading');

    let btn;
    if (!currentUser)    btn = `<button class="vote-btn ghost" onclick="showAuthOverlay()">Login</button>`;
    else if (isMine)     btn = `<button class="vote-btn ghost" disabled title="Eigener Sticker">Eigener</button>`;
    else if (voted)      btn = `<button class="vote-btn" disabled>✓ Gevotet</button>`;
    else if (myVote)     btn = `<button class="vote-btn ghost" onclick="voteForSticker('${s.id}')" title="Stimme hierhin wechseln">↺ Wechseln</button>`;
    else                 btn = `<button class="vote-btn" onclick="voteForSticker('${s.id}')">+ Vote</button>`;

    const photoSrc = s.photo_url||s.photoData;
    const cc  = (s.country_code||s.cc||'').toUpperCase();
    const pts = s.points||0;

    return `<div class="${cls.join(' ')}">
      <div class="vote-thumb">
        <img src="${escHtml(photoSrc)}" alt="" loading="lazy" onerror="this.style.display='none';this.parentNode.textContent='🌍';">
      </div>
      <div class="vote-info">
        <div class="vote-owner">${escHtml(owner)}${isMine?' (Du)':''}</div>
        <div class="vote-sub">${cc?cc+' · ':''}${pts} Pkt</div>
      </div>
      <div class="vote-bar">
        <span class="vote-count">★ ${count}</span>
        ${btn}
      </div>
    </div>`;
  }).join('');

  host.innerHTML = header + `<div class="vote-grid">${cards}</div>`;
  applyVotingCollapseState();
}

async function refreshVotingData() {
  if (votingState.loading) return;
  votingState.loading = true;
  try {
    await loadMonthlyVotes();
    if ($id('screen-social')?.classList.contains('active')) renderVotingGallery();
  } finally {
    votingState.loading = false;
  }
}
