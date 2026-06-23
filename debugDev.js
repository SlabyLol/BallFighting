(function() {
    // Speicher für Logs und Historie
    const devLogs = [];
    const commandHistory = [];
    let historyIndex = -1;
    let isPanelOpen = false;

    // Alle Konsolen-Typen abfangen
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

    // Globale Laufzeitfehler abfangen
    window.addEventListener('error', (event) => {
        logToDebug('ERROR', `${event.message} (${event.filename}:${event.lineno})`);
    });

    // Unbehandelte Promise-Fehler abfangen
    window.addEventListener('unhandledrejection', (event) => {
        logToDebug('ERROR', `Unhandled Promise: ${event.reason}`);
    });

    function logToDebug(type, message) {
        const time = new Date().toLocaleTimeString();
        devLogs.push({ type, message, time });
        if (isPanelOpen) updatePanel();
    }

    // "Debug" Secret-Code Trigger
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

    // UI-Elemente erstellen
    const panel = document.createElement('div');
    panel.id = 'dev-debug-panel';
    panel.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        width: 450px; height: 500px;
        background: #181818; color: #f1f1f1;
        font-family: 'Consolas', 'Courier New', monospace; font-size: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.7); border-radius: 8px;
        border: 1px solid #333; display: none;
        flex-direction: column; z-index: 999999; overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: #252526; padding: 10px; font-weight: bold;
        border-bottom: 1px solid #3c3c3c; display: flex;
        justify-content: space-between; align-items: center; color: #00ffaa;
    `;
    header.innerHTML = `<span>DarkFox Co. Advanced Terminal v2.0</span>`;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerText = '✕';
    closeBtn.style.cssText = 'background:transparent; border:none; color:#ff5555; cursor:pointer; font-size:14px; font-weight:bold;';
    closeBtn.onclick = toggleDebugPanel;
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Log-Bereich
    const logContainer = document.createElement('div');
    logContainer.style.cssText = `
        padding: 10px; flex-grow: 1; overflow-y: auto;
        display: flex; flex-direction: column; gap: 4px; background: #1e1e1e;
    `;
    panel.appendChild(logContainer);

    // Command Line Interface (CLI) Bereich
    const cliContainer = document.createElement('div');
    cliContainer.style.cssText = `
        display: flex; background: #252526; border-top: 1px solid #3c3c3c; padding: 5px;
    `;
    
    const prefix = document.createElement('span');
    prefix.innerText = '❯ ';
    prefix.style.cssText = 'color: #00ffaa; padding: 5px 0 5px 5px; font-weight: bold;';
    
    const cmdInput = document.createElement('input');
    cmdInput.type = 'text';
    cmdInput.placeholder = 'Enter JS command... (e.g. alert("test"))';
    cmdInput.style.cssText = `
        flex-grow: 1; background: transparent; border: none;
        color: #fff; font-family: inherit; font-size: 12px;
        padding: 5px; outline: none;
    `;
    
    cliContainer.appendChild(prefix);
    cliContainer.appendChild(cmdInput);
    panel.appendChild(cliContainer);
    document.body.appendChild(panel);

    // Command-Ausführung logic
    cmdInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && cmdInput.value.trim() !== '') {
            const command = cmdInput.value;
            logToDebug('CMD', command);
            commandHistory.push(command);
            historyIndex = commandHistory.length;

            try {
                // Führt den Code im globalen Kontext aus
                const result = window.eval(command);
                logToDebug('RESULT', result !== undefined ? result : 'undefined');
            } catch (err) {
                logToDebug('ERROR', `Eval Error: ${err.message}`);
            }
            
            cmdInput.value = '';
        }
        // History durchsuchen mit Pfeiltasten hoch/runter
        else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) {
                historyIndex--;
                cmdInput.value = commandHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                cmdInput.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                cmdInput.value = '';
            }
        }
    });

    function toggleDebugPanel() {
        isPanelOpen = !isPanelOpen;
        panel.style.display = isPanelOpen ? 'flex' : 'none';
        if (isPanelOpen) {
            updatePanel();
            setTimeout(() => cmdInput.focus(), 50); // Autofokus auf Eingabe
        }
    }

    function updatePanel() {
        logContainer.innerHTML = '';
        if (devLogs.length === 0) {
            logContainer.innerHTML = '<span style="color: #6a9955;">// Terminal ready. No logs yet.</span>';
            return;
        }

        devLogs.forEach(log => {
            const entry = document.createElement('div');
            entry.style.cssText = 'padding: 4px; border-radius: 3px; line-height: 1.4; white-space: pre-wrap;';
            
            let color = '#fff';
            let icon = 'ℹ️';

            switch(log.type) {
                case 'ERROR':
                    color = '#f44336'; icon = '❌';
                    entry.style.background = 'rgba(244, 67, 54, 0.1)';
                    break;
                case 'WARN':
                    color = '#ff9800'; icon = '⚠️';
                    entry.style.background = 'rgba(255, 152, 0, 0.1)';
                    break;
                case 'INFO':
                    color = '#2196f3'; icon = '🔷';
                    break;
                case 'CMD':
                    color = '#00ffaa'; icon = '❯';
                    break;
                case 'RESULT':
                    color = '#a0a0a0'; icon = '◀';
                    entry.style.borderLeft = '3px solid #6a9955';
                    break;
                default: // LOG
                    color = '#d4d4d4'; icon = '📝';
            }

            entry.style.color = color;
            entry.innerHTML = `<span style="color: #666; font-size: 10px;">[${log.time}]</span> ${icon} <b>${log.type}:</b> ${log.message}`;
            logContainer.appendChild(entry);
        });
        logContainer.scrollTop = logContainer.scrollHeight;
    }
})();
