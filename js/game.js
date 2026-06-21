/* js/game.js — Core game loop */

const Game = (() => {
  let p1, p2;
  let aiController = null;
  let mode = 'pvp'; // 'pvp' | 'pve'

  // ─ Input state ─────────────────────────────────────────────────────────────
  const keys   = {};
  let p1Input  = {};
  let p2Input  = {};

  // ─ Round/match state ───────────────────────────────────────────────────────
  let roundTimer   = 60;
  let timerTick    = 0;
  let gameRunning  = false;
  let roundRunning = false;
  let paused       = false;
  let roundsWon    = { p1: 0, p2: 0 };
  let currentRound = 1;
  let maxRounds    = 2; // rounds needed to win

  let raf;
  let onRoundEnd;  // callback(winner: 'p1'|'p2'|'draw')
  let onMatchEnd;  // callback(winner: 'p1'|'p2')

  // ─── Init ────────────────────────────────────────────────────────────────
  function init(canvasEl) {
    Arena.init(canvasEl);
    window.addEventListener('resize', Arena.resize);
    window.addEventListener('keydown', e => {
      keys[e.code] = true;
      e.preventDefault();
    });
    window.addEventListener('keyup',  e => {
      keys[e.code] = false;
    });
  }

  // ─── Start match ─────────────────────────────────────────────────────────
  function startMatch(gameMode, callbacks = {}) {
    mode = gameMode;
    onRoundEnd = callbacks.onRoundEnd;
    onMatchEnd = callbacks.onMatchEnd;
    maxRounds  = Settings.get('roundsToWin');
    roundsWon  = { p1: 0, p2: 0 };
    currentRound = 1;

    createBalls();
    if (mode === 'pve') {
      aiController = AI.create(p2, p1);
    } else {
      aiController = null;
    }

    startRound();
    gameRunning = true;
    cancelAnimationFrame(raf);
    loop();
  }

  function createBalls() {
    const r = Settings.getBallRadius();
    const floorY = Arena.getFloorY();
    const W = Arena.getW();

    p1 = new Ball({ id: 'p1', color: '#3b9eff', glow: '#3b9eff55', x: W * 0.28, y: floorY - r, radius: r });
    p2 = new Ball({ id: 'p2', color: '#ff3b5c', glow: '#ff3b5c55', x: W * 0.72, y: floorY - r, radius: r });
  }

  function startRound() {
    roundTimer  = Settings.get('roundTime');
    timerTick   = 0;
    roundRunning = false;
    paused       = false;
    Particles.clear();

    const r = Settings.getBallRadius();
    const W = Arena.getW();
    const floorY = Arena.getFloorY();

    p1.reset(W * 0.28, floorY - r);
    p2.reset(W * 0.72, floorY - r);

    p1.facing = 1; p2.facing = -1;

    updateHUD();
    showBanner('ROUND ' + currentRound, 1400, () => {
      showBanner('FIGHT!', 1000, () => { roundRunning = true; });
    });
  }

  // ─── Main loop ───────────────────────────────────────────────────────────
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!gameRunning) return;
    if (paused) return;

    readInput();
    if (roundRunning) updateGame();
    render();
  }

  function readInput() {
    p1Input = {
      left:   keys['KeyA'],
      right:  keys['KeyD'],
      jump:   keys['KeyW'],
      dash:   keys['ShiftLeft'] || keys['ShiftRight'],
      attack: keys['KeyF'],
      heavy:  keys['KeyG'],
      special:keys['KeyR'],
    };
    if (mode === 'pvp') {
      p2Input = {
        left:   keys['ArrowLeft'],
        right:  keys['ArrowRight'],
        jump:   keys['ArrowUp'],
        dash:   keys['ControlLeft'] || keys['ControlRight'],
        attack: keys['KeyL'],
        heavy:  keys['Semicolon'],
        special:keys['KeyO'],
      };
    } else {
      // AI controls p2
      AI.update(aiController, p2Input);
    }
  }

  function updateGame() {
    // Physics
    [p1, p2].forEach(b => {
      Physics.applyGravity(b);
      b.move(b === p1 ? p1Input : p2Input);
      Physics.resolveWalls(b, Arena.getW());
      Physics.resolveFloor(b, Arena.getFloorY());
      resolvePlatforms(b);
      b.tickAttack();
      b.tickVisuals();
    });

    // Ball-ball physics collision
    Physics.resolveBallCollision(p1, p2);

    // Hitbox → target collision
    checkHit(p1, p2);
    checkHit(p2, p1);

    // Particle trails (dashing)
    if (Settings.get('effects') !== 'off') {
      if (p1.dashing) Particles.emitTrail(p1.x, p1.y, p1.color);
      if (p2.dashing) Particles.emitTrail(p2.x, p2.y, p2.color);
    }

    // Timer
    timerTick++;
    if (timerTick >= 60) {
      timerTick = 0;
      roundTimer--;
      updateTimer(roundTimer);
    }

    updateHUD();

    // Check round end
    if (!p1.alive || !p2.alive || roundTimer <= 0) {
      endRound();
    }
  }

  function checkHit(attacker, target) {
    if (!attacker.hitbox || !attacker.hitbox.active) return;
    if (!target.alive || target.invincible) return;

    const hb = attacker.hitbox;
    const dx = target.x - hb.x;
    const dy = target.y - hb.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < hb.radius + target.radius) {
      const dmg = target.takeDamage(hb.damage, attacker);
      Physics.applyKnockback(target, attacker, hb.force, hb.upForce);

      // Particles
      if (Settings.get('effects') !== 'off') {
        if (hb.type === 'special') {
          Particles.emitSpecial(target.x, target.y, attacker.color);
          Arena.shakeCamera(12);
        } else if (hb.type === 'heavy') {
          Particles.emit(target.x, target.y, attacker.color, 16, 7, 8);
          Particles.emitSpark(target.x, target.y, '#fff', 10);
          Arena.shakeCamera(6);
        } else {
          Particles.emit(target.x, target.y, attacker.color, 8, 5, 5);
          Particles.emitSpark(target.x, target.y, '#fff', 4);
          Arena.shakeCamera(3);
        }
      }

      // Disable hitbox after one hit
      attacker.hitbox.active = false;
    }
  }

  function resolvePlatforms(ball) {
    const platforms = Arena.getPlatforms();
    ball._onPlatform = false;
    for (const p of platforms) {
      // Only land on top if falling downward
      if (
        ball.vy >= 0 &&
        ball.y + ball.radius >= p.y &&
        ball.y + ball.radius <= p.y + p.height + 8 &&
        ball.x > p.x &&
        ball.x < p.x + p.width
      ) {
        ball.y = p.y - ball.radius;
        ball.vy = 0;
        ball.grounded = true;
        ball._onPlatform = true;
      }
    }
  }

  function endRound() {
    roundRunning = false;
    let winner;

    if (!p1.alive && !p2.alive) {
      winner = 'draw';
    } else if (!p1.alive) {
      winner = 'p2'; roundsWon.p2++;
    } else if (!p2.alive) {
      winner = 'p1'; roundsWon.p1++;
    } else {
      // Timer ran out — compare HP
      if (p1.hp > p2.hp)      { winner = 'p1'; roundsWon.p1++; }
      else if (p2.hp > p1.hp) { winner = 'p2'; roundsWon.p2++; }
      else                      { winner = 'draw'; }
    }

    if (onRoundEnd) onRoundEnd(winner, roundsWon, currentRound);
  }

  function nextRound() {
    currentRound++;
    // Check if match is over
    if (roundsWon.p1 >= maxRounds || roundsWon.p2 >= maxRounds) {
      if (onMatchEnd) onMatchEnd(roundsWon.p1 >= maxRounds ? 'p1' : 'p2');
      return;
    }
    startRound();
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  function render() {
    const canvas = document.getElementById('game-canvas');
    const ctx    = canvas.getContext('2d');
    Arena.draw(p1, p2);

    // Draw balls
    if (p2) p2.draw(ctx);
    if (p1) p1.draw(ctx);

    // Draw particles
    if (Settings.get('effects') !== 'off') {
      Particles.update(ctx);
    }
  }

  // ─── HUD updates ─────────────────────────────────────────────────────────
  function updateHUD() {
    if (!p1 || !p2) return;
    setHpBar('p1', p1.hp, p1.maxHp);
    setHpBar('p2', p2.hp, p2.maxHp);
  }

  function setHpBar(id, hp, max) {
    const pct = Math.max(0, hp / max * 100);
    const bar = document.getElementById(`hp-bar-${id}`);
    const txt = document.getElementById(`hp-text-${id}`);
    if (bar) bar.style.width = pct + '%';
    if (txt) txt.textContent = Math.ceil(hp);

    // Color shift at low HP
    if (bar) {
      if (pct < 25)      bar.style.background = '#ff3b3b';
      else if (pct < 50) bar.style.background = '#f5c842';
      else               bar.style.background = id === 'p1' ? '#3b9eff' : '#ff3b5c';
    }
  }

  function updateTimer(val) {
    const el = document.getElementById('timer-display');
    if (el) {
      el.textContent = val;
      el.classList.toggle('urgent', val <= 10);
    }
  }

  // ─── Banner ──────────────────────────────────────────────────────────────
  function showBanner(text, duration, cb) {
    const banner = document.getElementById('round-banner');
    const bannerText = document.getElementById('banner-text');
    if (!banner || !bannerText) return;
    bannerText.textContent = text;
    banner.classList.remove('hidden');
    setTimeout(() => {
      banner.classList.add('hidden');
      if (cb) cb();
    }, duration);
  }

  function setRoundDisplay(text) {
    const el = document.getElementById('round-display');
    if (el) el.textContent = text;
  }

  // ─── Pause ───────────────────────────────────────────────────────────────
  function setPaused(state) {
    paused = state;
  }

  function stop() {
    gameRunning = false;
    cancelAnimationFrame(raf);
    Particles.clear();
  }

  function getStats() {
    return { p1: p1 ? { ...p1.stats } : {}, p2: p2 ? { ...p2.stats } : {} };
  }

  function getRoundsWon() { return { ...roundsWon }; }

  return {
    init, startMatch, nextRound,
    setPaused, stop,
    getStats, getRoundsWon,
    setRoundDisplay,
  };
})();
