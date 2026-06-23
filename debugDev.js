(function() {
    const devLogs = [];
    const commandHistory = [];
    let historyIndex = -1;
    let isPanelOpen = false;
    let isMinimized = false;
    let currentTab = 'console';

    // 1. KONSOLEN & FEHLER HOOKS
    const consoleTypes = ['log', 'error', 'warn', 'info'];
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
    window.addEventListener('unhandledrejection', (e) => logToDebug('ERROR', `Promise: ${e.reason}`));

    function logToDebug(type, message) {
        const time = new Date().toLocaleTimeString();
        devLogs.push({ type, message, time });
        if (isPanelOpen && currentTab === 'console' && !isMinimized) updateConsoleView();
    }

    // 2. SECRET TRIGGER ("debug")
    let inputBuffer = "";
    window.addEventListener('keydown', (e) => {
        if (e.key.length === 1) {
            inputBuffer += e.key;
            if (inputBuffer.toLowerCase().endsWith('debug')) {
                toggleDebugPanel();
                inputBuffer = ""; 
            }
        }
    });

    // 3. UI INITIALISIERUNG
    const panel = document.createElement('div');
    panel.id = 'dev-debug-panel';
    panel.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        width: 550px; height: 500px;
        background: #1c1c1c; color: #e0e0e0;
        font-family: 'Consolas', monospace; font-size: 12px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.8); border-radius: 8px;
        border: 1px solid #3a3a3a; display: none;
        flex-direction: column; z-index: 999999; overflow: hidden;
        transition: height 0.15s ease-in-out, width 0.15s ease-in-out;
    `;

    // Header (Titel & Fenster-Kontrollen)
    const header = document.createElement('div');
    header.style.cssText = `
        background: #2d2d2d; padding: 10px; font-weight: bold;
        border-bottom: 1px solid #3a3a3a; display: flex;
        justify-content: space-between; align-items: center; color: #00ffaa;
        user-select: none;
    `;
    header.innerHTML = `<span>DarkFox Co. Dev Suite v4.0</span>`;
    
    const controls = document.createElement('div');
    controls.style.cssText = 'display: flex; gap: 12px; align-items: center;';

    const minBtn = document.createElement('button');
    minBtn.innerText = '_';
    minBtn.style.cssText = 'background:transparent; border:none; color:#aaa; cursor:pointer; font-size:14px; font-weight:bold; padding:0 2px;';
    minBtn.onclick = toggleMinimize;

    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = 'background:transparent; border:none; color:#ff5555; cursor:pointer; font-size:14px; font-weight:bold; padding:0 2px;';
    closeBtn.onclick = toggleDebugPanel;
    
    controls.appendChild(minBtn);
    controls.appendChild(closeBtn);
    header.appendChild(controls);
    panel.appendChild(header);

    // Navigation / Menüreiter
    const nav = document.createElement('div');
    nav.id = 'dev-nav';
    nav.style.cssText = `display: flex; background: #252526; border-bottom: 1px solid #3a3a3a;`;
    
    const tabs = {
        console: '🖥️ Console',
        elements: '🔍 Elements',
        network: '⚙️ Quick Actions',
        info: 'ℹ️ Sys Info'
    };

    Object.keys(tabs).forEach(tabId => {
        const tabBtn = document.createElement('button');
        tabBtn.innerText = tabs[tabId];
        tabBtn.style.cssText = `
            flex: 1; padding: 8px; background: transparent; border: none;
            color: #aaa; cursor: pointer; font-family: inherit; font-size: 11px;
            border-bottom: 2px solid transparent; transition: all 0.2s;
        `;
        tabBtn.onclick = () => switchTab(tabId);
        nav.appendChild(tabBtn);
        tabs[tabId] = tabBtn; 
    });
    panel.appendChild(nav);

    // Hauptinhalt-Container
    const contentContainer = document.createElement('div');
    contentContainer.id = 'dev-content';
    contentContainer.style.cssText = `flex-grow: 1; overflow-y: auto; background: #151515; padding: 10px; position: relative;`;
    panel.appendChild(contentContainer);

    // CLI
    const cliContainer = document.createElement('div');
    cliContainer.id = 'dev-cli';
    cliContainer.style.cssText = `display: flex; background: #252526; border-top: 1px solid #3a3a3a; padding: 5px;`;
    cliContainer.innerHTML = `<span style="color: #00ffaa; padding: 5px 0 5px 5px; font-weight: bold;">❯ </span>`;
    const cmdInput = document.createElement('input');
    cmdInput.type = 'text';
    cmdInput.placeholder = 'Enter JS command...';
    cmdInput.style.cssText = `flex-grow: 1; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 12px; padding: 5px; outline: none;`;
    cliContainer.appendChild(cmdInput);
    panel.appendChild(cliContainer);

    document.body.appendChild(panel);

    // 4. MINIMIZE LOGIK
    function toggleMinimize() {
        isMinimized = !isMinimized;
        if (isMinimized) {
            panel.style.height = '40px';
            panel.style.width = '250px';
            nav.style.display = 'none';
            contentContainer.style.display = 'none';
            cliContainer.style.display = 'none';
            minBtn.innerText = '⬜';
            minBtn.style.color = '#00ffaa';
        } else {
            panel.style.height = '500px';
            panel.style.width = '550px';
            nav.style.display = 'flex';
            contentContainer.style.display = 'block';
            minBtn.innerText = '_';
            minBtn.style.color = '#aaa';
            switchTab(currentTab);
        }
    }

    // 5. TAB LOGIK & INHALTE
    function switchTab(tabId) {
        currentTab = tabId;
        Object.keys(tabs).forEach(id => {
            tabs[id].style.color = (id === tabId) ? '#00ffaa' : '#aaa';
            tabs[id].style.background = (id === tabId) ? '#151515' : 'transparent';
            tabs[id].style.borderBottomColor = (id === tabId) ? '#00ffaa' : 'transparent';
        });

        contentContainer.innerHTML = '';
        cliContainer.style.display = (tabId === 'console') ? 'flex' : 'none';

        if (tabId === 'console') updateConsoleView();
        else if (tabId === 'elements') renderElementsView();
        else if (tabId === 'network') renderQuickActionsView();
        else if (tabId === 'info') renderInfoView();
    }

    function updateConsoleView() {
        if (currentTab !== 'console') return;
        contentContainer.innerHTML = '';
        if (devLogs.length === 0) {
            contentContainer.innerHTML = '<span style="color: #6a9955;">// Terminal clear. No logs recorded.</span>';
            return;
        }
        devLogs.forEach(log => {
            const entry = document.createElement('div');
            entry.style.cssText = 'padding: 3px; border-bottom: 1px solid #222; white-space: pre-wrap; font-size: 11px;';
            let color = '#d4d4d4';
            if (log.type === 'ERROR') color = '#ff5555';
            if (log.type === 'WARN') color = '#ffaa00';
            if (log.type === 'CMD') color = '#00ffaa';
            if (log.type === 'RESULT') color = '#55ff55';
            
            entry.style.color = color;
            entry.innerHTML = `<span style="color: #555;">[${log.time}]</span> <b>${log.type}:</b> ${log.message}`;
            contentContainer.appendChild(entry);
        });
        contentContainer.scrollTop = contentContainer.scrollHeight;
    }

    function renderElementsView() {
        contentContainer.innerHTML = '<h4 style="margin:0 0 10px 0; color:#00ffaa;">DOM Tree Body HTML</h4>';
        const pre = document.createElement('pre');
        pre.style.cssText = 'margin:0; font-size:11px; color:#4fc1ff; white-space: pre-wrap;';
        pre.innerText = document.body.innerHTML.slice(0, 15000) + (document.body.innerHTML.length > 15000 ? '\n... [truncated]' : '');
        contentContainer.appendChild(pre);
    }

    // TAB: QUICK ACTIONS + DEIN SPAWN BUTTON
    function renderQuickActionsView() {
        contentContainer.innerHTML = '<h4 style="margin:0 0 10px 0; color:#00ffaa;">Quick Cheats & Actions</h4>';
        const grid = document.createElement('div');
        grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;';

        // Dein Custom Spawner Button Definition
        const customSpawnAction = () => {
            if (typeof ITEM_TYPES !== 'undefined' && typeof GS !== 'undefined' && typeof Item !== 'undefined') {
                // Iteriert durch JEDEN existierenden Item-Typen und führt deinen Code aus
                ITEM_TYPES.forEach(type => {
                    const xPos = (typeof rnd === 'function' && typeof W !== 'undefined') ? rnd(W * .1, W * .9) : window.innerWidth / 2;
                    const fyVal = typeof FY !== 'undefined' ? FY : 0;
                    
                    GS.items.push(new Item(xPos, -30, type, fyVal));
                });
                console.log(` Spawned all ${ITEM_TYPES.length} ITEM_TYPES successfully!`);
            } else {
                console.error("Game variables (ITEM_TYPES, GS, Item) not found in global window scope!");
            }
        };

        const actions = [
            { name: '📦 SPAWN ALL ITEM_TYPES', action: customSpawnAction, highlight: true },
            { name: '💥 Trigger Test Error', action: () => { throw new Error("Manual Dev Crash Test!"); } },
            { name: '🎨 Toggle Wireframe Mode', action: () => {
                document.querySelectorAll('*').forEach(el => el.style.outline = el.style.outline ? '' : '1px solid #00ffaa');
            }},
            { name: '✏️ Turn ContentEditable ON', action: () => { document.body.contentEditable = document.body.contentEditable === 'true' ? 'false' : 'true'; }},
            { name: '🗑️ Clear LocalStorage', action: () => { localStorage.clear(); alert('LocalStorage wiped.'); }},
            { name: ' Reload Page', action: () => { window.location.reload(); }}
        ];

        actions.forEach(act => {
            const btn = document.createElement('button');
            btn.innerText = act.name;
            btn.style.cssText = `
                background: ${act.highlight ? '#1a4a3a' : '#2d2d2d'}; 
                border: 1px solid ${act.highlight ? '#00ffaa' : '#444'}; 
                color: #fff; padding: 8px; cursor: pointer; border-radius: 4px; 
                text-align: left; font-family: inherit; font-size: 11px; font-weight: ${act.highlight ? 'bold' : 'normal'};
            `;
            btn.onmouseover = () => btn.style.background = act.highlight ? '#22664f' : '#3d3d3d';
            btn.onmouseout = () => btn.style.background = act.highlight ? '#1a4a3a' : '#2d2d2d';
            btn.onclick = () => { act.action(); if(!act.highlight) switchTab('console'); };
            grid.appendChild(btn);
        });
        contentContainer.appendChild(grid);
    }

    function renderInfoView() {
        contentContainer.innerHTML = '<h4 style="margin:0 0 10px 0; color:#00ffaa;">System Specifications</h4>';
        const infoTable = document.createElement('table');
        infoTable.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 11px;';
        
        const data = [
            ['Current URL', window.location.href],
            ['Screen Resolution', `${window.screen.width}x${window.screen.height}`],
            ['Viewport Size', `${window.innerWidth}x${window.innerHeight}`],
            ['User Agent', navigator.userAgent]
        ];

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding: 6px 4px; color: #9cdcfe; font-weight:bold; border-bottom:1px solid #222; width:150px;">${row[0]}</td>
                <td style="padding: 6px 4px; color: #ce9178; border-bottom:1px solid #222; word-break: break-all;">${row[1]}</td>
            `;
            infoTable.appendChild(tr);
        });
        contentContainer.appendChild(infoTable);
    }

    // 6. CLI INPUT EXECUTION
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
