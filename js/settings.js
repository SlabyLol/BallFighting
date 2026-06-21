/* js/settings.js — Settings manager */

const Settings = (() => {
  const DEFAULTS = {
    roundTime: 60,
    roundsToWin: 2,
    ballSize: 'normal',
    effects: 'on',
  };

  let current = { ...DEFAULTS };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem('ballbrawl-settings') || '{}');
      current = { ...DEFAULTS, ...saved };
    } catch {
      current = { ...DEFAULTS };
    }
    applyToUI();
  }

  function save() {
    try { localStorage.setItem('ballbrawl-settings', JSON.stringify(current)); } catch {}
    applyToUI();
  }

  function get(key) { return current[key]; }
  function set(key, value) { current[key] = value; }

  function getBallRadius() {
    const map = { small: 20, normal: 28, large: 38 };
    return map[current.ballSize] || 28;
  }

  function applyToUI() {
    // Sync opt-btn groups from settings
    const groups = {
      'setting-time':   'roundTime',
      'setting-rounds': 'roundsToWin',
      'setting-size':   'ballSize',
      'setting-effects':'effects',
    };
    for (const [id, key] of Object.entries(groups)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.querySelectorAll('.opt-btn').forEach(btn => {
        const raw = btn.dataset.val;
        const val = isNaN(+raw) ? raw : +raw;
        btn.classList.toggle('active', val === current[key]);
      });
    }
  }

  function bindUI() {
    const groups = {
      'setting-time':   (v) => set('roundTime', +v),
      'setting-rounds': (v) => set('roundsToWin', +v),
      'setting-size':   (v) => set('ballSize', v),
      'setting-effects':(v) => set('effects', v),
    };
    for (const [id, handler] of Object.entries(groups)) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener('click', e => {
        const btn = e.target.closest('.opt-btn');
        if (!btn) return;
        handler(btn.dataset.val);
        el.querySelectorAll('.opt-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    }
  }

  return { load, save, get, set, getBallRadius, bindUI };
})();
