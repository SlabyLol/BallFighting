/* js/ball.js — Ball fighter entity */

class Ball {
  constructor(config) {
    this.id     = config.id;        // 'p1' | 'p2'
    this.color  = config.color;     // hex
    this.glow   = config.glow;      // hex with alpha
    this.x      = config.x;
    this.y      = config.y;
    this.radius = config.radius || 28;

    // Physics
    this.vx = 0; this.vy = 0;
    this.grounded = false;

    // Combat
    this.maxHp = 100;
    this.hp    = 100;
    this.alive = true;

    // Movement constants
    this.moveSpeed  = 4.2;
    this.jumpForce  = 13;
    this.dashForce  = 10;

    // Cooldowns (in frames)
    this.attackCooldown  = 0;
    this.heavyCooldown   = 0;
    this.specialCooldown = 0;
    this.dashCooldown    = 0;
    this.invincTimer     = 0;

    // State
    this.attacking   = false;
    this.attackTimer = 0;
    this.attackType  = null; // 'light' | 'heavy' | 'special'
    this.hitbox      = null;
    this.dashing     = false;
    this.dashTimer   = 0;
    this.facing      = this.id === 'p1' ? 1 : -1;

    // Special
    this.specialCharge = 0;
    this.maxSpecialCharge = 100;

    // Visuals
    this.squishX  = 1;
    this.squishY  = 1;
    this.trail    = [];
    this.shakeX   = 0;
    this.shakeY   = 0;
    this.shakeTimer = 0;

    // Stats
    this.stats = { hits: 0, blocks: 0, specials: 0, totalDamage: 0 };
  }

  get invincible() { return this.invincTimer > 0; }

  // ─── Move ──────────────────────────────────────────────────────────────
  move(input) {
    if (!this.alive) return;

    // Dash
    if (input.dash && this.dashCooldown <= 0 && !this.dashing) {
      this.dashing   = true;
      this.dashTimer = 12;
      this.dashCooldown = 40;
      const dir = input.left ? -1 : input.right ? 1 : this.facing;
      this.vx = dir * this.dashForce;
      this.invincTimer = 10;
    }

    if (this.dashTimer > 0) { this.dashTimer--; this.dashing = this.dashTimer > 0; }

    // Normal movement (no control override during dash)
    if (!this.dashing) {
      if (input.left)  { this.vx -= this.moveSpeed * 0.6; this.facing = -1; }
      if (input.right) { this.vx += this.moveSpeed * 0.6; this.facing =  1; }
      this.vx = Math.max(-this.moveSpeed * 1.8, Math.min(this.moveSpeed * 1.8, this.vx));
    }

    // Jump
    if (input.jump && this.grounded) {
      this.vy = -this.jumpForce;
      this.grounded = false;
      this.squishY = 0.6; this.squishX = 1.4;
    }

    // ─ Attack inputs ─────────────────────────────────────────────────────
    if (input.attack && this.attackCooldown <= 0 && !this.attacking) {
      this.startAttack('light');
    }
    if (input.heavy && this.heavyCooldown <= 0 && !this.attacking) {
      this.startAttack('heavy');
    }
    if (input.special && this.specialCharge >= this.maxSpecialCharge && this.specialCooldown <= 0 && !this.attacking) {
      this.startAttack('special');
      this.specialCharge = 0;
      this.stats.specials++;
    }

    // ─ Tick cooldowns ────────────────────────────────────────────────────
    if (this.attackCooldown > 0)  this.attackCooldown--;
    if (this.heavyCooldown  > 0)  this.heavyCooldown--;
    if (this.specialCooldown > 0) this.specialCooldown--;
    if (this.dashCooldown   > 0)  this.dashCooldown--;
    if (this.invincTimer    > 0)  this.invincTimer--;

    // Charge special passively
    if (this.specialCharge < this.maxSpecialCharge) {
      this.specialCharge = Math.min(this.maxSpecialCharge, this.specialCharge + 0.18);
    }
  }

  startAttack(type) {
    this.attacking   = true;
    this.attackType  = type;
    this.attackTimer = type === 'heavy' ? 20 : type === 'special' ? 28 : 14;

    const configs = {
      light:   { offset: 1.6, arc: 0.6, dmg: 8,  force: 5,  up: 4,  r: 1.2, cd: 20 },
      heavy:   { offset: 1.4, arc: 0.9, dmg: 18, force: 9,  up: 6,  r: 1.6, cd: 40 },
      special: { offset: 2.2, arc: 1.2, dmg: 28, force: 14, up: 8,  r: 2.4, cd: 60 },
    };
    const c = configs[type];
    this.hitbox = {
      type,
      x:      this.x + this.facing * this.radius * c.offset,
      y:      this.y,
      radius: this.radius * c.r,
      damage: c.dmg,
      force:  c.force,
      upForce:c.up,
      active: true,
    };
    this.attackCooldown  = type === 'light'  ? c.cd : this.attackCooldown;
    this.heavyCooldown   = type === 'heavy'  ? c.cd : this.heavyCooldown;
    this.specialCooldown = type === 'special'? c.cd : this.specialCooldown;
  }

  tickAttack() {
    if (!this.attacking) return;
    this.attackTimer--;
    if (this.attackTimer <= 0) {
      this.attacking  = false;
      this.attackType = null;
      this.hitbox     = null;
    } else if (this.hitbox) {
      // Track hitbox to ball
      this.hitbox.x = this.x + this.facing * this.radius * 1.6;
      this.hitbox.y = this.y;
    }
  }

  // ─── Take Damage ───────────────────────────────────────────────────────
  takeDamage(amount, attacker) {
    if (this.invincible) return 0;
    this.hp = Math.max(0, this.hp - amount);
    this.stats.totalDamage += amount;
    if (attacker) attacker.stats.hits++;

    // Invincibility frames
    this.invincTimer = 18;

    // Screen shake visual
    this.shakeTimer = 10;
    this.shakeX = (Math.random() - .5) * 10;
    this.shakeY = (Math.random() - .5) * 10;

    // Squish
    this.squishX = 1.5; this.squishY = 0.6;

    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
    return amount;
  }

  // ─── Update squish/shake ──────────────────────────────────────────────
  tickVisuals() {
    // Lerp squish back to 1
    this.squishX += (1 - this.squishX) * .22;
    this.squishY += (1 - this.squishY) * .22;

    // Shake decay
    if (this.shakeTimer > 0) {
      this.shakeTimer--;
      this.shakeX *= .7;
      this.shakeY *= .7;
    } else {
      this.shakeX = 0; this.shakeY = 0;
    }

    // Trail
    this.trail.unshift({ x: this.x, y: this.y, r: this.radius });
    if (this.trail.length > 8) this.trail.pop();
  }

  // ─── Draw ──────────────────────────────────────────────────────────────
  draw(ctx) {
    if (!this.alive) return;

    const cx = this.x + this.shakeX;
    const cy = this.y + this.shakeY;

    // ─ Trail ─────────────────────────────────────────────────────────────
    if (Settings.get('effects') !== 'off') {
      this.trail.forEach((t, i) => {
        const a = (1 - (i + 1) / this.trail.length) * 0.25;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle   = this.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    // ─ Glow ──────────────────────────────────────────────────────────────
    if (Settings.get('effects') !== 'off') {
      ctx.save();
      ctx.shadowBlur  = this.attacking ? 40 : 20;
      ctx.shadowColor = this.color;
      ctx.globalAlpha = this.invincible ? 0.5 + Math.sin(Date.now() / 60) * 0.5 : 1;

      // Draw ball body
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(this.squishX, this.squishY);
      const grad = ctx.createRadialGradient(-this.radius * .3, -this.radius * .3, 2, 0, 0, this.radius);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.3, this.color);
      grad.addColorStop(1, this.darkenColor(this.color, 0.4));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(this.squishX, this.squishY);
      ctx.globalAlpha = this.invincible ? 0.5 + Math.sin(Date.now() / 60) * 0.5 : 1;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ─ Special charge ring ───────────────────────────────────────────────
    if (this.specialCharge >= this.maxSpecialCharge) {
      ctx.save();
      ctx.strokeStyle = '#f5c842';
      ctx.lineWidth   = 3;
      ctx.shadowBlur  = 15;
      ctx.shadowColor = '#f5c842';
      ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 200) * 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, this.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // ─ Attack hitbox arc ─────────────────────────────────────────────────
    if (this.hitbox && this.attacking && Settings.get('effects') !== 'off') {
      const hbColors = { light: 'rgba(255,255,100,0.35)', heavy: 'rgba(255,140,40,0.45)', special: 'rgba(255,80,255,0.5)' };
      ctx.save();
      ctx.fillStyle   = hbColors[this.attackType] || 'rgba(255,255,255,0.3)';
      ctx.shadowBlur  = 20;
      ctx.shadowColor = this.color;
      ctx.beginPath();
      ctx.arc(this.hitbox.x, this.hitbox.y, this.hitbox.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  darkenColor(hex, factor) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgb(${Math.round(r*factor)},${Math.round(g*factor)},${Math.round(b*factor)})`;
  }

  reset(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hp = this.maxHp;
    this.alive = true;
    this.attacking = false; this.hitbox = null;
    this.attackCooldown = 0; this.heavyCooldown = 0;
    this.specialCooldown = 0; this.dashCooldown = 0;
    this.invincTimer = 60; // brief invincibility at round start
    this.specialCharge = 0;
    this.squishX = 1; this.squishY = 1;
    this.shakeX = 0; this.shakeY = 0; this.shakeTimer = 0;
    this.trail = [];
    this.dashing = false; this.dashTimer = 0;
  }
}
