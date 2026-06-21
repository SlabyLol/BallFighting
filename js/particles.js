/* js/particles.js — Particle systems */

const Particles = (() => {
  // ── Menu Background Particles ──────────────────────────────────────────────
  let menuCanvas, menuCtx, menuParticles = [], menuRaf;

  const COLORS = ['#3b9eff', '#ff3b5c', '#f5c842', '#a0f0ff', '#ff8ab4'];

  function initMenu() {
    menuCanvas = document.getElementById('menu-particles');
    if (!menuCanvas) return;
    menuCtx = menuCanvas.getContext('2d');
    resizeMenu();
    window.addEventListener('resize', resizeMenu);
    spawnMenuParticles(60);
    animateMenu();
  }

  function resizeMenu() {
    if (!menuCanvas) return;
    menuCanvas.width  = window.innerWidth;
    menuCanvas.height = window.innerHeight;
  }

  function spawnMenuParticles(n) {
    for (let i = 0; i < n; i++) {
      menuParticles.push(createMenuParticle());
    }
  }

  function createMenuParticle() {
    return {
      x:    Math.random() * (menuCanvas ? menuCanvas.width : 800),
      y:    Math.random() * (menuCanvas ? menuCanvas.height : 600),
      vx:   (Math.random() - .5) * .6,
      vy:   (Math.random() - .5) * .6,
      r:    Math.random() * 3 + 1,
      col:  COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * .4 + .1,
      life: Math.random() * 300 + 100,
      age:  0,
    };
  }

  function animateMenu() {
    if (!menuCtx) return;
    menuCtx.clearRect(0, 0, menuCanvas.width, menuCanvas.height);

    menuParticles = menuParticles.filter(p => {
      p.x += p.vx; p.y += p.vy; p.age++;
      const t = p.age / p.life;
      const a = p.alpha * (1 - t * t);
      menuCtx.beginPath();
      menuCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      menuCtx.fillStyle = p.col;
      menuCtx.globalAlpha = a;
      menuCtx.fill();
      menuCtx.globalAlpha = 1;
      return p.age < p.life;
    });

    // Replenish
    while (menuParticles.length < 70) menuParticles.push(createMenuParticle());

    menuRaf = requestAnimationFrame(animateMenu);
  }

  function destroyMenu() {
    cancelAnimationFrame(menuRaf);
    menuParticles = [];
    window.removeEventListener('resize', resizeMenu);
  }

  // ── In-Game Particle Emitter ───────────────────────────────────────────────
  let gameParticles = [];

  function emit(x, y, color, count = 12, speed = 5, sizeMax = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd   = Math.random() * speed + 1;
      gameParticles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        r:  Math.random() * sizeMax + 2,
        col: color,
        alpha: 1,
        decay: Math.random() * .03 + .02,
        gravity: .15,
      });
    }
  }

  function emitSpark(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      gameParticles.push({
        x, y,
        vx: Math.cos(angle) * (Math.random() * 8 + 2),
        vy: Math.sin(angle) * (Math.random() * 8 + 2),
        r:  Math.random() * 2 + 1,
        col: '#ffffff',
        alpha: 1,
        decay: .05,
        gravity: .2,
        spark: true,
      });
    }
  }

  function emitTrail(x, y, color) {
    gameParticles.push({
      x, y,
      vx: (Math.random() - .5) * 1.5,
      vy: (Math.random() - .5) * 1.5,
      r:  Math.random() * 4 + 2,
      col: color,
      alpha: .7,
      decay: .04,
      gravity: .05,
    });
  }

  function emitSpecial(x, y, color) {
    // Ring burst
    const N = 24;
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      gameParticles.push({
        x, y,
        vx: Math.cos(angle) * 10,
        vy: Math.sin(angle) * 10,
        r: 5,
        col: color,
        alpha: 1,
        decay: .025,
        gravity: 0,
      });
    }
    // Center blast
    emit(x, y, color, 20, 8, 10);
    emitSpark(x, y, '#fff', 20);
  }

  function update(ctx) {
    gameParticles = gameParticles.filter(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += p.gravity || 0;
      p.vx *= .97;
      p.alpha -= p.decay;

      if (p.alpha <= 0) return false;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      if (p.spark) {
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return true;
    });
  }

  function clear() { gameParticles = []; }

  return { initMenu, destroyMenu, emit, emitSpark, emitTrail, emitSpecial, update, clear };
})();
