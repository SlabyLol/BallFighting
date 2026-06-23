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

    // Emoji-Mapping-Tabelle für typische Item-Namen (wird automatisch als Fallback genutzt)
    const ITEM_EMOJIS = {
        'coin': '🪙', 'gold': '🥇', 'gem': '💎', 'diamond': '💎', 'heart': '❤️', 'life': '💖',
        'sword': '⚔️', 'shield': '🛡️', 'potion': '🧪', 'apple': '🍎', 'star': '⭐', 'key': '🔑',
        'bomb': '💣', 'box': '📦', 'chest': '🧰', 'speed': '⚡', 'fire': '🔥', 'water': '💧'
    };

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

    // FPS Zähler
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

    function logToDebug(type, message) {
        const time = new Date().toLocaleTimeString();
        devLogs.push({ type, message, time });
        if (isPanelOpen && currentTab === 'console' && !isMinimized) updateConsoleView();
    }

    // 2. SPAWN ENGINE LOGIK
    function getItemEmoji(typeName) {
        const lower = typeName.toLowerCase();
        // 1. Prüfen ob der Name selbst bereits ein Emoji enthält
        const emojiMatch = typeName.match(/[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff]/g);
        if (emojiMatch) return ""; // Kein extra Emoji nötig, Name hat schon eins
        
        // 2. In unserer Liste nach Schlüsselwörtern suchen
        for (let key in ITEM_EMOJIS) {
            if (lower.includes(key)) return ITEM_EMOJIS[key] + " ";
        }
        // Fallback Standard-Emoji
        return "📦 ";
    }

    function spawnSingleItem(type) {
        if (typeof ITEM_TYPES !== 'undefined' && typeof GS !== 'undefined' && typeof Item !== 'undefined') {
            const xPos = (typeof rnd === 'function' && typeof W !== 'undefined') ? rnd(W * .1, W * .9) : window.innerWidth / 2;
            const fyVal = typeof FY !== 'undefined' ? FY : 0;
            GS.items.push(new Item(xPos, -30, type, fyVal));
            logToDebug('SYSTEM', `Spawned item: ${type}`);
        } else {
            logToDebug('ERROR', 'Game engine variables missing for spawning!');
        }
    }

    function spawnRandomItem() {
        if (typeof ITEM_TYPES !== 'undefined' && ITEM_TYPES.length > 0) {
            const index = Math.floor(Math.random() * ITEM_TYPES.length);
            spawnSingleItem(ITEM_TYPES[index]);
        } else {
            logToDebug('ERROR', 'ITEM_TYPES array is empty or undefined!');
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

    // Header
    const header = document.createElement('div');
    header.style.cssText = `background:#1a1a1a; padding:12px; font-weight:bold; border-bottom:1px solid #252525; display:flex; justify-content:space-between; align-items:center; color:#00ffaa; user-select:none;`;
    header.innerHTML = `<span>DarkFox Co. Overlord Engine v7.0</span>`;
    
    const controls = document.createElement('div');
    const minBtn = document.createElement('button'); minBtn.innerText = '_'; minBtn.style.cssText = 'background:transparent; border:none; color:#00ffaa; cursor:pointer; font-size:16px; margin-right:10px; font-weight:bold;'; minBtn.onclick = toggleMinimize;
    const closeBtn = document.createElement('button'); closeBtn.innerText = '✕'; closeBtn.style.cssText = 'background:transparent; border:none; color:#ff5555; cursor:pointer; font-size:14px; font-weight:bold;'; closeBtn.onclick = toggleDebugPanel;
    controls.appendChild(minBtn); controls.appendChild(closeBtn); header.appendChild(controls); panel.appendChild(header);

    // Main Layout (Sidebar + Content)
    const mainLayout = document.createElement('div');
    mainLayout.style.cssText = 'display: flex; flex-grow: 1; overflow: hidden;';
    
    // Sidebar Menü
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

    // Content Box
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = 'flex-grow:1; padding:15px; overflow-y:auto; background:#131313;';
    mainLayout.appendChild(contentContainer);
    panel.appendChild(mainLayout);

    // CLI Command Bar
    const cliContainer = document.createElement('div');
    cliContainer.id = 'dev-cli';
    cliContainer.style.cssText = 'display:flex; background:#161616; border-top:1px solid #252525; padding:8px;';
    cliContainer.innerHTML = '<span style="color:#00ffaa; padding:4px 5px; font-weight:bold;">❯</span>';
    const cmdInput = document.createElement('input');
    cmdInput.type = 'text';
    cmdInput.placeholder = 'Type command (e.g. spawnRND; help; clear;) ...';
    cmdInput.style.cssText = 'flex-grow:1; background:transparent; border:none; color:#fff; font-family:inherit; font-size:12px; padding:4px; outline:none;';
    cliContainer.appendChild(cmdInput);
    panel.appendChild(cliContainer);

    document.body.appendChild(panel);

    // 4. MINIMIZE LOGIK
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

    // 5. TAB STEUERUNG
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
            contentContainer.innerHTML = '<span style="color:#555;">// Terminal ready. Type help; below for macro commands.</span>';
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

    // TAB: ITEM ENGINE (MIT DYNAMISCHEN EMOJI-BUTTONS)
    function renderItemsView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">Item Matrix Spawner</h3>';
        
        const rndBtn = document.createElement('button');
        rndBtn.innerText = '🎲 Spawn Random Item (spawnRND;)';
        rndBtn.style.cssText = 'width:100%; background:#8a1a8a; border:1px solid #ff00ff; color:#fff; padding:12px; cursor:pointer; border-radius:4px; font-weight:bold; margin-bottom:15px; font-family:inherit;';
        rndBtn.onclick = spawnRandomItem;
        contentContainer.appendChild(rndBtn);

        if (typeof ITEM_TYPES === 'undefined') {
            contentContainer.innerHTML += '<p style="color:#ff4444;">⚠️ ITEM_TYPES array globally not found.</p>';
            return;
        }

        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap:8px;';
        
        ITEM_TYPES.forEach(type => {
            const btn = document.createElement('button');
            const emojiPrefix = getItemEmoji(type);
            // Generiert das Format: Spawn [Emoji] [Name]
            btn.innerText = `Spawn ${emojiPrefix}${type}`;
            btn.style.cssText = 'background:#222; border:1px solid #3c3c3c; color:#fff; padding:10px; cursor:pointer; border-radius:4px; text-align:left; font-family:inherit; font-size:11px; transition: background 0.1s;';
            btn.onmouseover = () => btn.style.background = '#333';
            btn.onmouseout = () => btn.style.background = '#222';
            btn.onclick = () => spawnSingleItem(type);
            grid.appendChild(btn);
        });
        contentContainer.appendChild(grid);
    }

    // TAB: JSEXECUTE SCRIPT LOADER (NEU!)
    function renderJsExecuteView() {
        contentContainer.innerHTML = `
            <h3 style="margin:0 0 5px 0; color:#00ffaa;">JSexecute Injection Suite</h3>
            <p style="color:#888; font-size:11px; margin:0 0 15px 0;">Inject external scripts or mods live into the environment runtime.</p>
        `;

        const loaderBox = document.createElement('div');
        loaderBox.style.cssText = 'background:#161616; padding:15px; border-radius:6px; border:1px solid #2d2d2d; display:flex; flex-direction:column; gap:10px;';

        const label = document.createElement('label');
        label.innerText = 'External Script URL:';
        label.style.cssText = 'color:#fff; font-weight:bold; font-size:11px;';
        
        const urlInput = document.createElement('input');
        urlInput.type = 'text';
        urlInput.placeholder = 'https://example.com/mod-script.js';
        urlInput.style.cssText = 'background:#111; border:1px solid #444; color:#fff; padding:8px; border-radius:4px; font-family:inherit; outline:none; font-size:11px;';

        const injectBtn = document.createElement('button');
        injectBtn.innerText = '🚀 Inject & Execute Script';
        injectBtn.style.cssText = 'background:#005533; border:1px solid #00ffaa; color:#fff; padding:10px; font-weight:bold; border-radius:4px; cursor:pointer; font-family:inherit; transition: background 0.2s;';
        
        injectBtn.onclick = () => {
            const url = urlInput.value.trim();
            if(!url) { alert('Please enter a valid URL!'); return; }
            
            logToDebug('SYSTEM', `Attempting to load external script: ${url}`);
            
            const script = document.createElement('script');
            script.src = url;
            script.id = `js-injected-script-${scriptCounter++}`;
            
            script.onload = () => {
                logToDebug('RESULT', `Script successfully injected and executed: ${url}`);
                alert('Script loaded successfully!');
            };
            
            script.onerror = (err) => {
                logToDebug('ERROR', `Failed to inject script from source: ${url}`);
                alert('Failed to load script. Check Dev console for details.');
            };

            document.head.appendChild(script);
            urlInput.value = '';
        };

        loaderBox.appendChild(label);
        loaderBox.appendChild(urlInput);
        loaderBox.appendChild(injectBtn);
        contentContainer.appendChild(loaderBox);

        // Quick Presets inside Loader
        contentContainer.innerHTML += '<h4 style="margin:20px 0 10px 0; color:#00ffaa;">Useful Script Presets</h4>';
        const presets = [
            { name: 'Inject jQuery Framework', url: 'https://code.jquery.com/jquery-3.7.1.min.js' },
            { name: 'Inject FontAwesome Icons', url: 'https://kit.fontawesome.com/a076d05399.js' }
        ];

        presets.forEach(p => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:between; align-items:center; background:#222; padding:8px 12px; margin-bottom:5px; border-radius:4px; font-size:11px;';
            row.innerHTML = `<span style="flex-grow:1; color:#fff;">${p.name}</span>`;
            
            const pBtn = document.createElement('button');
            pBtn.innerText = 'Load';
            pBtn.style.cssText = 'background:#444; border:none; color:#00ffaa; padding:4px 8px; border-radius:3px; cursor:pointer; font-family:inherit; font-size:10px;';
            pBtn.onclick = () => { urlInput.value = p.url; };
            
            row.appendChild(pBtn);
            contentContainer.appendChild(row);
        });
    }

    function renderCheatsView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">Engine Macro Utilities</h3>';
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr; gap:10px;';

        const buttons = [
            { name: '🎨 Toggle Wireframes', act: () => document.querySelectorAll('*').forEach(el => el.style.outline = el.style.outline ? '' : '1px solid #00ffaa') },
            { name: '✏️ Document Edit Mode', act: () => document.designMode = document.designMode === 'on' ? 'off' : 'on' },
            { name: '🧹 Clear Browser Cache', act: () => { localStorage.clear(); sessionStorage.clear(); alert('Cache wiped.'); } },
            { name: '💀 Force Game Crash Simulation', act: () => { throw new Error("Overlord Dev Crash Triggered!"); } },
            { name: '🔄 Speed Reload Window', act: () => window.location.reload() },
            { name: '👁️ Hide All Text Nodes', act: () => document.querySelectorAll('*').forEach(el => { if(el.innerText) el.style.opacity = el.style.opacity === '0' ? '1' : '0'; }) }
        ];

        buttons.forEach(b => {
            const btn = document.createElement('button');
            btn.innerText = b.name;
            btn.style.cssText = 'background:#222; border:1px solid #3a3a3a; color:#fff; padding:10px; cursor:pointer; border-radius:4px; font-family:inherit; text-align:left; font-size:11px;';
            btn.onclick = b.act;
            grid.appendChild(btn);
        });
        contentContainer.appendChild(grid);
    }

    function renderDomView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">HTML Document Elements Tree</h3>';
        const pre = document.createElement('pre');
        pre.style.cssText = 'background:#050505; color:#a5d6ff; padding:10px; border-radius:4px; font-size:11px; max-height:450px; overflow:auto; white-space:pre-wrap; margin:0;';
        pre.innerText = document.documentElement.outerHTML.slice(0, 30000);
        contentContainer.appendChild(pre);
    }

    function renderStatsView() {
        contentContainer.innerHTML = '<h3 style="margin:0 0 15px 0; color:#00ffaa;">Live Metrics Dashboard</h3>';
        const box = document.createElement('div');
        box.style.cssText = 'background:#161616; padding:15px; border-radius:6px; line-height:2; font-size:12px;';
        
        setInterval(() => {
            if (currentTab === 'stats' && isPanelOpen && !isMinimized) {
                box.innerHTML = `
                    <b style="color:#ff00ff">🎮 Game Engine Stats:</b><br>
                    • Active Items in Engine (GS.items): <span style="color:#55ff55">${(typeof GS !== 'undefined' && GS.items) ? GS.items.length : 'N/A'}</span><br>
                    • Registered Item Prototypes: <span style="color:#55ff55">${typeof ITEM_TYPES !== 'undefined' ? ITEM_TYPES.length : 'N/A'}</span><br><br>
                    <b style="color:#00bfff">💻 Render & Hardware Diagnostics:</b><br>
                    • Engine Framerate: <span style="color:#00ffaa; font-weight:bold">${performanceStats.fps} FPS</span><br>
                    • Mouse Vector Coordinate: X: ${mousePos.x}px | Y: ${mousePos.y}px<br>
                    • Structural DOM Nodes: ${document.getElementsByTagName('*').length} elements<br>
                    • Input Key Register: <span style="color:#ce9178">${lastKey}</span>
                `;
            }
        }, 150);
        contentContainer.appendChild(box);
    }

    // 6. TERMINAL INTERPRETER (CLI MACROS)
    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && cmdInput.value.trim() !== '') {
            const command = cmdInput.value.trim();
            logToDebug('CMD', command);
            commandHistory.push(command);
            historyIndex = commandHistory.length;

            const cmdLower = command.toLowerCase().replace(';', '');

            if (cmdLower === 'spawnrnd') {
                spawnRandomItem();
            } else if (cmdLower === 'help') {
                logToDebug('SYSTEM', 'Available Commands:\n -> spawnRND; (Spawns random item)\n -> clear; (Clears log window)\n -> wireframe; (Toggles visual layouts)\n -> reload; (Refreshes game)\n -> edit; (Enables webpage editor)');
            } else if (cmdLower === 'clear') {
                devLogs.length = 0;
                updateConsoleView();
            } else if (cmdLower === 'wireframe') {
                document.querySelectorAll('*').forEach(el => el.style.outline = el.style.outline ? '' : '1px solid #00ffaa');
                logToDebug('SYSTEM', 'Wireframe styles toggled.');
            } else if (cmdLower === 'reload') {
                window.location.reload();
            } else if (cmdLower === 'edit') {
                document.designMode = document.designMode === 'on' ? 'off' : 'on';
                logToDebug('SYSTEM', `DesignMode is now: ${document.designMode}`);
            } else {
                try {
                    const result = window.eval(command);
                    logToDebug('RESULT', result !== undefined ? JSON.stringify(result) : 'undefined');
                } catch (err) {
                    logToDebug('ERROR', `Eval Error: ${err.message}`);
                }
            }
            cmdInput.value = '';
        }
        else if (e.key === 'ArrowUp' && historyIndex > 0) {
            historyIndex--; cmdInput.value = commandHistory[historyIndex];
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++; cmdInput.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length; cmdInput.value = '';
            }
        }
    });

    function toggleDebugPanel() {
        isPanelOpen = !isPanelOpen;
        panel.style.display = isPanelOpen ? 'flex' : 'none';
        if (isPanelOpen && !isMinimized) {
            switchTab(currentTab);
            setTimeout(() => { if(currentTab==='console') cmdInput.focus(); }, 50);
        }
    }
})();
