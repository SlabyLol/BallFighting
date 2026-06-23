(function() {
    const devLogs = [];
    const commandHistory = [];
    let historyIndex = -1;
    let isPanelOpen = false;
    let isMinimized = false;
    let currentTab = 'console';
    let mousePos = { x: 0, y: 0 };
    let lastKey = 'None';
    let performanceStats = { fps: 0, lastTime: performance.now(), frames: 0 };
    let scriptCounter = 0;

    // Cheat- & Target-Zustände
    let freezeTimerActive = false;
    let infSpecialActive = false;
    let infSpecialLoop = null;
    let lastSavedTime = 60;
    let selectedPlayerPath = 'AUTO'; 
    let manualPlayerPath = '';

    // 1. KONSOLEN & FEHLER HOOKS
    const consoleTypes = ['log', 'error', 'warn', 'info', 'debug'];
    consoleTypes.forEach(type => {
        const original = console[type];
        console[type] = function(...args) {
            logToDebug(type.toUpperCase(), args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' '));
            original.apply(console, args);
        };
    });

    window.addEventListener('error', (e) => logToDebug('ERROR', `${e.message} (${e.filename}:${e.lineno})`));
    window.addEventListener('unhandledrejection', (e) => logToDebug('ERROR', `Promise: ${e.reason}`));
    
    window.addEventListener('mousemove', (e) => { mousePos.x = e.clientX; mousePos.y = e.clientY; });
    window.addEventListener('keydown', (e) => { 
        lastKey = `${e.key} (${e.keyCode})`;
        if (e.key.length === 1) {
            inputBuffer += e.key;
            if (inputBuffer.toLowerCase().endsWith('debug')) {
                toggleDebugPanel();
                inputBuffer = ""; 
            }
        }
    });
    let inputBuffer = "";

    function updateFPS() {
        performanceStats.frames++;
        const now = performance.now();
        if (now >= performanceStats.lastTime + 1000) {
            performanceStats.fps = Math.round((performanceStats.frames * 1000) / (now - performanceStats.lastTime));
            performanceStats.frames = 0;
            performanceStats.lastTime = now;
        }
        requestAnimationFrame(updateFPS);
    }
    requestAnimationFrame(updateFPS);

    // ENGINE INTERCEPTOR LOOP
    function coreEngineLoop() {
        if (freezeTimerActive && typeof GS !== 'undefined') {
            if (GS.matchTimer !== undefined) GS.matchTimer = lastSavedTime;
            if (GS.timer !== undefined) GS.timer = lastSavedTime;
            if (GS.gameTime !== undefined) GS.gameTime = lastSavedTime;
            
            const timerEl = document.getElementById('timer');
            if (timerEl) timerEl.innerText = Math.ceil(lastSavedTime);
        }
        requestAnimationFrame(coreEngineLoop);
    }
    requestAnimationFrame(coreEngineLoop);

    function logToDebug(type, message) {
        const time = new Date().toLocaleTimeString();
        devLogs.push({ type, message, time });
        if (isPanelOpen && currentTab === 'console' && !isMinimized) updateConsoleView();
    }

    // ADVANCED DEEP RECURSIVE SCANNER
    function findEntitiesInObject(obj, path = '', visited = new Set(), depth = 0) {
        const results = [];
        if (depth > 4 || !obj || typeof obj !== 'object' || visited.has(obj)) return results;
        visited.add(obj);

        try {
            // Check ob das aktuelle Objekt ein Player-Kandidat ist
            if ('hp' in obj || 'health' in obj || 'spCharge' in obj) {
                results.push({ path: path, obj: obj });
            }

            // Durchsuche Properties
            for (let key in obj) {
                if (obj.hasOwnProperty(key) && key !== 'window' && key !== 'document' && key !== 'parent') {
                    const nextPath = path ? `${path}.${key}` : key;
                    
                    // Array-Check (z.B. GS.entities[0])
                    if (Array.isArray(obj[key])) {
                        obj[key].forEach((item, idx) => {
                            if (item && typeof item === 'object') {
                                results.push(...findEntitiesInObject(item, `${nextPath}[${idx}]`, visited, depth + 1));
                            }
                        });
                    } else if (obj[key] && typeof obj[key] === 'object') {
                        results.push(...findEntitiesInObject(obj[key], nextPath, visited, depth + 1));
                    }
                }
            }
        } catch (e) {}
        return results;
    }

    function getAllDetectedEntities() {
        const list = [];
        const visited = new Set();

        // 1. Scanne GS falls vorhanden
        if (typeof GS !== 'undefined') {
            list.push(...findEntitiesInObject(GS, 'GS', visited));
        }
        // 2. Scanne das globale Fenster nach typischen Objekten (p1, players, engine, etc.)
        const targets = ['p1', 'p2', 'player', 'players', 'cpu', 'game', 'engine', 'match'];
        targets.forEach(t => {
            if (window[t] && typeof window[t] === 'object') {
                list.push(...findEntitiesInObject(window[t], t, visited));
            }
        });

        // Duplikate filtern
        const uniquePaths = [];
        const seen = new Set();
        list.forEach(item => {
            if (!seen.has(item.path)) {
                seen.add(item.path);
                uniquePaths.push(item);
            }
        });
        return uniquePaths;
    }

    function getSelectedPlayerEntity() {
        // Falls der User manuell einen JS-Pfad eingegeben hat
        if (selectedPlayerPath === 'MANUAL' && manualPlayerPath) {
            try { return window.eval(manualPlayerPath); } catch(e) { return null; }
        }
        
        // Versuche den ausgewählten Pfad zu evalulieren
        if (selectedPlayerPath !== 'AUTO' && selectedPlayerPath !== 'MANUAL') {
            try { return window.eval(selectedPlayerPath); } catch(e) { return null; }
        }

        // AUTO DETECTION FALLBACK
        const detected = getAllDetectedEntities();
        if (detected.length > 0) return detected[0].obj;

        // Notnagel-Prüfungen
        if (typeof GS !== 'undefined') {
            if (GS.p1) return GS.p1;
            if (GS.player) return GS.player;
            if (GS.players && GS.players[0]) return GS.players[0];
        }
        return window.p1 || window.player;
    }

    // 2. SPAWN LOGIK
    function spawnSingleItem(itemObject) {
        if ((typeof ITEM_TYPES !== 'undefined' || window.ITEM_TYPES !== undefined) && typeof GS !== 'undefined' && typeof Item !== 'undefined') {
            const xPos = (typeof rnd === 'function' && typeof W !== 'undefined') ? rnd(W * .1, W * .9) : window.innerWidth / 2;
            const fyVal = typeof FY !== 'undefined' ? FY : 0;
            GS.items.push(new Item(xPos, -30, itemObject, fyVal));
            logToDebug('SYSTEM', `Spawned item object: ${itemObject.id || 'Unknown'}`);
        } else {
            logToDebug('ERROR', 'Game engine components missing in global window scope!');
        }
    }

    function spawnRandomItem() {
        const activeTypes = window.ITEM_TYPES || (typeof ITEM_TYPES !== 'undefined' ? ITEM_TYPES : null);
        if (activeTypes && activeTypes.length > 0) {
            const index = Math.floor(Math.random() * activeTypes.length);
            spawnSingleItem(activeTypes[index]);
        }
    }

    function toggleTimerFreeze(checked) {
        freezeTimerActive = checked;
        if (freezeTimerActive) {
            if (typeof GS !== 'undefined' && GS.matchTimer !== undefined) lastSavedTime = GS.matchTimer;
            else {
                const timerEl = document.getElementById('timer');
                lastSavedTime = timerEl ? parseFloat(timerEl.innerText) || 60 : 60;
            }
        }
    }

    // UI INITIALISIERUNG
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; width: 800px; height: 600px;
        background: #111; color: #e0e0e0; font-family: 'Consolas', monospace; font-size: 12px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.9); border-radius: 8px; border: 1px solid #00ffaa;
        display: none; flex-direction: column; z-index: 999999; overflow: hidden;
    `;

    const header = document.createElement('div');
    header.style.cssText = `background:#1a1a1a; padding:12px; font-weight:bold; border-bottom:1px solid #252525; display:flex; justify-content:space-between; align-items:center; color:#00ffaa; user-select:none;`;
    header.innerHTML = `<span>DarkFox Co. Overlord Engine v7.8</span>`;
    
    const controls = document.createElement('div');
    const minBtn = document.createElement('button'); minBtn.innerText = '_'; minBtn.style.cssText = 'background:transparent; border:none; color:#00ffaa; cursor:pointer; font-size:16px; margin-right:10px; font-weight:bold;'; minBtn.onclick = toggleMinimize;
    const closeBtn = document.createElement('button'); closeBtn.innerText = '✕'; closeBtn.style.cssText = 'background:transparent; border:none; color:#ff5555; cursor:pointer; font-size:14px; font-weight:bold;'; closeBtn.onclick = toggleDebugPanel;
    controls.appendChild(minBtn); controls.appendChild(closeBtn); header.appendChild(controls); panel.appendChild(header);

    const mainLayout = document.createElement('div');
    mainLayout.style.cssText = 'display: flex; flex-grow: 1; overflow: hidden;';
    
    const sidebar = document.createElement('div');
    sidebar.style.cssText = 'width: 180px; background: #161616; border-right: 1px solid #252525; display: flex; flex-direction: column;';
    
    const tabs = {
        console: '🖥️ Terminal',
        items: '📦 Item Engine',
        jsexecute: '🚀 JSexecute Loader',
        actions: '⚡ Quick Cheats',
        dom: '🔍 DOM Explorer',
        stats: '📊 Performance'
    };

    Object.keys(tabs).forEach(tabId => {
        const btn = document.createElement('button');
        btn.innerText = tabs[tabId];
        btn.style.cssText = 'padding:12px 10px; background:transparent; border:none; color:#888; text-align:left; cursor:pointer; font-family:inherit; font-size:11px; border-left: 3px solid transparent;';
        btn.onclick = () => switchTab(tabId);
        sidebar.appendChild(btn);
        tabs[tabId] = btn;
    });
    mainLayout.appendChild(sidebar);

    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = 'flex-grow:1; padding:15px; overflow-y:auto; background:#131313;';
    mainLayout.appendChild(contentContainer);
    panel.appendChild(mainLayout);

    const cliContainer = document.createElement('div');
    cliContainer.style.cssText = 'display:flex; background:#161616; border-top:1px solid #252525; padding:8px;';
    cliContainer.innerHTML = '<span style="color:#00ffaa; padding:4px 5px; font-weight:bold;">❯</span>';
    const cmdInput = document.createElement('input');
    cmdInput.type = 'text'; cmdInput.placeholder = 'Type command...';
    cmdInput.style.cssText = 'flex-grow:1; background:transparent; border:none; color:#fff; font-family:inherit; font-size:12px; padding:4px; outline:none;';
    cliContainer.appendChild(cmdInput); panel.appendChild(cliContainer);
    document.body.appendChild(panel);

    function toggleMinimize() {
        isMinimized = !isMinimized;
        if (isMinimized) {
            panel.style.height = '42px'; panel.style.width = '280px';
            mainLayout.style.display = 'none'; cliContainer.style.display = 'none';
        } else {
            panel.style.height = '600px'; panel.style.width = '800px';
            mainLayout.style.display = 'flex'; switchTab(currentTab);
        }
    }

    function switchTab(tabId) {
        currentTab = tabId;
        Object.keys(tabs).forEach(id => {
            tabs[id].style.color = (id === tabId) ? '#00ffaa' : '#888';
            tabs[id].style.background = (id === tabId) ? '#131313' : 'transparent';
            tabs[id].style.borderLeftColor = (id === tabId) ? '#00ffaa' : 'transparent';
        });

        contentContainer.innerHTML = '';
        cliContainer.style.display = (tabId === 'console') ? 'flex' : 'none';

        if (tabId === 'console') updateConsoleView();
        else if (tabId === 'items') renderItemsView();
        else if (tabId === 'jsexecute') renderJsExecuteView();
        else if (tabId === 'actions') renderCheatsView();
        else if (tabId === 'dom') renderDomView();
        else if (tabId === 'stats') renderStatsView();
    }

    function updateConsoleView() {
        if (currentTab !== 'console') return;
        contentContainer.innerHTML = '';
        devLogs.forEach(log => {
            const entry = document.createElement('div');
            entry.style.cssText = 'padding:3px 0; border-bottom:1px solid #1a1a1a; font-size:11px; white-space:pre-wrap;';
            entry.innerHTML = `<span style="color:#444;">[${log.time}]</span> <b>${log.type}:</b> ${log.message}`;
            contentContainer.appendChild(entry);
        });
    }

    function renderItemsView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">Object Matrix Spawner</h3>';
        const activeItemTypes = window.ITEM_TYPES || (typeof ITEM_TYPES !== 'undefined' ? ITEM_TYPES : null);
        if (!activeItemTypes) return;

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap:8px;';
        activeItemTypes.forEach(item => {
            const btn = document.createElement('button');
            btn.innerText = `Spawn ${item.emoji || '📦'} ${item.label || item.id || item}`;
            btn.style.cssText = `background:#222; border:1px solid #444; color:#fff; padding:10px; cursor:pointer; border-radius:4px; font-family:inherit;`;
            btn.onclick = () => spawnSingleItem(item);
            grid.appendChild(btn);
        });
        contentContainer.appendChild(grid);
    }

    function renderJsExecuteView() { /* Gleichbleibend */ }

    function renderCheatsView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">Engine Macro Utilities</h3>';
        
        // --- 1. TIMER FREEZER ---
        const freezeContainer = document.createElement('div');
        freezeContainer.style.cssText = 'background:#1b2a22; border:1px solid #00ffaa; padding:12px; border-radius:6px; margin-bottom:15px; display:flex; align-items:center; gap:10px;';
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.id = 'freeze-timer-cb'; checkbox.checked = freezeTimerActive;
        checkbox.onchange = (e) => toggleTimerFreeze(e.target.checked);
        const label = document.createElement('label'); label.htmlFor = 'freeze-timer-cb'; label.innerText = '❄️ HARD ENGINE TIMER LOCK'; label.style.cssText = 'color:#00ffaa; font-weight:bold; cursor:pointer;';
        freezeContainer.appendChild(checkbox); freezeContainer.appendChild(label);
        contentContainer.appendChild(freezeContainer);

        // --- 2. ADVANCED TARGET SELECTOR ---
        const selectorContainer = document.createElement('div');
        selectorContainer.style.cssText = 'background:#1a1a1a; border:1px solid #3a3a3a; padding:12px; border-radius:6px; margin-bottom:15px; display:flex; flex-direction:column; gap:8px;';
        selectorContainer.innerHTML = '<span style="color:#00ffaa; font-weight:bold;">🎯 Target Entity Lock (Deep Scan Matrix)</span>';
        
        const selectEl = document.createElement('select');
        selectEl.style.cssText = 'background:#111; color:#fff; border:1px solid #00ffaa; padding:8px; border-radius:4px; font-family:inherit;';
        
        // Optionen befüllen
        const optAuto = document.createElement('option'); optAuto.value = 'AUTO'; optAuto.innerText = 'Auto-Detect First Candidate';
        if(selectedPlayerPath === 'AUTO') optAuto.selected = true;
        selectEl.appendChild(optAuto);

        const optManual = document.createElement('option'); optManual.value = 'MANUAL'; optManual.innerText = '[MANUAL] Custom JS Path...';
        if(selectedPlayerPath === 'MANUAL') optManual.selected = true;
        selectEl.appendChild(optManual);

        const foundEntities = getAllDetectedEntities();
        foundEntities.forEach(ent => {
            const opt = document.createElement('option');
            opt.value = ent.path;
            opt.innerText = `Scan-Hit: ${ent.path} (HP: ${ent.obj.hp || ent.obj.health || '?'})`;
            if (ent.path === selectedPlayerPath) opt.selected = true;
            selectEl.appendChild(opt);
        });

        // Manuelles Eingabefeld falls benötigt
        const manualInput = document.createElement('input');
        manualInput.type = 'text'; manualInput.placeholder = 'e.g. GS.entities[0] or window.myPlayer';
        manualInput.value = manualPlayerPath;
        manualInput.style.cssText = `background:#111; border:1px solid #444; color:#fff; padding:6px; border-radius:4px; font-family:inherit; margin-top:5px; display:${selectedPlayerPath === 'MANUAL' ? 'block' : 'none'};`;
        manualInput.oninput = (e) => manualPlayerPath = e.target.value;

        selectEl.onchange = (e) => {
            selectedPlayerPath = e.target.value;
            manualInput.style.display = selectedPlayerPath === 'MANUAL' ? 'block' : 'none';
            logToDebug('SYSTEM', `Target Path Lock set to: ${selectedPlayerPath}`);
        };

        selectorContainer.appendChild(selectEl);
        selectorContainer.appendChild(manualInput);
        contentContainer.appendChild(selectorContainer);

        // --- CHEAT UTILITIES ---
        const grid = document.createElement('div'); grid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap:10px;';
        const cheats = [
            { name: '❤️ Heal Target (Full HP)', act: () => { 
                const ent = getSelectedPlayerEntity();
                if(ent) { if('hp' in ent) ent.hp = 100; if('health' in ent) ent.health = 100; logToDebug('RESULT', 'Target Healed!'); }
                else { logToDebug('ERROR', 'No Target active. Check Target Selector above.'); }
            } },
            { name: '💥 Insta-Kill Target (0 HP)', act: () => { 
                const ent = getSelectedPlayerEntity();
                if(ent) { if('hp' in ent) ent.hp = 0; if('health' in ent) ent.health = 0; logToDebug('RESULT', 'Target Eliminated!'); }
            } },
            { name: '🔥 Toggle Infinite Special', act: () => {
                infSpecialActive = !infSpecialActive;
                if(infSpecialActive) {
                    infSpecialLoop = setInterval(() => {
                        const ent = getSelectedPlayerEntity();
                        if(ent) { if('spCharge' in ent) ent.spCharge = 1; if('special' in ent) ent.special = 100; }
                    }, 30);
                } else { clearInterval(infSpecialLoop); infSpecialLoop = null; }
            }},
            { name: '🚀 Overlord Speed Mode', act: () => { 
                const ent = getSelectedPlayerEntity();
                if(ent) { if('vxMax' in ent) ent.vxMax = ent.vxMax === 24 ? 8 : 24; if('speed' in ent) ent.speed = ent.speed === 24 ? 5 : 24; }
            } },
            { name: '🎨 Toggle Wireframes', act: () => document.querySelectorAll('*').forEach(el => el.style.outline = el.style.outline ? '' : '1px solid #00ffaa') },
            { name: '🔄 Speed Reload', act: () => window.location.reload() }
        ];
        
        cheats.forEach(b => {
            const btn = document.createElement('button'); btn.innerText = b.name; btn.style.cssText = 'background:#222; border:1px solid #3a3a3a; color:#fff; padding:10px; cursor:pointer; border-radius:4px; font-family:inherit;';
            btn.onclick = b.act; grid.appendChild(btn);
        });
        contentContainer.appendChild(grid);
    }

    function renderDomView() { /* Gleichbleibend */ }
    function renderStatsView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">Live Metrics Dashboard</h3>';
        const box = document.createElement('div'); box.style.cssText = 'background:#161616; padding:15px; border-radius:6px; line-height:2; font-size:12px;';
        setInterval(() => {
            if (currentTab === 'stats' && isPanelOpen && !isMinimized) {
                const ent = getSelectedPlayerEntity();
                box.innerHTML = `
                    <b style="color:#ff00ff">🎮 Target Locked Entity State:</b><br>
                    • Active Entity Object Found: <span style="color:${ent ? '#55ff55' : '#ff4444'}">${ent ? 'YES' : 'NO'}</span><br>
                    • HP/Health-State: <span style="color:#3b9eff">${ent ? (ent.hp !== undefined ? ent.hp : ent.health || 'N/A') : 'N/A'}</span><br>
                    • Frame-Vector: <span style="color:#00ffaa">${performanceStats.fps} FPS</span>
                `;
            }
        }, 150);
        contentContainer.appendChild(box);
    }

    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && cmdInput.value.trim() !== '') {
            const command = cmdInput.value.trim(); logToDebug('CMD', command);
            try { const result = window.eval(command); logToDebug('RESULT', JSON.stringify(result)); } catch (err) { logToDebug('ERROR', err.message); }
            cmdInput.value = '';
        }
    });

    function toggleDebugPanel() { isPanelOpen = !isPanelOpen; panel.style.display = isPanelOpen ? 'flex' : 'none'; }
})();
