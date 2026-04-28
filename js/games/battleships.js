// ═══════════════════════════════════════════════
//  BATTLESHIPS — Schiffe versenken (Stub)
//  Implementierung folgt in einem späteren Update
// ═══════════════════════════════════════════════

function renderBattleships(c) {
  const stage = document.getElementById('ch-game-stage');
  if (!stage) return;
  stage.innerHTML = `<div style="text-align:center;color:var(--text2);padding:40px 16px">
    🚢 Schiffe versenken kommt im nächsten Update.<br>
    <span style="font-size:11px">Du kannst die Challenge bereits akzeptieren.</span>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:center">
      <button class="ch-btn" onclick="testFinishWin()">Testweise gewinnen</button>
      <button class="ch-btn ghost" onclick="testFinishTie()">Unentschieden</button>
      <button class="ch-btn danger" onclick="testFinishLose()">Testweise verlieren</button>
    </div>
  </div>`;
}
