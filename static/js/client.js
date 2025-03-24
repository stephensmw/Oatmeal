document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const terminalOutput = document.getElementById('terminal-output');
    const commandInput = document.getElementById('command-input');
    const connectButton = document.getElementById('connect-button');
    const disconnectButton = document.getElementById('disconnect-button');
    const clearButton = document.getElementById('clear-button');
    const sendButton = document.getElementById('send-button');
    const historyButton = document.getElementById('history-button');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const serverHost = document.getElementById('server-host');
    const serverPort = document.getElementById('server-port');
    const connectionName = document.getElementById('connection-name');
    const saveConnectionButton = document.getElementById('save-connection-button');
    const savedConnectionsList = document.getElementById('saved-connections-list');
    const historyModal = document.getElementById('history-modal');
    const closeHistoryModal = document.getElementById('close-history-modal');
    const commandHistoryList = document.getElementById('command-history-list');
    const fontSizeSelect = document.getElementById('font-size');
    const ansiColorsToggle = document.getElementById('ansi-colors');
    const puebloSupportToggle = document.getElementById('pueblo-support');
    const spellcheckToggle = document.getElementById('spellcheck');
    const autoReconnectToggle = document.getElementById('auto-reconnect');
    const autoLogToggle = document.getElementById('auto-log');
    const logFilename = document.getElementById('log-filename');
    const startLoggingButton = document.getElementById('start-logging-button');
    const stopLoggingButton = document.getElementById('stop-logging-button');
    const notification = document.getElementById('notification');
    const notificationMessage = document.getElementById('notification-message');
    const closeNotification = document.getElementById('close-notification');
    
    // Application state
    let isConnected = false;
    let commandHistory = [];
    let historyIndex = -1;
    let tempCommand = '';
    let puebloEnabled = false;
    let inPuebloHtmlMode = false;
    let isLogging = false;
    let autoLogEnabled = false;
    let autoReconnectEnabled = true;
    let reconnectAttempts = 0;
    let maxReconnectAttempts = 5;
    let reconnectInterval = null;
    let reconnectDelay = 5000; // 5 seconds
    let lastConnectionInfo = null;
    
    // Socket.IO connection
    const socket = io();
    
    // Event listeners
    connectButton.addEventListener('click', connectToServer);
    disconnectButton.addEventListener('click', disconnectFromServer);
    commandInput.addEventListener('keydown', handleCommandInput);
    clearButton.addEventListener('click', clearTerminal);
    sendButton.addEventListener('click', function() {
        const command = commandInput.value.trim();
        if (command) {
            sendCommand(command);
            commandInput.value = '';
            historyIndex = -1;
        }
    });
    historyButton.addEventListener('click', showHistoryModal);
    closeHistoryModal.addEventListener('click', hideHistoryModal);
    sidebarToggle.addEventListener('click', toggleSidebar);
    saveConnectionButton.addEventListener('click', saveConnection);
    closeNotification.addEventListener('click', hideNotification);
    fontSizeSelect.addEventListener('change', changeFontSize);
    ansiColorsToggle.addEventListener('change', toggleAnsiColors);
    puebloSupportToggle.addEventListener('change', togglePuebloSupport);
    spellcheckToggle.addEventListener('change', toggleSpellcheck);
    autoReconnectToggle.addEventListener('change', toggleAutoReconnect);
    autoLogToggle.addEventListener('change', toggleAutoLog);
    startLoggingButton.addEventListener('click', startLogging);
    stopLoggingButton.addEventListener('click', stopLogging);
    
    // Connection functions
    function connectToServer() {
        const host = serverHost.value.trim();
        const port = serverPort.value.trim();
        
        if (!host || !port) {
            showNotification('Please enter both host and port', 'error');
            return;
        }
        
        // Store connection info for potential reconnect attempts
        lastConnectionInfo = { host, port };
        
        // Reset reconnect attempts
        reconnectAttempts = 0;
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
        
        // Save autolog setting and send in connection request
        setConnectionStatus('connecting');
        socket.emit('connect_to_server', { 
            host, 
            port,
            auto_log: autoLogEnabled,
            log_filename: logFilename.value.trim() || null
        });
    }
    
    function disconnectFromServer() {
        socket.emit('disconnect_from_server');
    }
    
    // Socket event handlers
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        socket.emit('get_command_history');
        socket.emit('get_saved_connections');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        setConnectionStatus('disconnected');
    });
    
    socket.on('connection_status', (data) => {
        console.log('Connection status:', data);
    });
    
    socket.on('server_connected', (data) => {
        isConnected = true;
        setConnectionStatus('connected');
        enableCommandInput();
        showNotification(`Connected to ${data.host}:${data.port}`, 'success');
        
        // Add connection message to terminal
        appendToTerminal(`Connected to ${data.host}:${data.port}\n`, 'system-message');
        
        // Send Pueblo identification if enabled
        if (puebloEnabled) {
            setTimeout(() => {
                sendCommand('$#$#pueblo 1.0');
                appendToTerminal('Sent Pueblo identification\n', 'system-message');
            }, 1000); // Slight delay to ensure connection is fully established
        }
    });
    
    socket.on('server_disconnected', () => {
        isConnected = false;
        setConnectionStatus('disconnected');
        disableCommandInput();
        showNotification('Disconnected from server', 'warning');
        
        // Add disconnection message to terminal
        appendToTerminal('Disconnected from server\n', 'system-message');
    });
    
    socket.on('server_message', (data) => {
        let text = data.text;
        
        // Check for Pueblo HTML mode markers
        if (puebloEnabled) {
            // Check for Pueblo HTML start/end markers
            if (text.includes('$#$#')) {
                // Process Pueblo commands and tags
                if (text.includes('$#$#pueblo')) {
                    appendToTerminal('Server supports Pueblo HTML\n', 'system-message');
                    return;
                } else if (text.includes('$#$#html_start')) {
                    inPuebloHtmlMode = true;
                    appendToTerminal('Entering Pueblo HTML mode\n', 'system-message');
                    return;
                } else if (text.includes('$#$#html_end')) {
                    inPuebloHtmlMode = false;
                    appendToTerminal('Exiting Pueblo HTML mode\n', 'system-message');
                    return;
                }
            }
            
            // Handle HTML content in Pueblo mode
            if (inPuebloHtmlMode) {
                // Directly use HTML content in Pueblo mode
                const element = document.createElement('div');
                element.className = 'pueblo-html server-message';
                element.innerHTML = text;
                terminalOutput.appendChild(element);
                terminalOutput.scrollTop = terminalOutput.scrollHeight;
                return;
            }
        }
        
        // Regular text processing
        appendToTerminal(text + '\n', 'server-message');
    });
    
    socket.on('connection_error', (data) => {
        setConnectionStatus('disconnected');
        showNotification(data.error, 'error');
        appendToTerminal(`Error: ${data.error}\n`, 'error-message');
    });
    
    socket.on('server_disconnect', (data) => {
        isConnected = false;
        setConnectionStatus('disconnected');
        disableCommandInput();
        showNotification(data.message, 'warning');
        appendToTerminal(`${data.message}\n`, 'system-message');
    });
    
    socket.on('command_history', (data) => {
        commandHistory = data.history || [];
        historyIndex = -1;
        updateHistoryModal();
    });
    
    socket.on('saved_connections', (data) => {
        updateSavedConnectionsList(data.connections);
    });
    
    socket.on('connection_saved', (data) => {
        showNotification(`Connection "${data.name}" saved successfully`, 'success');
        socket.emit('get_saved_connections');
        connectionName.value = '';
    });
    
    socket.on('connection_deleted', (data) => {
        showNotification(`Connection "${data.name}" deleted`, 'success');
        socket.emit('get_saved_connections');
    });
    
    socket.on('logging_started', (data) => {
        isLogging = true;
        showNotification(`Logging started to ${data.filename}`, 'success');
        appendToTerminal(`Logging started to ${data.filename}\n`, 'system-message');
        startLoggingButton.disabled = true;
        stopLoggingButton.disabled = false;
    });
    
    socket.on('logging_stopped', () => {
        isLogging = false;
        showNotification('Logging stopped', 'info');
        appendToTerminal('Logging stopped\n', 'system-message');
        startLoggingButton.disabled = false;
        stopLoggingButton.disabled = true;
    });
    
    socket.on('logging_status', (data) => {
        isLogging = data.logging;
        if (isLogging) {
            appendToTerminal(`Currently logging to: ${data.filename}\n`, 'system-message');
            startLoggingButton.disabled = true;
            stopLoggingButton.disabled = false;
        } else {
            startLoggingButton.disabled = false;
            stopLoggingButton.disabled = true;
        }
    });
    
    socket.on('connection_lost', (data) => {
        isConnected = false;
        setConnectionStatus('disconnected');
        disableCommandInput();
        showNotification('Connection to server lost', 'error');
        appendToTerminal('Connection to server lost\n', 'error-message');
        
        // Store last connection info for auto-reconnect
        lastConnectionInfo = data;
        
        // Attempt auto-reconnect if enabled
        if (autoReconnectEnabled && !reconnectInterval) {
            attemptReconnect();
        }
    });
    
    // Terminal functions
    function appendToTerminal(text, className = '') {
        // Process ANSI codes if enabled
        if (ansiColorsToggle.checked) {
            text = MushFormatter.processAnsiCodes(text);
        }
        
        const element = document.createElement('div');
        element.className = className;
        
        // For raw HTML (when ANSI is processed)
        if (text.includes('<span')) {
            element.innerHTML = text;
        } else {
            element.textContent = text;
        }
        
        terminalOutput.appendChild(element);
        
        // Auto-scroll to bottom
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }
    
    function clearTerminal() {
        terminalOutput.innerHTML = '';
        appendToTerminal('Terminal cleared\n', 'system-message');
    }
    
    // Command handling
    function handleCommandInput(e) {
        if (!isConnected) return;
        
        // Handle key presses
        switch (e.key) {
            case 'Enter':
                // If Shift key is pressed, allow multiline (default behavior)
                if (!e.shiftKey) {
                    e.preventDefault();
                    const command = commandInput.value.trim();
                    if (command) {
                        sendCommand(command);
                        commandInput.value = '';
                        historyIndex = -1;
                    }
                }
                break;
                
            case 'ArrowUp':
                // Only navigate history if cursor is on the first line
                if (commandInput.selectionStart === 0 || 
                    commandInput.value.lastIndexOf('\n', commandInput.selectionStart - 1) === -1) {
                    e.preventDefault();
                    navigateHistory(-1);
                }
                break;
                
            case 'ArrowDown':
                // Only navigate history if cursor is on the last line
                const lastNewlinePos = commandInput.value.lastIndexOf('\n');
                if (lastNewlinePos === -1 || commandInput.selectionStart > lastNewlinePos) {
                    e.preventDefault();
                    navigateHistory(1);
                }
                break;
        }
    }
    
    function sendCommand(command) {
        socket.emit('send_command', { command });
        appendToTerminal(`> ${command}\n`, 'user-command');
    }
    
    function navigateHistory(direction) {
        if (commandHistory.length === 0) return;
        
        // Store current command when starting to navigate
        if (historyIndex === -1) {
            tempCommand = commandInput.value;
        }
        
        // Calculate new index
        historyIndex += direction;
        
        // Boundary checks
        if (historyIndex >= commandHistory.length) {
            historyIndex = commandHistory.length;
            commandInput.value = tempCommand;
            return;
        }
        
        if (historyIndex < 0) {
            historyIndex = -1;
            commandInput.value = tempCommand;
            return;
        }
        
        // Set command from history
        commandInput.value = commandHistory[commandHistory.length - 1 - historyIndex];
    }
    
    // UI state management
    function setConnectionStatus(status) {
        statusIndicator.className = 'status-indicator ' + status;
        
        switch (status) {
            case 'connected':
                statusText.textContent = 'Connected';
                connectButton.disabled = true;
                disconnectButton.disabled = false;
                break;
                
            case 'disconnected':
                statusText.textContent = 'Disconnected';
                connectButton.disabled = false;
                disconnectButton.disabled = true;
                break;
                
            case 'connecting':
                statusText.textContent = 'Connecting...';
                connectButton.disabled = true;
                disconnectButton.disabled = true;
                break;
        }
    }
    
    function enableCommandInput() {
        commandInput.disabled = false;
        sendButton.disabled = false;
        commandInput.focus();
    }
    
    function disableCommandInput() {
        commandInput.disabled = true;
        sendButton.disabled = true;
    }
    
    function showNotification(message, type = 'error') {
        notificationMessage.textContent = message;
        notification.className = `notification ${type}`;
        
        // Auto-hide after 5 seconds
        setTimeout(hideNotification, 5000);
    }
    
    function hideNotification() {
        notification.className = 'notification hidden';
    }
    
    // Settings functions
    function changeFontSize() {
        const size = fontSizeSelect.value;
        terminalOutput.style.fontSize = `${size}px`;
        commandInput.style.fontSize = `${size}px`;
    }
    
    function toggleAnsiColors() {
        // This affects new text only, existing text is not reprocessed
        if (ansiColorsToggle.checked) {
            terminalOutput.classList.remove('no-ansi');
        } else {
            terminalOutput.classList.add('no-ansi');
        }
    }
    
    function togglePuebloSupport() {
        puebloEnabled = puebloSupportToggle.checked;
        
        if (puebloEnabled) {
            // Send the Pueblo handshake command when connecting
            if (isConnected) {
                // Send the Pueblo client identification
                sendCommand('$#$#pueblo 1.0');
                appendToTerminal('Pueblo support enabled\n', 'system-message');
            }
        } else {
            appendToTerminal('Pueblo support disabled\n', 'system-message');
        }
    }
    
    function toggleSpellcheck() {
        commandInput.spellcheck = spellcheckToggle.checked;
        
        if (spellcheckToggle.checked) {
            appendToTerminal('Spellcheck enabled\n', 'system-message');
        } else {
            appendToTerminal('Spellcheck disabled\n', 'system-message');
        }
    }
    
    function toggleAutoReconnect() {
        autoReconnectEnabled = autoReconnectToggle.checked;
        
        if (autoReconnectEnabled) {
            appendToTerminal('Auto-reconnect enabled\n', 'system-message');
        } else {
            appendToTerminal('Auto-reconnect disabled\n', 'system-message');
            
            // Clear any existing reconnect interval
            if (reconnectInterval) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
                reconnectAttempts = 0;
            }
        }
    }
    
    function toggleAutoLog() {
        autoLogEnabled = autoLogToggle.checked;
        
        if (autoLogEnabled) {
            appendToTerminal('Auto-log at connect enabled\n', 'system-message');
        } else {
            appendToTerminal('Auto-log at connect disabled\n', 'system-message');
        }
    }
    
    function startLogging() {
        const filename = logFilename.value.trim() || null;  // Use null for default filename
        socket.emit('start_logging', { filename });
    }
    
    function stopLogging() {
        socket.emit('stop_logging');
    }
    
    function attemptReconnect() {
        // Clear any existing interval just to be safe
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
        
        reconnectAttempts = 0;
        
        // Start reconnection attempt interval
        reconnectInterval = setInterval(() => {
            if (!isConnected && lastConnectionInfo) {
                reconnectAttempts++;
                
                appendToTerminal(`Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}...\n`, 'system-message');
                
                // Try to reconnect
                const { host, port } = lastConnectionInfo;
                socket.emit('connect_to_server', { host, port });
                
                // Stop trying after max attempts
                if (reconnectAttempts >= maxReconnectAttempts) {
                    clearInterval(reconnectInterval);
                    reconnectInterval = null;
                    appendToTerminal(`Failed to reconnect after ${maxReconnectAttempts} attempts\n`, 'error-message');
                }
            } else {
                // We're connected, or there's no connection info to use
                clearInterval(reconnectInterval);
                reconnectInterval = null;
                reconnectAttempts = 0;
            }
        }, reconnectDelay);
    }
    
    // Sidebar and saved connections
    function toggleSidebar() {
        sidebar.classList.toggle('sidebar-hidden');
    }
    
    function saveConnection() {
        const name = connectionName.value.trim();
        const host = serverHost.value.trim();
        const port = serverPort.value.trim();
        
        if (!name || !host || !port) {
            showNotification('Please enter connection name, host, and port', 'error');
            return;
        }
        
        socket.emit('save_connection', { name, host, port });
    }
    
    function updateSavedConnectionsList(connections) {
        savedConnectionsList.innerHTML = '';
        
        if (!connections || connections.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-list-message';
            emptyMessage.textContent = 'No saved connections';
            savedConnectionsList.appendChild(emptyMessage);
            return;
        }
        
        connections.forEach(conn => {
            const item = document.createElement('div');
            item.className = 'saved-connection-item';
            
            const info = document.createElement('div');
            info.className = 'saved-connection-info';
            
            const name = document.createElement('div');
            name.className = 'saved-connection-name';
            name.textContent = conn.name;
            
            const host = document.createElement('div');
            host.className = 'saved-connection-host';
            host.textContent = `${conn.host}:${conn.port}`;
            
            info.appendChild(name);
            info.appendChild(host);
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'saved-connection-delete';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.title = 'Delete connection';
            
            // Add event listeners
            info.addEventListener('click', () => {
                serverHost.value = conn.host;
                serverPort.value = conn.port;
                connectionName.value = conn.name;
            });
            
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                socket.emit('delete_connection', { name: conn.name });
            });
            
            item.appendChild(info);
            item.appendChild(deleteBtn);
            savedConnectionsList.appendChild(item);
        });
    }
    
    // Command history modal
    function showHistoryModal() {
        updateHistoryModal();
        historyModal.classList.remove('hidden');
    }
    
    function hideHistoryModal() {
        historyModal.classList.add('hidden');
    }
    
    function updateHistoryModal() {
        commandHistoryList.innerHTML = '';
        
        if (!commandHistory || commandHistory.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-list-message';
            emptyMessage.textContent = 'No command history';
            commandHistoryList.appendChild(emptyMessage);
            return;
        }
        
        // Display in reverse order (newest first)
        [...commandHistory].reverse().forEach(cmd => {
            const item = document.createElement('div');
            item.className = 'command-history-item';
            item.textContent = cmd;
            
            item.addEventListener('click', () => {
                commandInput.value = cmd;
                hideHistoryModal();
                commandInput.focus();
            });
            
            commandHistoryList.appendChild(item);
        });
    }
    
    // Initial setup
    setConnectionStatus('disconnected');
    changeFontSize();
    
    // Set default values for connection
    if (!serverHost.value) serverHost.value = 'mush.pennmush.org';
    if (!serverPort.value) serverPort.value = '4201';
    
    // Initialize feature states
    commandInput.spellcheck = spellcheckToggle.checked;
    startLoggingButton.disabled = !isConnected;
    stopLoggingButton.disabled = !isLogging;
    
    // Check current logging status
    socket.emit('get_logging_status');
    
    // Welcome message
    appendToTerminal('Welcome to Oatmeal MUSH Client\n', 'system-message');
    appendToTerminal('Connect to a MUSH server to begin.\n', 'system-message');
});
