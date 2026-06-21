/* js/app.js — Application controller & screen router */

const App = (() => {
  let currentScreen = 'screen-menu';
  let lastMode = 'pvp';
  let gameInited = false;

  // ─── Boot ──────────────────────────────────────────────────────────────────
  function boot() {
    Settings.load();
    Settings.bindUI();
    Particles.initMenu();
    showScreen('screen-menu');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    const canvas = document.getElementById('game-canvas');
    if (canvas) {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      if (gameInited) Arena.resize();
    }
  }

  // ─── Screen routing ────────────────────────────────────────────────────────
  function showScreen(id) {
    // Deactivate all
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Activate target
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    currentScreen = id;

    if (id === 'screen-menu') Particles.initMenu();
    else Particles.destroyMenu();
  }

  // ─── Game flow ────────────────────────────────────────────────────────────
  function startGame(mode) {
    lastMode = mode;
    showScreen('screen-game');

    if (!gameInited) {
      const canvas = document.getElementById('game-canvas');
      Game.init(canvas);
      gameInited = true;
    }

    document.getElementById('round-display').textContent = 'ROUND 1';
    document.getElementById('timer-display').textContent = Settings.get('roundTime');

    Game.startMatch(mode, {
      onRoundEnd: handleRoundEnd,
      onMatchEnd: handleMatchEnd,
    });
  }

  function handleRoundEnd(winner, roundsWon, roundNum) {
    const screen = document.getElementById('screen-roundend');
    const resultText = document.getElementById('round-result-text');
    const scoreDisplay = document.getElementById('score-display');

    const maxR = Settings.get('roundsToWin');
    const matchOver = roundsWon.p1 >= maxR || roundsWon.p2 >= maxR;

    if (matchOver) {
      // Skip round-end, go straight to match-end
      return;
    }

    // Update result text
    if (winner === 'draw') {
      resultText.textContent = 'DRAW!';
      resultText.style.color = '#f5c842';
    } else {
      const label = winner === 'p1' ? 'PLAYER 1' : lastMode === 'pve' ? 'CPU' : 'PLAYER 2';
      const col   = winner === 'p1' ? '#3b9eff' : '#ff3b5c';
      resultText.textContent = label + ' WINS ROUND ' + roundNum;
      resultText.style.color = col;
    }

    scoreDisplay.textContent = `Wins — P1: ${roundsWon.p1}   P2: ${roundsWon.p2}`;

    const btn = document.getElementById('next-round-btn');
    if (btn) btn.textContent = 'Next Round →';

    screen.classList.remove('hidden');
    screen.classList.add('active');
  }

  function nextRound() {
    const screen = document.getElementById('screen-roundend');
    screen.classList.remove('active');
    screen.classList.add('hidden');
    Game.nextRound();
  }

  function handleMatchEnd(winner) {
    const screen = document.getElementById('screen-gameover');
    const victoryText = document.getElementById('victory-text');
    const finalScore = document.getElementById('final-score');
    const mvpStats = document.getElementById('mvp-stats');

    const roundsWon = Game.getRoundsWon();
    const stats     = Game.getStats();

    if (winner === 'p1') {
      victoryText.textContent = 'PLAYER 1 WINS!';
      victoryText.style.color = '#3b9eff';
    } else {
      const label = lastMode === 'pve' ? 'CPU WINS!' : 'PLAYER 2 WINS!';
      victoryText.textContent = label;
      victoryText.style.color = '#ff3b5c';
    }

    finalScore.textContent = `Final Score — P1: ${roundsWon.p1}  P2: ${roundsWon.p2}`;

    const s1 = stats.p1, s2 = stats.p2;
    mvpStats.innerHTML = `
      <b>P1</b> — Hits: ${s1.hits || 0} | Damage Dealt: ${s1.totalDamage || 0} | Specials: ${s1.specials || 0}<br>
      <b>${lastMode === 'pve' ? 'CPU' : 'P2'}</b> — Hits: ${s2.hits || 0} | Damage Dealt: ${s2.totalDamage || 0} | Specials: ${s2.specials || 0}
    `;

    // Hide round-end if still showing
    const reScreen = document.getElementById('screen-roundend');
    reScreen.classList.remove('active');
    reScreen.classList.add('hidden');

    screen.classList.remove('hidden');
    screen.classList.add('active');
  }

  function goMenu() {
    Game.stop();

    // Hide game overlays
    ['screen-roundend', 'screen-gameover', 'screen-pause'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.classList.remove('active'); el.classList.add('hidden'); }
    });

    showScreen('screen-menu');
  }

  // ─── Pause ────────────────────────────────────────────────────────────────
  function togglePause() {
    const pauseScreen = document.getElementById('screen-pause');
    const isPaused = pauseScreen.classList.contains('active');
    if (isPaused) {
      pauseScreen.classList.remove('active');
      Game.setPaused(false);
    } else {
      pauseScreen.classList.add('active');
      Game.setPaused(true);
    }
  }

  // ─── Settings ─────────────────────────────────────────────────────────────
  function saveSettings() {
    Settings.save();
    showScreen('screen-menu');
  }

  // ─── Expose ───────────────────────────────────────────────────────────────
  return {
    boot, showScreen, startGame,
    nextRound, goMenu, togglePause,
    saveSettings,
    get lastMode() { return lastMode; },
  };
})();

// Boot on DOM ready
document.addEventListener('DOMContentLoaded', App.boot);
