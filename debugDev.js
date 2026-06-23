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
    let selectedPlayerKey = 'Auto-Detect (P1)';

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

    // DYNAMISCHE SPIELER-ERKENNUNG
    function getAvailablePlayers() {
        const targets = [];
        if (typeof GS === 'undefined') return targets;

        // Scanne alle Keys im globalen GS-Zustand nach Player-Objekten
        Object.keys(GS).forEach(key => {
            const obj = GS[key];
            if (obj && typeof obj === 'object') {
                // Kriterien für ein Spieler/CPU-Objekt (Besitzt HP oder ID oder Typ)
                if ('hp' in obj || 'health' in obj || 'spCharge' in obj || key.toLowerCase().match(/^(p1|p2|player|cpu|char|bot)/)) {
                    targets.push({ key: key, obj: obj });
                }
            }
        });

        // Fallback falls die Engine Arrays nutzt (z.B. GS.players[0])
        if (GS.players && Array.isArray(GS.players)) {
            GS.players.forEach((p, idx) => {
                if (p) targets.push({ key: `players[${idx}]`, obj: p });
            });
        }
        return targets;
    }

    function getSelectedPlayerEntity() {
        if (typeof GS === 'undefined') return null;
        
        // Direkter Zugriff über den ausgewählten Ke
        if (selectedPlayerKey.includes('[')) {
            // Für Array-Zugriffe wie players[0]
            try { return eval(`GS.${selectedPlayerKey}`); } catch(e) { return null; }
        }
        
        if (GS[selectedPlayerKey]) return GS[selectedPlayerKey];
        
        // Intelligenter Auto-Detect Fallback
        const found = getAvailablePlayers();
        if (found.length > 0) return found[0].obj;
        
        // Allerletzter Notnagel (direkte globale Suche nach Variablen)
        return window.p1 || window.player || GS.p1 || GS.player1;
    }

    // 2. DETEKTION & SPAWN LOGIK
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
            const targetItem = activeTypes[index];
            spawnSingleItem(targetItem);
        } else {
            logToDebug('ERROR', 'No live ITEM_TYPES array found!');
        }
    }

    function toggleTimerFreeze(checked) {
        freezeTimerActive = checked;
        if (freezeTimerActive) {
            if (typeof GS !== 'undefined' && GS.matchTimer !== undefined) {
                lastSavedTime = GS.matchTimer;
            } else {
                const timerEl = document.getElementById('timer');
                lastSavedTime = timerEl ? parseFloat(timerEl.innerText) || 60 : 60;
            }
            logToDebug('SYSTEM', `Engine-Level Timer Lock engaged at ${lastSavedTime}s.`);
        } else {
            logToDebug('SYSTEM', 'Engine-Level Timer Lock released.');
        }
    }

    // 3. UI INITIALISIERUNG
    const panel = document.createElement('div');
    panel.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; width: 800px; height: 600px;
        background: #111; color: #e0e0e0; font-family: 'Consolas', monospace; font-size: 12px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.9); border-radius: 8px; border: 1px solid #00ffaa;
        display: none; flex-direction: column; z-index: 999999; overflow: hidden;
        transition: height 0.15s, width 0.15s;
    `;

    const header = document.createElement('div');
    header.style.cssText = `background:#1a1a1a; padding:12px; font-weight:bold; border-bottom:1px solid #252525; display:flex; justify-content:space-between; align-items:center; color:#00ffaa; user-select:none;`;
    header.innerHTML = `<span>DarkFox Co. Overlord Engine v7.7</span>`;
    
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
        btn.style.cssText = 'padding:12px 10px; background:transparent; border:none; color:#888; text-align:left; cursor:pointer; font-family:inherit; font-size:11px; border-left: 3px solid transparent; transition: all 0.2s;';
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
    cliContainer.id = 'dev-cli';
    cliContainer.style.cssText = 'display:flex; background:#161616; border-top:1px solid #252525; padding:8px;';
    cliContainer.innerHTML = '<span style="color:#00ffaa; padding:4px 5px; font-weight:bold;">❯</span>';
    const cmdInput = document.createElement('input');
    cmdInput.type = 'text';
    cmdInput.placeholder = 'Type command...';
    cmdInput.style.cssText = 'flex-grow:1; background:transparent; border:none; color:#fff; font-family:inherit; font-size:12px; padding:4px; outline:none;';
    cliContainer.appendChild(cmdInput);
    panel.appendChild(cliContainer);

    document.body.appendChild(panel);

    function toggleMinimize() {
        isMinimized = !isMinimized;
        if (isMinimized) {
            panel.style.height = '42px'; panel.style.width = '280px';
            mainLayout.style.display = 'none'; cliContainer.style.display = 'none';
            minBtn.innerText = '⬜';
        } else {
            panel.style.height = '600px'; panel.style.width = '800px';
            mainLayout.style.display = 'flex'; minBtn.innerText = '_';
            switchTab(currentTab);
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
        if (devLogs.length === 0) {
            contentContainer.innerHTML = '<span style="color:#555;">// Terminal ready.</span>';
            return;
        }
        devLogs.forEach(log => {
            const entry = document.createElement('div');
            entry.style.cssText = 'padding:3px 0; border-bottom:1px solid #1a1a1a; font-size:11px; white-space:pre-wrap;';
            let color = '#d4d4d4';
            if (log.type === 'ERROR') color = '#ff4444';
            if (log.type === 'WARN') color = '#ff9900';
            if (log.type === 'CMD') color = '#00ffaa';
            if (log.type === 'RESULT') color = '#55ff55';
            if (log.type === 'SYSTEM') color = '#ff00ff';
            
            entry.innerHTML = `<span style="color:#444;">[${log.time}]</span> <b style="color:${color}">${log.type}:</b> ${log.message}`;
            contentContainer.appendChild(entry);
        });
        contentContainer.scrollTop = contentContainer.scrollHeight;
    }

    function renderItemsView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">Object Matrix Spawner</h3>';
        const rndBtn = document.createElement('button');
        rndBtn.innerText = '🎲 Spawn Random Item';
        rndBtn.style.cssText = 'width:100%; background:#8a1a8a; border:1px solid #ff00ff; color:#fff; padding:12px; cursor:pointer; border-radius:4px; font-weight:bold; margin-bottom:15px; font-family:inherit;';
        rndBtn.onclick = spawnRandomItem;
        contentContainer.appendChild(rndBtn);

        const activeItemTypes = window.ITEM_TYPES || (typeof ITEM_TYPES !== 'undefined' ? ITEM_TYPES : null);
        if (!activeItemTypes) {
            contentContainer.innerHTML += '<p style="color:#ff4444;">⚠️ ITEM_TYPES not found.</p>';
            return;
        }

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap:8px;';
        
        activeItemTypes.forEach(item => {
            const isObj = typeof item === 'object' && item !== null;
            const emoji = isObj ? item.emoji : '📦';
            const label = isObj ? (item.label || item.id) : item;
            const borderCol = isObj ? (item.col || '#3c3c3c') : '#3c3c3c';

            const btn = document.createElement('button');
            btn.innerText = `Spawn ${emoji} ${label}`;
            btn.style.cssText = `background:#222; border:1px solid ${borderCol}; color:#fff; padding:10px; cursor:pointer; border-radius:4px; text-align:left; font-family:inherit; font-size:11px;`;
            btn.onclick = () => spawnSingleItem(item);
            grid.appendChild(btn);
        });
        contentContainer.appendChild(grid);
    }

    function renderJsExecuteView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 5px 0; color:#00ffaa;">JSexecute Injection Suite</h3>';
        const loaderBox = document.createElement('div');
        loaderBox.style.cssText = 'background:#161616; padding:15px; border-radius:6px; border:1px solid #2d2d2d; display:flex; flex-direction:column; gap:10px;';
        const urlInput = document.createElement('input'); urlInput.type = 'text'; urlInput.placeholder = 'https://example.com/script.js'; urlInput.style.cssText = 'background:#111; border:1px solid #444; color:#fff; padding:8px; border-radius:4px; font-family:inherit;';
        const injectBtn = document.createElement('button'); injectBtn.innerText = '🚀 Inject'; injectBtn.style.cssText = 'background:#005533; border:1px solid #00ffaa; color:#fff; padding:10px; font-weight:bold; cursor:pointer; font-family:inherit;';
        
        injectBtn.onclick = () => {
            const url = urlInput.value.trim();
            if(!url) return;
            const script = document.createElement('script'); script.src = url; script.id = `js-injected-script-${scriptCounter++}`;
            script.onload = () => { logToDebug('RESULT', `Loaded: ${url}`); };
            document.head.appendChild(script); urlInput.value = '';
        };
        loaderBox.appendChild(urlInput); loaderBox.appendChild(injectBtn); contentContainer.appendChild(loaderBox);
    }

    function renderCheatsView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">Engine Macro Utilities</h3>';
        
        // --- 1. GLOBALER TIMER FREEZER ---
        const freezeContainer = document.createElement('div');
        freezeContainer.style.cssText = 'background:#1b2a22; border:1px solid #00ffaa; padding:12px; border-radius:6px; margin-bottom:15px; display:flex; align-items:center; gap:10px; user-select:none;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.id = 'freeze-timer-cb'; checkbox.style.cssText = 'width:16px; height:16px; cursor:pointer; accent-color:#00ffaa;';
        checkbox.checked = freezeTimerActive;
        checkbox.onchange = (e) => toggleTimerFreeze(e.target.checked);
        const label = document.createElement('label'); label.htmlFor = 'freeze-timer-cb'; label.innerText = '❄️ HARD ENGINE TIMER LOCK (Echtes Einfrieren)'; label.style.cssText = 'color:#00ffaa; font-weight:bold; font-size:12px; cursor:pointer;';
        freezeContainer.appendChild(checkbox); freezeContainer.appendChild(label);
        contentContainer.appendChild(freezeContainer);

        // --- 2. NEUER TARGET PLAYER SELECTOR ---
        const selectorContainer = document.createElement('div');
        selectorContainer.style.cssText = 'background:#1a1a1a; border:1px solid #3a3a3a; padding:12px; border-radius:6px; margin-bottom:15px; display:flex; flex-direction:column; gap:8px;';
        selectorContainer.innerHTML = '<span style="color:#00ffaa; font-weight:bold;">🎯 Target Entity Lock (Objekt-Auswahl)</span>';
        
        const selectEl = document.createElement('select');
        selectEl.style.cssText = 'background:#111; color:#fff; border:1px solid #00ffaa; padding:8px; border-radius:4px; font-family:inherit; outline:none; cursor:pointer;';
        
        // Scanne vorhandene Entities im GS state
        const playersFound = getAvailablePlayers();
        if (playersFound.length === 0) {
            const opt = document.createElement('option');
            opt.innerText = 'No entities detected yet (Using Fallback)';
            selectEl.appendChild(opt);
        } else {
            playersFound.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.key;
                opt.innerText = `GS.${p.key} (${typeof p.obj.hp !== 'undefined' ? 'HP: ' + Math.ceil(p.obj.hp) : 'Entity'})`;
                if (p.key === selectedPlayerKey) opt.selected = true;
                selectEl.appendChild(opt);
            });
        }
        
        selectEl.onchange = (e) => {
            selectedPlayerKey = e.target.value;
            logToDebug('SYSTEM', `Target locked to: GS.${selectedPlayerKey}`);
        };
        selectorContainer.appendChild(selectEl);
        contentContainer.appendChild(selectorContainer);

        // --- 3. DIE MODIFIZIERTEN CHEAT-MAKROS ---
        const grid = document.createElement('div'); 
        grid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap:10px;';
        
        const cheats = [
            { name: '❤️ Heal Selected Target (Full HP)', act: () => { 
                const ent = getSelectedPlayerEntity();
                if(ent) {
                    if('hp' in ent) ent.hp = 100;
                    if('health' in ent) ent.health = 100;
                    logToDebug('RESULT', `Healed locked target (GS.${selectedPlayerKey})`);
                } else { logToDebug('ERROR', 'No target entity loaded or selected'); }
            } },
            { name: '💥 Insta-Kill Selected Target (0 HP)', act: () => { 
                const ent = getSelectedPlayerEntity();
                if(ent) {
                    if('hp' in ent) ent.hp = 0;
                    if('health' in ent) ent.health = 0;
                    logToDebug('RESULT', `Killed locked target (GS.${selectedPlayerKey})`);
                } else { logToDebug('ERROR', 'No target entity loaded or selected'); }
            } },
            { name: '🔥 Toggle Infinite Special (Locked Target)', act: () => {
                infSpecialActive = !infSpecialActive;
                if(infSpecialActive) {
                    infSpecialLoop = setInterval(() => {
                        const ent = getSelectedPlayerEntity();
                        if(ent) {
                            if('spCharge' in ent) ent.spCharge = 1;
                            if('special' in ent) ent.special = 100;
                            if('charge' in ent) ent.charge = 1;
                        }
                    }, 30);
                    logToDebug('SYSTEM', 'Infinite Special loop running on selected target.');
                } else {
                    clearInterval(infSpecialLoop); infSpecialLoop = null;
                    logToDebug('SYSTEM', 'Infinite Special disabled.');
                }
            }},
            { name: '🚀 Overlord Speed Mode (Locked Target)', act: () => { 
                const ent = getSelectedPlayerEntity();
                if(ent) {
                    // Falls vxMax oder speed Attribute existieren
                    if('vxMax' in ent) ent.vxMax = ent.vxMax === 24 ? 8 : 24;
                    if('speed' in ent) ent.speed = ent.speed === 24 ? 5 : 24;
                    logToDebug('RESULT', `Modified speed properties of GS.${selectedPlayerKey}`);
                } else { logToDebug('ERROR', 'No target entity found'); }
            } },
            { name: '🎨 Toggle Wireframes', act: () => document.querySelectorAll('*').forEach(el => el.style.outline = el.style.outline ? '' : '1px solid #00ffaa') },
            { name: '✏️ Document Edit Mode', act: () => document.designMode = document.designMode === 'on' ? 'off' : 'on' },
            { name: '🧹 Clear Cache', act: () => { localStorage.clear(); sessionStorage.clear(); } },
            { name: '🔄 Speed Reload', act: () => window.location.reload() }
        ];
        
        cheats.forEach(b => {
            const btn = document.createElement('button'); btn.innerText = b.name; btn.style.cssText = 'background:#222; border:1px solid #3a3a3a; color:#fff; padding:10px; cursor:pointer; border-radius:4px; font-family:inherit; text-align:left; font-size:11px;';
            btn.onclick = b.act; grid.appendChild(btn);
        });
        contentContainer.appendChild(grid);
    }

    function renderDomView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">HTML Document Elements Tree</h3>';
        const pre = document.createElement('pre'); pre.style.cssText = 'background:#050505; color:#a5d6ff; padding:10px; border-radius:4px; font-size:11px; max-height:450px; overflow:auto; white-space:pre-wrap; margin:0;';
        pre.innerText = document.documentElement.outerHTML.slice(0, 30000); contentContainer.appendChild(pre);
    }

    function renderStatsView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">Live Metrics Dashboard</h3>';
        const box = document.createElement('div'); box.style.cssText = 'background:#161616; padding:15px; border-radius:6px; line-height:2; font-size:12px;';
        setInterval(() => {
            if (currentTab === 'stats' && isPanelOpen && !isMinimized) {
                const ent = getSelectedPlayerEntity();
                box.innerHTML = `
                    <b style="color:#ff00ff">🎮 Target Locked Entity State (GS.${selectedPlayerKey}):</b><br>
                    • Current HP/Health: <span style="color:#3b9eff">${ent ? (ent.hp !== undefined ? Math.ceil(ent.hp) : (ent.health !== undefined ? Math.ceil(ent.health) : 'N/A')) : 'No Target'}</span><br>
                    • Special Charge Vector: <span style="color:#3b9eff">${ent ? (ent.spCharge !== undefined ? ent.spCharge : (ent.special !== undefined ? ent.special : 'N/A')) : 'No Target'}</span><br>
                    • Active Items in Engine: <span style="color:#55ff55">${(typeof GS !== 'undefined' && GS.items) ? GS.items.length : 'N/A'}</span><br>
                    • Match-Timer State: <span style="color:#55ff55">${(typeof GS !== 'undefined') ? GS.matchTimer : 'N/A'}</span><br><br>
                    <b style="color:#00bfff">💻 Diagnostics:</b><br>
                    • Engine Framerate: <span style="color:#00ffaa; font-weight:bold">${performanceStats.fps} FPS</span>
                `;
            }
        }, 150);
        contentContainer.appendChild(box);
    }

    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && cmdInput.value.trim() !== '') {
            const command = cmdInput.value.trim();
            logToDebug('CMD', command);
            commandHistory.push(command);
            historyIndex = commandHistory.length;

            const cmdLower = command.toLowerCase().replace(';', '');
            if (cmdLower === 'spawnrnd') spawnRandomItem();
            else if (cmdLower === 'freeze') toggleTimerFreeze(!freezeTimerActive);
            else if (cmdLower === 'clear') { devLogs.length = 0; updateConsoleView(); }
            else {
                try {
                    const result = window.eval(command);
                    logToDebug('RESULT', result !== undefined ? JSON.stringify(result) : 'undefined');
                } catch (err) { logToDebug('ERROR', `Eval Error: ${err.message}`); }
            }
            cmdInput.value = '';
        }
    });

    function toggleDebugPanel() {
        isPanelOpen = !isPanelOpen;
        panel.style.display = isPanelOpen ? 'flex' : 'none';
    }
})();
