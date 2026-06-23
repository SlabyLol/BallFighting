(function() {
    // Speicher für Logs und Fehler
    const devLogs = [];
    let isPanelOpen = false;

    // Fehler und Konsolen-Inputs abfangen
    window.addEventListener('error', (event) => {
        logToDebug('ERROR', `${event.message} at ${event.filename}:${event.lineno}`);
    });

    const originalConsoleError = console.error;
    console.error = function(...args) {
        logToDebug('ERROR', args.join(' '));
        originalConsoleError.apply(console, args);
    };

    const originalConsoleLog = console.log;
    console.log = function(...args) {
        logToDebug('LOG', args.join(' '));
        originalConsoleLog.apply(console, args);
    };

    function logToDebug(type, message) {
        const time = new Date().toLocaleTimeString();
        devLogs.push({ type, message, time });
        updatePanel();
    }

    // "Debug" Secret-Code Erkennung
    let inputBuffer = "";
    window.addEventListener('keydown', (e) => {
        // Nur Buchstaben tracken
        if (e.key.length === 1) {
            inputBuffer += e.key;
            if (inputBuffer.toLowerCase().endsWith('debug')) {
                toggleDebugPanel();
                inputBuffer = ""; // Reset
            }
        }
    });

    // UI Panel erstellen
    const panel = document.createElement('div');
    panel.id = 'dev-debug-panel';
    panel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 350px;
        height: 400px;
        background: #1e1e1e;
        color: #00ff00;
        font-family: 'Courier New', monospace;
        font-size: 12px;
        box-shadow: 0 0 15px rgba(0,0,0,0.5);
        border-radius: 8px;
        border: 1px solid #333;
        display: none;
        flex-direction: column;
        z-index: 999999;
        overflow: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: #2d2d2d;
        padding: 10px;
        font-weight: bold;
        border-bottom: 1px solid #333;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    header.innerHTML = `<span>DarkFox Co. Dev Panel v1.0</span>`;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerText = 'X';
    closeBtn.style.cssText = 'background:transparent; border:none; color:#ff5555; cursor:pointer; font-weight:bold;';
    closeBtn.onclick = toggleDebugPanel;
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Log-Inhalt
    const logContainer = document.createElement('div');
    logContainer.style.cssText = `
        padding: 10px;
        flex-grow: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 5px;
    `;
    panel.appendChild(logContainer);

    // Quick Actions / System Info Unterseite
    const footer = document.createElement('div');
    footer.style.cssText = `
        background: #2d2d2d;
        padding: 5px 10px;
        font-size: 10px;
        color: #888;
        border-top: 1px solid #333;
    `;
    footer.innerText = `URL: ${window.location.pathname} | UA: ${navigator.userAgent.slice(0, 20)}...`;
    panel.appendChild(footer);

    document.body.appendChild(panel);

    function toggleDebugPanel() {
        isPanelOpen = !isPanelOpen;
        panel.style.display = isPanelOpen ? 'flex' : 'none';
        if (isPanelOpen) updatePanel();
    }

    function updatePanel() {
        logContainer.innerHTML = '';
        if (devLogs.length === 0) {
            logContainer.innerHTML = '<span style="color: #888;">No logs captured yet. Try causing an error!</span>';
            return;
        }

        devLogs.forEach(log => {
            const entry = document.createElement('div');
            entry.style.padding = '3px 0';
            entry.style.borderBottom = '1px solid #2a2a2a';
            
            if (log.type === 'ERROR') {
                entry.style.color = '#ff5555';
                entry.innerHTML = `[${log.time}] ❌ <b>${log.type}:</b> ${log.message}`;
            } else {
                entry.style.color = '#00ffff';
                entry.innerHTML = `[${log.time}] ℹ️ <b>${log.type}:</b> ${log.message}`;
            }
            logContainer.appendChild(entry);
        });
        logContainer.scrollTop = logContainer.scrollHeight;
    }
})();
