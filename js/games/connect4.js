// ═══════════════════════════════════════════════
//  CONNECT 4 — Spiellogik
//  Benötigt: challenges.js, ui.js, supabaseClient.js
// ═══════════════════════════════════════════════

function renderConnect4(c) {
  const gs = c.game_state || {};
  const board = gs.board || Array(6).fill(null).map(() => Array(7).fill(null));
  const amChallenger = c.challenger_id === currentUser.id;
  const myPiece  = amChallenger ? 0 : 1;
  const myTurn   = gs.turn === currentUser.id;
  const finished = !!gs.winner;

  let statusText;
  if (gs.winner === 'tie')               statusText = '🤝 Unentschieden!';
  else if (gs.winner === currentUser.id) statusText = '🏆 Du hast gewonnen!';
  else if (gs.winner)                    statusText = '💔 Du hast verloren';
  else if (myTurn)                       statusText = myPiece === 0 ? '🔴 Du bist dran' : '🟡 Du bist dran';
  else                                   statusText = `⏳ ${escHtml(c._other_username)} ist dran…`;

  const winSet = new Set((gs.winCells || []).map(([r, col2]) => `${r},${col2}`));

  let boardHtml = '<div class="c4-board">';
  for (let col = 0; col < 7; col++) {
    const off     = (!myTurn || finished) ? 'c4-off' : '';
    const onclick = (!myTurn || finished) ? '' : `onclick="dropChip(${col})"`;
    boardHtml += `<div class="c4-col ${off}" ${onclick}>`;
    for (let row = 0; row < 6; row++) {
      const v   = board[row][col];
      const cls = v === null ? '' : (v === 0 ? 'red' : 'yellow');
      const win = winSet.has(`${row},${col}`) ? ' win' : '';
      boardHtml += `<div class="c4-cell ${cls}${win}"></div>`;
    }
    boardHtml += '</div>';
  }
  boardHtml += '</div>';

  // setHTML erwartet eine ID, aber ch-game-stage ist ein Element → innerHTML direkt
  const stage = $id('ch-game-stage');
  if (stage) stage.innerHTML = `
    <div class="c4-wrap">
      <div class="c4-status">${statusText}</div>
      <div class="c4-legend">Du spielst als ${myPiece === 0 ? '🔴 Rot' : '🟡 Gelb'}</div>
      ${boardHtml}
      ${finished ? '<button class="ch-btn" style="margin-top:8px" onclick="closeGameOverlay()">Schließen</button>' : ''}
    </div>`;
}

async function dropChip(col) {
  if (!activeChallenge || !currentUser) return;
  const c  = activeChallenge;
  const gs = c.game_state || {};
  if (gs.turn !== currentUser.id || gs.winner) return;

  const board = gs.board.map(r => [...r]);
  const amChallenger = c.challenger_id === currentUser.id;
  const myPiece = amChallenger ? 0 : 1;

  let dropRow = -1;
  for (let row = 5; row >= 0; row--) {
    if (board[row][col] === null) { dropRow = row; break; }
  }
  if (dropRow === -1) return;

  board[dropRow][col] = myPiece;

  const winCells = checkC4Win(board, dropRow, col, myPiece);
  const won = winCells.length >= 4;
  const tie = !won && board[0].every(v => v !== null);

  const newGs = {
    board,
    turn:   (won || tie) ? null : (amChallenger ? c.opponent_id : c.challenger_id),
    winner: won ? currentUser.id : (tie ? 'tie' : null),
    ...(won ? { winCells } : {})
  };

  const prevChallenge = activeChallenge;
  activeChallenge = { ...c, game_state: newGs, updated_at: new Date().toISOString() };
  renderConnect4(activeChallenge);

  try {
    const { error } = await db.from('challenges')
      .update({ game_state: newGs, updated_at: new Date().toISOString() })
      .eq('id', c.id)
      .eq('updated_at', c.updated_at);
    if (error) throw error;

    if (won) {
      await finishChallenge(c.id, currentUser.id);
      toast(`🏆 +${c.points_stake} Pkt!`, 'success');
      await loadChallenges(); renderChallenges();
    } else if (tie) {
      await finishChallenge(c.id, null);
      toast('🤝 Unentschieden', 'info');
      await loadChallenges(); renderChallenges();
    }
  } catch (e) {
    logInternal('c4/drop', e);
    activeChallenge = prevChallenge;
    renderConnect4(prevChallenge);
    toast('Zug fehlgeschlagen – bitte erneut versuchen', 'error');
  }
}

function checkC4Win(board, row, col, piece) {
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (const [dr, dc] of dirs) {
    const cells = [[row, col]];
    for (let i = 1; i < 4; i++) {
      const r = row + dr*i, c = col + dc*i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== piece) break;
      cells.push([r, c]);
    }
    for (let i = 1; i < 4; i++) {
      const r = row - dr*i, c = col - dc*i;
      if (r < 0 || r >= 6 || c < 0 || c >= 7 || board[r][c] !== piece) break;
      cells.push([r, c]);
    }
    if (cells.length >= 4) return cells;
  }
  return [];
}
