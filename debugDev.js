(function() {
    const devLogs = [];
    const commandHistory = [];
    let historyIndex = -1;
    let isPanelOpen = false;
    let isMinimized = false;
    let currentTab = 'console';
    let mousePos = { x: 0, y: 0 };
    let lastKey = 'None';

    // 1. KONSOLEN, FEHLER & GLOBAL TRACKING HOOKS
    const consoleTypes = ['log', 'error', 'warn', 'info', 'debug', 'dir'];
    consoleTypes.forEach(type => {
        const original = console[type];
        console[type] = function(...args) {
            logToDebug(type.toUpperCase(), args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : arg
            ).join(' '));
            original.apply(console, args);
        };
    });

    window.addEventListener('error', (e) => logToDebug('ERROR', `${e.message} (${e.filename}:${e.lineno})`));
    window.addEventListener('unhandledrejection', (e) => logToDebug('ERROR', `Promise Reject: ${e.reason}`));
    
    // Globale Inputs tracken für das Dashboard
    window.addEventListener('mousemove', (e) => { mousePos.x = e.clientX; mousePos.y = e.clientY; });
    window.addEventListener('keydown', (e) => { 
        lastKey = `${e.key} (Code: ${e.keyCode})`;
        // Secret Trigger check
        trackSecretTrigger(e.key);
    });

    function logToDebug(type, message) {
        const time = new Date().toLocaleTimeString();
        devLogs.push({ type, message, time });
        if (isPanelOpen && currentTab === 'console' && !isMinimized) updateConsoleView();
    }

    // 2. SECRET TRIGGER ("debug")
    let inputBuffer = "";
    function trackSecretTrigger(key) {
        if (key.length === 1) {
            inputBuffer += key;
            if (inputBuffer.toLowerCase().endsWith('debug')) {
                toggleDebugPanel();
                inputBuffer = ""; 
            }
        }
    }

    // 3. UI INITIALISIERUNG
    const panel = document.createElement('div');
    panel.id = 'dev-debug-panel';
    panel.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        width: 650px; height: 550px;
        background: #121212; color: #e0e0e0;
        font-family: 'Consolas', monospace; font-size: 12px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.9); border-radius: 10px;
        border: 1px solid #00ffaa; display: none;
        flex-direction: column; z-index: 999999; overflow: hidden;
        transition: height 0.15s ease-in-out, width 0.15s ease-in-out;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: #1e1e1e; padding: 12px; font-weight: bold;
        border-bottom: 1px solid #2d2d2d; display: flex;
        justify-content: space-between; align-items: center; color: #00ffaa;
        user-select: none;
    `;
    header.innerHTML = `<span>DarkFox Co. Ultimate Dev-Suite v5.0</span>`;
    
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 12px; align-items: center;';

    const minBtn = document.createElement('button');
    minBtn.innerText = '_';
    minBtn.style.cssText = 'background:transparent; border:none; color:#00ffaa; cursor:pointer; font-size:16px; font-weight:bold;';
    minBtn.onclick = toggleMinimize;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = 'background:transparent; border:none; color:#ff5555; cursor:pointer; font-size:14px; font-weight:bold;';
    closeBtn.onclick = toggleDebugPanel;
    
    controls.appendChild(minBtn);
    controls.appendChild(closeBtn);
    header.appendChild(controls);
    panel.appendChild(header);

    // Navigation Tabs
    const nav = document.createElement('div');
    nav.id = 'dev-nav';
    nav.style.cssText = `display: flex; background: #1a1a1a; border-bottom: 1px solid #2d2d2d;`;
    
    const tabs = {
        console: '🖥️ Terminal',
        elements: '🔍 DOM Explorer',
        items: '📦 Item Cheats',
        actions: '⚙️ Utilities',
        info: 'ℹ️ Diagnostics'
    };

    Object.keys(tabs).forEach(tabId => {
        const tabBtn = document.createElement('button');
        tabBtn.innerText = tabs[tabId];
        tabBtn.style.cssText = `
            flex: 1; padding: 10px; background: transparent; border: none;
            color: #888; cursor: pointer; font-family: inherit; font-size: 11px;
            border-bottom: 2px solid transparent; transition: all 0.2s;
        `;
        tabBtn.onclick = () => switchTab(tabId);
        nav.appendChild(tabBtn);
        tabs[tabId] = tabBtn; 
    });
    panel.appendChild(nav);

    // Main Content
    const contentContainer = document.createElement('div');
    contentContainer.id = 'dev-content';
    contentContainer.style.cssText = `flex-grow: 1; overflow-y: auto; background: #151515; padding: 12px;`;
    panel.appendChild(contentContainer);

    // CLI
    const cliContainer = document.createElement('div');
    cliContainer.id = 'dev-cli';
    cliContainer.style.cssText = `display: flex; background: #1a1a1a; border-top: 1px solid #2d2d2d; padding: 6px;`;
    cliContainer.innerHTML = `<span style="color: #00ffaa; padding: 5px 0 5px 5px; font-weight: bold;">❯ </span>`;
    const cmdInput = document.createElement('input');
    cmdInput.type = 'text';
    cmdInput.placeholder = 'Execute JavaScript instantly...';
    cmdInput.style.cssText = `flex-grow: 1; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 12px; padding: 5px; outline: none;`;
    cliContainer.appendChild(cmdInput);
    panel.appendChild(cliContainer);

    document.body.appendChild(panel);

    // 4. MINIMIZE LOGIK
    function toggleMinimize() {
        isMinimized = !isMinimized;
        if (isMinimized) {
            panel.style.height = '42px';
            panel.style.width = '280px';
            nav.style.display = 'none';
            contentContainer.style.display = 'none';
            cliContainer.style.display = 'none';
            minBtn.innerText = '⬜';
        } else {
            panel.style.height = '550px';
            panel.style.width = '650px';
            nav.style.display = 'flex';
            contentContainer.style.display = 'block';
            minBtn.innerText = '_';
            switchTab(currentTab);
        }
    }

    // 5. TAB CONTROL & RENDERING
    function switchTab(tabId) {
        currentTab = tabId;
        Object.keys(tabs).forEach(id => {
            tabs[id].style.color = (id === tabId) ? '#00ffaa' : '#888';
            tabs[id].style.background = (id === tabId) ? '#151515' : 'transparent';
            tabs[id].style.borderBottomColor = (id === tabId) ? '#00ffaa' : 'transparent';
        });

        contentContainer.innerHTML = '';
        cliContainer.style.display = (tabId === 'console') ? 'flex' : 'none';

        if (tabId === 'console') updateConsoleView();
        else if (tabId === 'elements') renderElementsView();
        else if (tabId === 'items') renderItemSpawnerView();
        else if (tabId === 'actions') renderUtilitiesView();
        else if (tabId === 'info') renderDiagnosticsView();
    }

    // TAB: TERMINAL (KONSOLEN INTERFACE)
    function updateConsoleView() {
        if (currentTab !== 'console') return;
        contentContainer.innerHTML = '';
        if (devLogs.length === 0) {
            contentContainer.innerHTML = '<span style="color: #555;">// System online. Hooked to all event logs.</span>';
            return;
        }
        devLogs.forEach(log => {
            const entry = document.createElement('div');
            entry.style.cssText = 'padding: 4px; border-bottom: 1px solid #1a1a1a; white-space: pre-wrap; font-size: 11px;';
            let color = '#d4d4d4';
            if (log.type === 'ERROR') color = '#ff4444';
            if (log.type === 'WARN') color = '#ff9900';
            if (log.type === 'CMD') color = '#00ffaa';
            if (log.type === 'RESULT') color = '#55ff55';
            if (log.type === 'INFO') color = '#00bfff';
            
            entry.style.color = color;
            entry.innerHTML = `<span style="color: #444;">[${log.time}]</span> <b>${log.type}:</b> ${log.message}`;
            contentContainer.appendChild(entry);
        });
        contentContainer.scrollTop = contentContainer.scrollHeight;
    }

    // TAB: DOM EXPLORER
    function renderElementsView() {
        contentContainer.innerHTML = '<h4 style="margin:0 0 10px 0; color:#00ffaa;">Live DOM OuterHTML (Truncated)</h4>';
        const pre = document.createElement('pre');
        pre.style.cssText = 'margin:0; font-size:11px; color:#4fc1ff; white-space: pre-wrap; background:#111; padding:10px; border-radius:4px; max-height:400px; overflow-y:auto;';
        pre.innerText = document.documentElement.outerHTML.slice(0, 25000) + '\n\n// ... End of Explorer Preview';
        contentContainer.appendChild(pre);
    }

    // TAB: ITEM CHEATS (DEINE DYNAMISCHE SPAWN ENGINE)
    function renderItemSpawnerView() {
        contentContainer.innerHTML = '<h4 style="margin:0 0 10px 0; color:#00ffaa;">Dynamic Game Item Spawner</h4>';
        
        if (typeof ITEM_TYPES === 'undefined' || typeof GS === 'undefined' || typeof Item === 'undefined') {
            contentContainer.innerHTML += `<div style="color:#ff4444; padding:10px; background:rgba(255,0,0,0.1); border-radius:4px;">
                ⚠️ <b>Engine-Fehler:</b> Globale Variablen (<code>ITEM_TYPES</code>, <code>GS</code>, oder <code>Item</code>) wurden auf dieser Seite nicht gefunden.<br>
                Stelle sicher, dass dieses Skript nach deinen Spiel-Skripten geladen wird!
            </div>`;
            return;
        }

        // Haupt-Trigger für "Spawne alle auf einmal"
        const spawnAllBtn = document.createElement('button');
        spawnAllBtn.innerText = `📦 SPAWN ALL (${ITEM_TYPES.length} TYPES AT ONCE)`;
        spawnAllBtn.style.cssText = 'width:100%; background:#1a4a3a; border:1px solid #00ffaa; color:#fff; padding:12px; cursor:pointer; border-radius:6px; font-weight:bold; margin-bottom:15px; font-family:inherit;';
        spawnAllBtn.onclick = () => {
            ITEM_TYPES.forEach(type => executeSpawn(type));
            console.log(`💥 All ${ITEM_TYPES.length} items spawned successfully.`);
        };
        contentContainer.appendChild(spawnAllBtn);

        // Grid für jeden einzelnen Typen generieren
        contentContainer.innerHTML += '<p style="color:#888; font-size:11px; margin: 10px 0;">Spawn single item types selectively:</p>';
        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px;';

        ITEM_TYPES.forEach((type, index) => {
            const singleBtn = document.createElement('button');
            singleBtn.innerText = `🔹 [${index}] Spawn: ${type}`;
            singleBtn.style.cssText = 'background:#222; border:1px solid #444; color:#fff; padding:8px; cursor:pointer; border-radius:4px; text-align:left; font-family:inherit; font-size:11px;';
            singleBtn.onmouseover = () => singleBtn.style.background = '#333';
            singleBtn.onmouseout = () => singleBtn.style.background = '#222';
            singleBtn.onclick = () => {
                executeSpawn(type);
                console.log(`💎 Spawned single item: ${type}`);
            };
            grid.appendChild(singleBtn);
        });
        contentContainer.appendChild(grid);
    }

    function executeSpawn(type) {
        const xPos = (typeof rnd === 'function' && typeof W !== 'undefined') ? rnd(W * .1, W * .9) : window.innerWidth / 2;
        const fyVal = typeof FY !== 'undefined' ? FY : 0;
        GS.items.push(new Item(xPos, -30, type, fyVal));
    }

    // TAB: UTILITIES (ANZEIGEN & CHEATS)
    function renderUtilitiesView() {
        contentContainer.innerHTML = '<h4 style="margin:0 0 10px 0; color:#00ffaa;">Global Page Modifiers</h4>';
        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;';

        const actions = [
            { name: '🎨 Toggle Wireframe Mode', action: () => { document.querySelectorAll('*').forEach(el => el.style.outline = el.style.outline ? '' : '1px solid #00ffaa'); }},
            { name: '✏️ Turn ContentEditable ON', action: () => { document.body.contentEditable = document.body.contentEditable === 'true' ? 'false' : 'true'; }},
            { name: '🗑️ Clear Local & Session Storage', action: () => { localStorage.clear(); sessionStorage.clear(); alert('All storages cleared!'); }},
            { name: '🔄 Force Window Reload', action: () => { window.location.reload(); }},
            { name: '🛑 Stop All CSS Animations', action: () => { document.querySelectorAll('*').forEach(el => el.style.animation = 'none'); }},
            { name: '🌈 Active Rainbow Theme', action: () => { document.body.style.animation = 'devRainbow 5s linear infinite'; if(!document.getElementById('dev-style-rb')){let s=document.createElement('style');s.id='dev-style-rb';s.innerHTML='@keyframes devRainbow{0%{background:#300;}50%{background:#030;}100%{background:#300;}}';document.head.appendChild(s);}}}
        ];

        actions.forEach(act => {
            const btn = document.createElement('button');
            btn.innerText = act.name;
            btn.style.cssText = 'background:#222; border:1px solid #3c3c3c; color:#fff; padding:8px; cursor:pointer; border-radius:4px; text-align:left; font-family:inherit; font-size:11px;';
            btn.onclick = act.action;
            grid.appendChild(btn);
        });
        contentContainer.appendChild(grid);
    }

    // TAB: DIAGNOSTICS (LIVE-INFOS & STATS)
    function renderDiagnosticsView() {
        contentContainer.innerHTML = '<h4 style="margin:0 0 10px 0; color:#00ffaa;">Live Environment Diagnostics</h4>';
        
        const monitor = document.createElement('div');
        monitor.style.cssText = 'background:#111; padding:10px; border-radius:6px; font-size:11px; line-height:1.6; margin-bottom:15px; border-left: 3px solid #00ffaa;';
        
        // Interaktiver Live-Updater für Maus und Keyboard
        setInterval(() => {
            if (currentTab === 'info' && isPanelOpen && !isMinimized) {
                monitor.innerHTML = `
                    <b>Maus-Koordinaten X/Y:</b> X: ${mousePos.x}px | Y: ${mousePos.y}px<br>
                    <b>Letzter Keypress:</b> <span style="color:#00ffaa;">${lastKey}</span><br>
                    <b>Total HTML Elements:</b> ${document.getElementsByTagName('*').length}<br>
                    <b>Active Cookies:</b> ${document.cookie ? 'Yes' : 'No Cookies found'}
                `;
            }
        }, 100);
        contentContainer.appendChild(monitor);

        const table = document.createElement('table');
        table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 11px;';
        const data = [
            ['Secure Context (HTTPS)', window.isSecureContext ? 'Yes' : 'No'],
            ['Viewport Dimension', `${window.innerWidth}x${window.innerHeight}`],
            ['Screen Total Size', `${window.screen.width}x${window.screen.height}`],
            ['Hardware Threads', navigator.hardwareConcurrency || 'N/A'],
            ['Browser Language', navigator.language]
        ];
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:6px; color:#9cdcfe; font-weight:bold; border-bottom:1px solid #222;">${row[0]}</td>
                <td style="padding:6px; color:#ce9178; border-bottom:1px solid #222;">${row[1]}</td>
            `;
            table.appendChild(tr);
        });
        contentContainer.appendChild(table);
    }

    // 6. CLI INPUT ENGINE
    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && cmdInput.value.trim() !== '') {
            const command = cmdInput.value;
            logToDebug('CMD', command);
            commandHistory.push(command);
            historyIndex = commandHistory.length;

            try {
                const result = window.eval(command);
                logToDebug('RESULT', result !== undefined ? JSON.stringify(result) : 'undefined');
            } catch (err) {
                logToDebug('ERROR', `Eval Error: ${err.message}`);
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
