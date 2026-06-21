/* js/ai.js — CPU AI Controller */

const AI = (() => {

  // ─── State machine states ────────────────────────────────────────────────
  const STATE = {
    IDLE:    'idle',
    CHASE:   'chase',
    ATTACK:  'attack',
    RETREAT: 'retreat',
    JUMP:    'jump',
    SPECIAL: 'special',
  };

  // ─── Per-game AI instance ────────────────────────────────────────────────
  function create(ball, target) {
    return {
      ball, target,
      state:      STATE.IDLE,
      stateTimer: 0,
      actionTimer: 0,
      thinkInterval: 18,   // frames between decisions
      thinkTimer: 0,
      aggression: 0.65,    // 0–1 how aggressive
      reactionDelay: 8,    // frames before acting on new info
    };
  }

  // ─── Main update (call once per frame) ───────────────────────────────────
  function update(ai, input) {
    const { ball, target } = ai;

    ai.thinkTimer--;
    if (ai.thinkTimer <= 0) {
      ai.thinkTimer = ai.thinkInterval;
      think(ai);
    }

    ai.stateTimer--;
    if (ai.stateTimer <= 0) {
      ai.state = STATE.IDLE;
    }

    // Build input from state
    clearInput(input);
    executeState(ai, input);
  }

  // ─── Decision making ─────────────────────────────────────────────────────
  function think(ai) {
    const { ball, target } = ai;
    const dx = target.x - ball.x;
    const dy = target.y - ball.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const hpRatio = ball.hp / ball.maxHp;

    // Low HP → retreat
    if (hpRatio < 0.2 && Math.random() < 0.6) {
      ai.state = STATE.RETREAT;
      ai.stateTimer = 45;
      return;
    }

    // In range → attack
    if (dist < ball.radius * 3.5 && !target.invincible) {
      // Maybe use special
      if (ball.specialCharge >= 100 && Math.random() < 0.7) {
        ai.state = STATE.SPECIAL;
        ai.stateTimer = 20;
        return;
      }
      // Heavy if close
      if (dist < ball.radius * 2 && Math.random() < 0.4) {
        ai.state = STATE.ATTACK;
        ai.stateTimer = 25;
        ai._heavy = true;
        return;
      }
      ai.state = STATE.ATTACK;
      ai.stateTimer = 20;
      ai._heavy = false;
      return;
    }

    // Target above → jump to follow
    if (target.y < ball.y - 60 && ball.grounded) {
      ai.state = STATE.JUMP;
      ai.stateTimer = 15;
      return;
    }

    // Default → chase
    ai.state = STATE.CHASE;
    ai.stateTimer = 30;
  }

  // ─── State execution ─────────────────────────────────────────────────────
  function executeState(ai, input) {
    const { ball, target } = ai;
    const dx = target.x - ball.x;

    switch (ai.state) {
      case STATE.CHASE:
        input.left  = dx < -8;
        input.right = dx >  8;
        // Jump over obstacles or follow target up
        if (ball.grounded && target.y < ball.y - 50 && Math.random() < .05) {
          input.jump = true;
        }
        break;

      case STATE.ATTACK:
        // Move toward target
        input.left  = dx < -12;
        input.right = dx >  12;
        // Attack within a timing window
        if (Math.abs(dx) < ball.radius * 3) {
          if (ai._heavy) {
            input.heavy = true;
            ai._heavy = false;
          } else {
            input.attack = true;
          }
        }
        break;

      case STATE.RETREAT:
        // Move away
        input.left  = dx > 0;
        input.right = dx < 0;
        if (ball.grounded && Math.random() < .1) input.jump = true;
        input.dash = Math.random() < .08;
        break;

      case STATE.JUMP:
        if (ball.grounded) input.jump = true;
        input.left  = dx < 0;
        input.right = dx > 0;
        break;

      case STATE.SPECIAL:
        input.special = true;
        input.left  = dx < 0;
        input.right = dx > 0;
        break;

      case STATE.IDLE:
        // Small random movement
        if (Math.random() < .02) input.left  = true;
        if (Math.random() < .02) input.right = true;
        break;
    }
  }

  function clearInput(input) {
    input.left   = false;
    input.right  = false;
    input.jump   = false;
    input.dash   = false;
    input.attack = false;
    input.heavy  = false;
    input.special= false;
  }

  return { create, update };
})();
