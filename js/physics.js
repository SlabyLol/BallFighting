/* js/physics.js — Physics & Collision */

const Physics = (() => {
  const GRAVITY   = 0.55;
  const FRICTION  = 0.82;   // ground x-friction
  const AIR_RES   = 0.992;  // air resistance
  const BOUNCE    = 0.28;   // floor restitution
  const MAX_VY    = 22;

  function applyGravity(ball) {
    if (!ball.grounded) {
      ball.vy += GRAVITY;
      if (ball.vy > MAX_VY) ball.vy = MAX_VY;
    }
    ball.vx *= ball.grounded ? FRICTION : AIR_RES;
  }

  function resolveFloor(ball, floorY) {
    if (ball.y + ball.radius >= floorY) {
      ball.y = floorY - ball.radius;
      if (Math.abs(ball.vy) > 1.5) {
        ball.vy = -ball.vy * BOUNCE;
      } else {
        ball.vy = 0;
      }
      ball.grounded = true;
    } else {
      ball.grounded = false;
    }
  }

  function resolveWalls(ball, arenaW) {
    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx) * 0.5;
    }
    if (ball.x + ball.radius > arenaW) {
      ball.x = arenaW - ball.radius;
      ball.vx = -Math.abs(ball.vx) * 0.5;
    }
  }

  // Returns true if two balls are overlapping
  function ballsOverlap(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < (a.radius + b.radius);
  }

  // Elastic collision + separation
  function resolveBallCollision(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const minDist = a.radius + b.radius;

    if (dist >= minDist) return false;

    // Separate
    const overlap = (minDist - dist) / 2;
    const nx = dx / dist;
    const ny = dy / dist;
    a.x -= nx * overlap;
    a.y -= ny * overlap;
    b.x += nx * overlap;
    b.y += ny * overlap;

    // Relative velocity along normal
    const dvx = b.vx - a.vx;
    const dvy = b.vy - a.vy;
    const dot  = dvx * nx + dvy * ny;

    if (dot > 0) return false; // already separating

    const restitution = 0.5;
    const impulse = -(1 + restitution) * dot / 2;

    a.vx -= impulse * nx;
    a.vy -= impulse * ny;
    b.vx += impulse * nx;
    b.vy += impulse * ny;

    return true;
  }

  // Knockback from an attack
  function applyKnockback(target, attacker, force, upForce = 4) {
    const dir = target.x > attacker.x ? 1 : -1;
    target.vx = dir * force;
    target.vy = -upForce;
    target.grounded = false;
  }

  // Knockback in a custom direction
  function applyDirectionalKnockback(target, angle, force) {
    target.vx = Math.cos(angle) * force;
    target.vy = Math.sin(angle) * force;
    target.grounded = false;
  }

  return {
    applyGravity,
    resolveFloor,
    resolveWalls,
    ballsOverlap,
    resolveBallCollision,
    applyKnockback,
    applyDirectionalKnockback,
    GRAVITY,
  };
})();
