/* js/arena.js — Arena renderer & layout */

const Arena = (() => {
  let canvas, ctx;
  let W, H;
  let floorY;
  let cameraShake = 0;
  let bgStars = [];
  let frameCount = 0;

  const PLATFORMS = [
    // { xFrac, yFrac, widthFrac }  — fractions of arena size
    { xFrac: 0.18, yFrac: 0.62, widthFrac: 0.16 },
    { xFrac: 0.66, yFrac: 0.62, widthFrac: 0.16 },
    { xFrac: 0.41, yFrac: 0.42, widthFrac: 0.18 },
  ];

  let platforms = []; // pixel coords, rebuilt on resize

  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    buildBgStars();
  }

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    floorY = H - H * 0.18;
    buildPlatforms();
  }

  function buildPlatforms() {
    platforms = PLATFORMS.map(p => ({
      x:     W * p.xFrac,
      y:     H * p.yFrac,
      width: W * p.widthFrac,
      height: 14,
    }));
  }

  function buildBgStars() {
    bgStars = [];
    for (let i = 0; i < 120; i++) {
      bgStars.push({
        x:     Math.random(),
        y:     Math.random() * .75,
        r:     Math.random() * 1.5 + 0.3,
        alpha: Math.random() * .7 + .15,
        twink: Math.random() * Math.PI * 2,
        speed: Math.random() * .02 + .005,
      });
    }
  }

  function getFloorY() { return floorY; }
  function getPlatforms() { return platforms; }
  function getW() { return W; }
  function getH() { return H; }

  function shakeCamera(amount = 8) {
    cameraShake = Math.max(cameraShake, amount);
  }

  function draw(p1, p2) {
    frameCount++;
    if (!ctx) return;

    // Camera shake
    let sx = 0, sy = 0;
    if (cameraShake > 0.5) {
      sx = (Math.random() - .5) * cameraShake;
      sy = (Math.random() - .5) * cameraShake;
      cameraShake *= .82;
    }
    ctx.save();
    ctx.translate(sx, sy);

    // ─ Background ──────────────────────────────────────────────────────────
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#07070f');
    bgGrad.addColorStop(0.6, '#0d0d22');
    bgGrad.addColorStop(1, '#131330');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Stars
    if (Settings.get('effects') !== 'off') {
      bgStars.forEach(s => {
        s.twink += s.speed;
        const a = s.alpha * (0.6 + 0.4 * Math.sin(s.twink));
        ctx.fillStyle = `rgba(200,210,255,${a})`;
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // ─ P1 glow aura ────────────────────────────────────────────────────────
    if (Settings.get('effects') !== 'off') {
      drawAura(p1, '#3b9eff');
      drawAura(p2, '#ff3b5c');
    }

    // ─ Grid overlay ────────────────────────────────────────────────────────
    if (Settings.get('effects') !== 'off') {
      ctx.save();
      ctx.strokeStyle = 'rgba(59,80,200,.06)';
      ctx.lineWidth   = 1;
      const step = 60;
      for (let x = 0; x < W; x += step) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.restore();
    }

    // ─ Floor ───────────────────────────────────────────────────────────────
    drawFloor();

    // ─ Platforms ───────────────────────────────────────────────────────────
    platforms.forEach(p => drawPlatform(p));

    // ─ Health charge bars on ground ────────────────────────────────────────
    drawSpecialBars(p1, p2);

    ctx.restore();
  }

  function drawAura(ball, color) {
    if (!ball.alive) return;
    const phase = frameCount * .04;
    const pulse = 1 + Math.sin(phase) * .12;
    const grad = ctx.createRadialGradient(ball.x, ball.y, ball.radius, ball.x, ball.y, ball.radius * 4 * pulse);
    const alpha = ball.specialCharge / ball.maxSpecialCharge;
    grad.addColorStop(0, color.replace(')', `, ${0.15 * alpha})`).replace('rgb', 'rgba'));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius * 4 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawFloor() {
    // Floor glow
    const glow = ctx.createLinearGradient(0, floorY - 30, 0, floorY + 80);
    glow.addColorStop(0, 'rgba(59,80,200,.15)');
    glow.addColorStop(1, 'rgba(7,7,15,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, floorY - 30, W, 110);

    // Floor surface
    const floorGrad = ctx.createLinearGradient(0, floorY, 0, floorY + 18);
    floorGrad.addColorStop(0, '#2a2a60');
    floorGrad.addColorStop(1, '#1a1a3a');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorY, W, 18);

    // Top edge line
    ctx.strokeStyle = 'rgba(100,120,255,0.6)';
    ctx.lineWidth = 2;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#5060ff';
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(W, floorY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Sub-floor
    ctx.fillStyle = '#0d0d1e';
    ctx.fillRect(0, floorY + 18, W, H - floorY - 18);

    // Lane markers
    ctx.strokeStyle = 'rgba(100,120,255,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(i * W / 5, floorY);
      ctx.lineTo(i * W / 5, floorY + 10);
      ctx.stroke();
    }
  }

  function drawPlatform(p) {
    const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.height);
    grad.addColorStop(0, '#3a3a70');
    grad.addColorStop(1, '#1a1a40');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.width, p.height, 4);
    ctx.fill();

    // Top glow line
    ctx.save();
    ctx.strokeStyle = 'rgba(130,150,255,0.5)';
    ctx.lineWidth = 2;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#8090ff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + p.width, p.y);
    ctx.stroke();
    ctx.restore();
  }

  function drawSpecialBars(p1, p2) {
    // P1 special bar — bottom left area
    drawSpecialBar(40, H - 48, 160, p1, '#f5c842', 'right');
    // P2 special bar — bottom right area
    drawSpecialBar(W - 200, H - 48, 160, p2, '#f5c842', 'left');
  }

  function drawSpecialBar(x, y, w, ball, color, dir) {
    const pct = ball.specialCharge / ball.maxSpecialCharge;
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 8, 4);
    ctx.fill();

    if (pct > 0) {
      const barW = dir === 'left' ? w * pct : w * pct;
      const barX = dir === 'right' ? x : x + w - barW;
      ctx.fillStyle = color;
      ctx.shadowBlur = pct >= 1 ? 12 : 0;
      ctx.shadowColor = color;
      ctx.beginPath();
      ctx.roundRect(barX, y, barW, 8, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.fillStyle = pct >= 1 ? '#f5c842' : 'rgba(255,255,255,.3)';
    ctx.font = '700 9px Inter, sans-serif';
    ctx.textAlign = dir === 'right' ? 'left' : 'right';
    ctx.fillText('SPECIAL', dir === 'right' ? x : x + w, y - 4);
    ctx.textAlign = 'left';
  }

  return {
    init, resize, draw,
    getFloorY, getPlatforms, getW, getH,
    shakeCamera,
  };
})();
