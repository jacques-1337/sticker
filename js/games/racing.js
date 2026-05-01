// ═══════════════════════════════════════════════
//  RACING GAME — Top-Down, Solo, 60s Timer
//  Score = Runden × 10
//  API: RacingGame.start(container, onFinish)
// ═══════════════════════════════════════════════

const RacingGame = (() => {
  // ── Track geometry ────────────────────────────
  const W = 320, H = 280;
  const CX = 160, CY = 135;
  const OR = { x: 138, y: 88 }; // outer ellipse radii
  const IR = { x:  82, y: 50 }; // inner ellipse radii

  // Start/finish line (bottom of track)
  const SL_X = CX, SL_Y1 = CY + IR.y + 2, SL_Y2 = CY + OR.y - 2;

  // ── State ─────────────────────────────────────
  let canvas, ctx, raf, timerInterval;
  let p, keys, laps, timeLeft, bestLaps, running;

  // ── Public API ────────────────────────────────
  function start(container, onFinish) {
    bestLaps = 0;
    _buildUI(container);
    canvas = document.getElementById('rg-canvas');
    ctx    = canvas.getContext('2d');
    _setupControls();
    _reset();
    _loop();

    // countdown timer
    timerInterval = setInterval(() => {
      if (!running) return;
      timeLeft--;
      _updateHUD();
      if (timeLeft <= 0) _endGame(onFinish);
    }, 1000);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    clearInterval(timerInterval);
  }

  // ── Build UI ──────────────────────────────────
  function _buildUI(container) {
    container.innerHTML = `
      <div class="rg-wrap">
        <div class="rg-hud">
          <div class="rg-stat"><div class="rg-val" id="rg-laps">0</div><div class="rg-lbl">Runden</div></div>
          <div class="rg-stat rg-center"><div class="rg-val rg-timer" id="rg-timer">60</div><div class="rg-lbl">Sekunden</div></div>
          <div class="rg-stat"><div class="rg-val" id="rg-best">–</div><div class="rg-lbl">Best</div></div>
        </div>
        <canvas id="rg-canvas" width="${W}" height="${H}" style="display:block;max-width:100%;border-radius:12px;background:#1c2a1c"></canvas>
        <div class="rg-btns">
          <button class="rg-btn" id="rg-left"  ontouchstart="RacingGame._key('left',true)"  ontouchend="RacingGame._key('left',false)"
                                                onmousedown="RacingGame._key('left',true)"   onmouseup="RacingGame._key('left',false)">◄</button>
          <button class="rg-btn rg-gas-btn" id="rg-gas" ontouchstart="RacingGame._key('gas',true)"  ontouchend="RacingGame._key('gas',false)"
                                                         onmousedown="RacingGame._key('gas',true)"   onmouseup="RacingGame._key('gas',false)">▲<br><small>Gas</small></button>
          <button class="rg-btn" id="rg-right" ontouchstart="RacingGame._key('right',true)" ontouchend="RacingGame._key('right',false)"
                                                onmousedown="RacingGame._key('right',true)"  onmouseup="RacingGame._key('right',false)">►</button>
        </div>
        <div id="rg-msg" class="rg-msg" style="display:none"></div>
      </div>`;
  }

  // ── Controls ──────────────────────────────────
  function _setupControls() {
    keys = { left: false, right: false, gas: false };
    document.addEventListener('keydown', _onKey);
    document.addEventListener('keyup',   _onKey);
  }

  function _onKey(e) {
    const down = e.type === 'keydown';
    if (e.key === 'ArrowLeft'  || e.key === 'a') keys.left  = down;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = down;
    if (e.key === 'ArrowUp'    || e.key === 'w') keys.gas   = down;
  }

  function _key(k, v) { keys[k] = v; } // called from HTML buttons

  // ── Game reset ────────────────────────────────
  function _reset() {
    running   = true;
    laps      = 0;
    timeLeft  = 60;

    p = {
      x:     CX + 12,               // start right of finish line
      y:     (SL_Y1 + SL_Y2) / 2,   // center of track width
      angle: -Math.PI / 2,           // heading up (counterclockwise)
      speed: 0,
      maxSpeed:  3.4,
      accel:     0.09,
      friction:  0.96,
      turnRate:  0.045,
      offTrack:  false,
      prevX:     CX + 12,
    };
    _updateHUD();
  }

  // ── Game loop ─────────────────────────────────
  function _loop() {
    if (!running) return;
    _update();
    _draw();
    raf = requestAnimationFrame(_loop);
  }

  function _update() {
    // Steering
    if (keys.left)  p.angle -= p.turnRate * (p.speed / p.maxSpeed + 0.3);
    if (keys.right) p.angle += p.turnRate * (p.speed / p.maxSpeed + 0.3);

    // Throttle
    if (keys.gas) {
      p.speed = Math.min(p.maxSpeed, p.speed + p.accel);
    } else {
      p.speed *= p.friction;
      if (p.speed < 0.05) p.speed = 0;
    }

    // Track boundary check
    const nextX = p.x + Math.cos(p.angle) * p.speed;
    const nextY = p.y + Math.sin(p.angle) * p.speed;

    if (_onTrack(nextX, nextY)) {
      p.prevX = p.x;
      p.x = nextX;
      p.y = nextY;
      p.offTrack = false;
    } else {
      // Bounce: reduce speed, push slightly away from wall
      p.speed *= 0.4;
      p.offTrack = true;
      // Nudge back onto track
      const dx = CX - p.x, dy = CY - p.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const midR = (Math.sqrt(IR.x*IR.x + IR.y*IR.y) + Math.sqrt(OR.x*OR.x + OR.y*OR.y)) / 2;
      if (dist < midR) {
        p.x -= dx/dist * 1.5;
        p.y -= dy/dist * 1.5;
      } else {
        p.x += dx/dist * 1.5;
        p.y += dy/dist * 1.5;
      }
    }

    // Lap detection: cross start/finish line (x = SL_X, going right → left)
    if (p.y >= SL_Y1 && p.y <= SL_Y2) {
      if (p.prevX >= SL_X && p.x < SL_X) {
        laps++;
        if (laps > bestLaps) bestLaps = laps;
        _updateHUD();
        _flashLap();
      }
    }
  }

  function _onTrack(x, y) {
    const outerD = ((x-CX)/OR.x)**2 + ((y-CY)/OR.y)**2;
    const innerD = ((x-CX)/IR.x)**2 + ((y-CY)/IR.y)**2;
    return outerD < 1 && innerD > 1;
  }

  // ── Drawing ───────────────────────────────────
  function _draw() {
    ctx.clearRect(0, 0, W, H);

    // Grass background
    ctx.fillStyle = '#1c2e1c';
    ctx.fillRect(0, 0, W, H);

    // Road (outer ellipse filled)
    ctx.beginPath();
    ctx.ellipse(CX, CY, OR.x, OR.y, 0, 0, Math.PI*2);
    ctx.fillStyle = '#3a3a3a';
    ctx.fill();

    // Infield grass
    ctx.beginPath();
    ctx.ellipse(CX, CY, IR.x, IR.y, 0, 0, Math.PI*2);
    ctx.fillStyle = '#1c2e1c';
    ctx.fill();

    // Track edge lines
    ctx.strokeStyle = '#ffffff22';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(CX, CY, OR.x-1, OR.y-1, 0, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(CX, CY, IR.x+1, IR.y+1, 0, 0, Math.PI*2); ctx.stroke();

    // Center dashed line
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = '#ffffff18';
    ctx.lineWidth = 1;
    const MR = { x: (OR.x+IR.x)/2, y: (OR.y+IR.y)/2 };
    ctx.beginPath(); ctx.ellipse(CX, CY, MR.x, MR.y, 0, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    // Start/finish line
    const lineGrad = ctx.createLinearGradient(SL_X, SL_Y1, SL_X, SL_Y2);
    lineGrad.addColorStop(0,   '#ffffff');
    lineGrad.addColorStop(0.5, '#e8c84a');
    lineGrad.addColorStop(1,   '#ffffff');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(SL_X, SL_Y1);
    ctx.lineTo(SL_X, SL_Y2);
    ctx.stroke();

    // "S/F" label
    ctx.fillStyle = '#e8c84a';
    ctx.font = 'bold 8px Segoe UI, sans-serif';
    ctx.fillText('S/F', SL_X + 4, SL_Y1 + 8);

    // Player car
    _drawCar(p.x, p.y, p.angle, p.offTrack);

    // Speed indicator
    const speedPct = p.speed / p.maxSpeed;
    const barW = 60, barH = 6;
    ctx.fillStyle = '#00000044';
    ctx.fillRect(8, H - 20, barW, barH);
    ctx.fillStyle = speedPct > 0.7 ? '#e84a6a' : speedPct > 0.4 ? '#e8c84a' : '#4ae8a0';
    ctx.fillRect(8, H - 20, barW * speedPct, barH);
    ctx.strokeStyle = '#ffffff22'; ctx.lineWidth = 1;
    ctx.strokeRect(8, H - 20, barW, barH);
    ctx.fillStyle = '#ffffff88';
    ctx.font = '8px Segoe UI, sans-serif';
    ctx.fillText('SPEED', 8, H - 24);
  }

  function _drawCar(x, y, angle, offTrack) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI/2);
    // Car body
    ctx.fillStyle = offTrack ? '#e84a6a' : '#e8c84a';
    ctx.beginPath();
    ctx.roundRect(-5, -8, 10, 16, 2);
    ctx.fill();
    // Windshield
    ctx.fillStyle = offTrack ? '#ff6b8a' : '#fff9c4';
    ctx.fillRect(-3, -7, 6, 5);
    // Direction dot
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, -9, 2, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // ── HUD ───────────────────────────────────────
  function _updateHUD() {
    const l = document.getElementById('rg-laps');
    const t = document.getElementById('rg-timer');
    const b = document.getElementById('rg-best');
    if (l) l.textContent = laps;
    if (t) {
      t.textContent = timeLeft;
      t.style.color = timeLeft <= 10 ? '#e84a6a' : '';
    }
    if (b) b.textContent = bestLaps > 0 ? bestLaps : '–';
  }

  function _flashLap() {
    const el = document.getElementById('rg-laps');
    if (!el) return;
    el.style.transform = 'scale(1.5)';
    el.style.color = '#4ae8a0';
    setTimeout(() => { el.style.transform = ''; el.style.color = ''; }, 400);
  }

  // ── End Game ──────────────────────────────────
  function _endGame(onFinish) {
    running = false;
    clearInterval(timerInterval);
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', _onKey);
    document.removeEventListener('keyup',   _onKey);

    const score = laps * 10;

    const msg = document.getElementById('rg-msg');
    if (msg) {
      msg.style.display = '';
      msg.innerHTML = `
        <div class="rg-result">
          <div style="font-size:32px">🏁</div>
          <div class="rg-result-laps">${laps} Runden</div>
          <div class="rg-result-score">${score} Punkte</div>
          <button class="rg-play-again" onclick="RacingGame._replay()">↻ Nochmal</button>
        </div>`;
    }

    if (typeof onFinish === 'function') onFinish(score);
  }

  function _replay() {
    const msg = document.getElementById('rg-msg');
    if (msg) msg.style.display = 'none';
    _reset();
    _loop();
    timerInterval = setInterval(() => {
      if (!running) return;
      timeLeft--;
      _updateHUD();
      if (timeLeft <= 0) _endGame(null);
    }, 1000);
  }

  return { start, stop, _key, _replay };
})();
