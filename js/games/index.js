// ═══════════════════════════════════════════════
//  GAMES — Zentrale Registry
//  Neues Spiel: Eintrag hier + eigene Datei in games/
// ═══════════════════════════════════════════════

const GAMES = {
  connect4: {
    key:      'connect4',
    name:     '4 gewinnt',
    icon:     '🔴',
    kind:     'turn',   // 'turn' = abwechselnd, 'solo' = jeder spielt selbst
    minStake: 0, maxStake: 9999, enabled: true
  },
  racing: {
    key:      'racing',
    name:     'Racing',
    icon:     '🏎',
    kind:     'solo',   // Solo-Score, beide spielen nacheinander
    minStake: 0, maxStake: 9999, enabled: true
  },
  battleship: {
    key:      'battleship',
    name:     'Schiffe versenken',
    icon:     '🚢',
    kind:     'turn',
    minStake: 0, maxStake: 9999, enabled: false // noch nicht fertig
  },
  flappy: {
    key:      'flappy',
    name:     'Flappy Bird',
    icon:     '🐤',
    kind:     'solo',
    minStake: 0, maxStake: 9999, enabled: false
  },
  tetris: {
    key:      'tetris',
    name:     'Tetris',
    icon:     '🧱',
    kind:     'solo',
    minStake: 0, maxStake: 9999, enabled: false
  }
};

// ── Challenge-Modal: Spiele dynamisch aus Registry rendern ────────────────────
function renderGameGrid() {
  const grid = document.getElementById('ch-game-grid');
  if (!grid) return;
  grid.innerHTML = Object.values(GAMES)
    .filter(g => g.enabled)
    .map(g => `
      <div class="ch-game${g.key === 'connect4' ? ' selected' : ''}" data-game="${g.key}">
        <div class="ch-game-icon">${g.icon}</div>
        <div class="ch-game-name">${g.name}</div>
      </div>`)
    .join('');
}

// Game-Tile Click (delegiert vom document)
document.addEventListener('click', (e) => {
  const tile = e.target.closest('#ch-game-grid .ch-game');
  if (!tile) return;
  document.querySelectorAll('#ch-game-grid .ch-game').forEach(el => el.classList.remove('selected'));
  tile.classList.add('selected');
});
