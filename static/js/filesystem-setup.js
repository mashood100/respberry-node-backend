// File System Setup Functions for Game Hub

async function setupNewGameAdvanced() {
    try {
        // Show options dialog with both quick replace and file picker
        const settingsContent = document.querySelector('.settings-content');
        settingsContent.innerHTML = `
            <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
                ✕
            </div>
            <div class="settings-header">
                <h2 class="settings-title">🎮 Install New Game</h2>
                <p class="settings-subtitle">Load a trivia game from your USB drive</p>
            </div>
            
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 6em; margin-bottom: 20px;">💾</div>
                <div style="background: #e8f5e8; border: 2px solid #28a745; border-radius: 15px; padding: 25px; margin: 20px 0; max-width: 500px; margin-left: auto; margin-right: auto;">
                    <h3 style="color: #155724; margin: 0 0 15px 0;">Ready to Install</h3>
                    <p style="color: #155724; margin: 0 0 15px 0; font-size: 1.1em;">Connect your USB drive with a trivia_game folder and we'll automatically detect and install it for you.</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 10px 0;">
                        <p style="margin: 0; color: #495057; font-size: 0.9em;">🔍 <strong>Auto-Detection:</strong> We'll scan your USB drives and find trivia games automatically!</p>
                    </div>
                </div>
                <div class="settings-actions">
                    <button class="settings-btn settings-btn-success" onclick="showDrivePicker()">
                        🚀 Find & Install Games
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error showing options:', error);
        showError('Failed to show setup options: ' + error.message);
    }
}



async function executeReplaceTriviaFolder(sourcePath) {
    const settingsContent = document.querySelector('.settings-content');
    
    // Ensure sourcePath is provided
    if (!sourcePath) {
        showError('No source path provided for trivia folder replacement');
        return;
    }
    
    // Show processing state
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">⚙️ Installing Game</h2>
            <p class="settings-subtitle">Please wait...</p>
        </div>
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4em; animation: bounce 1s ease-in-out infinite;">🎮</div>
            <p style="margin-top: 20px; font-size: 1.2em;">Installing your trivia game...</p>
        </div>
        <style>
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-20px); }
            }
        </style>
    `;

    try {
        const response = await fetch('/api/replace-trivia-folder/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sourcePath: sourcePath })
        });

        const data = await response.json();

        if (data.success) {
            showReplaceSuccess(data.message, data.details);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error replacing trivia folder:', error);
        showError('Failed to replace trivia folder: ' + error.message);
    }
}

function showReplaceSuccess(message, details) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">✅ Game Installed Successfully!</h2>
            <p class="settings-subtitle">Your trivia game is ready to play</p>
        </div>
        
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 6em; margin-bottom: 20px;">🎉</div>
            <div style="background: #d4edda; border: 2px solid #28a745; border-radius: 15px; padding: 30px; margin: 20px 0; max-width: 400px; margin-left: auto; margin-right: auto;">
                <h3 style="color: #155724; margin: 0 0 15px 0;">Game Ready!</h3>
                <p style="color: #155724; margin: 0; font-size: 1.2em;">Your trivia game has been installed and is ready to play.</p>
            </div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-success" onclick="closeSettingsModal()">
                🎮 Start Playing
            </button>
            <button class="settings-btn settings-btn-secondary" onclick="setupNewGameAdvanced()">
                📁 Install Another Game
            </button>
        </div>
    `;
}

function showError(errorMessage) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">❌ Installation Failed</h2>
            <p class="settings-subtitle">Something went wrong</p>
        </div>
        
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4em; margin-bottom: 20px;">😞</div>
            <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 15px; padding: 25px; margin: 20px 0; max-width: 400px; margin-left: auto; margin-right: auto;">
                <h3 style="color: #721c24; margin: 0 0 15px 0;">Installation Error</h3>
                <p style="color: #721c24; margin: 0; font-size: 1.1em;">Unable to install the game. Please try again.</p>
            </div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-primary" onclick="setupNewGameAdvanced()">
                🔄 Try Again
            </button>
            <button class="settings-btn settings-btn-secondary" onclick="closeSettingsModal()">
                ← Close
            </button>
        </div>
    `;
} 

async function showDrivePicker() {
    try {
        // Show loading state
        const settingsContent = document.querySelector('.settings-content');
        settingsContent.innerHTML = `
            <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
                ✕
            </div>
            <div class="settings-header">
                <h2 class="settings-title">🔄 Detecting USB Drives</h2>
                <p class="settings-subtitle">Scanning for external USB storage...</p>
            </div>
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3em; animation: spin 2s linear infinite;">💾</div>
                <p style="margin-top: 20px; font-size: 1.2em;">Looking for connected USB drives...</p>
            </div>
            <style>
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            </style>
        `;

        // Fetch available drives
        const response = await fetch('/api/filesystem/drives/');
        const data = await response.json();

        if (!data.success) {
            showNoUsbMessage(data.message || 'Failed to detect USB drives');
            return;
        }

        if (data.drives.length === 0) {
            showNoUsbMessage('No USB drives detected. Please connect a USB drive and try again.');
            return;
        }

        // Auto-scan for trivia_game folders on detected USB drives
        autoScanForTriviaGames(data.drives);
    } catch (error) {
        console.error('Error loading drives:', error);
        showNoUsbMessage('Failed to detect USB drives: ' + error.message);
    }
}

async function autoScanForTriviaGames(drives) {
    const settingsContent = document.querySelector('.settings-content');
    
    // Show scanning state
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">🔍 Scanning for Games</h2>
            <p class="settings-subtitle">Looking for trivia games on your USB drives...</p>
        </div>
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 3em; animation: spin 2s linear infinite;">🎮</div>
            <p style="margin-top: 20px; font-size: 1.2em;">Scanning USB drives for trivia_game folders...</p>
        </div>
    `;

    const foundGames = [];
    
    // Scan each USB drive for trivia_game folders
    for (const drive of drives) {
        try {
            const response = await fetch('/api/filesystem/browse/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderPath: drive.path })
            });
            
            const data = await response.json();
            if (data.success && data.folders) {
                // Look for trivia_game folders
                const triviaGames = data.folders.filter(folder => 
                    folder.name.toLowerCase() === 'trivia_game'
                );
                
                triviaGames.forEach(game => {
                    foundGames.push({
                        ...game,
                        driveName: drive.name,
                        drivePath: drive.path
                    });
                });
            }
        } catch (error) {
            console.error(`Error scanning drive ${drive.name}:`, error);
        }
    }
    
    if (foundGames.length > 0) {
        showFoundGames(foundGames);
    } else {
        showManualBrowseOption(drives);
    }
}

function showFoundGames(games) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">🎮 Games Found!</h2>
            <p class="settings-subtitle">Found ${games.length} trivia game${games.length > 1 ? 's' : ''} on your USB drives</p>
        </div>
        
        <div style="padding: 20px;">
            <h3 style="margin: 0 0 15px 0; text-align: center;">Select a game to install:</h3>
            <div style="display: flex; flex-direction: column; gap: 10px; max-height: 300px; overflow-y: auto;">
                ${games.map(game => `
                    <div class="game-item" onclick="confirmInstallGame('${game.path.replace(/'/g, "\\'")}', '${game.driveName.replace(/'/g, "\\'")}')">
                        <div style="display: flex; align-items: center; padding: 15px; border: 2px solid #28a745; border-radius: 10px; background: #f8f9fa; cursor: pointer; transition: all 0.3s ease;">
                            <div style="font-size: 2em; margin-right: 15px;">🎮</div>
                            <div style="flex: 1;">
                                <div style="font-weight: bold; font-size: 1.1em; color: #333;">Trivia Game</div>
                                <div style="font-size: 0.9em; color: #666;">From: ${game.driveName}</div>
                            </div>
                            <div style="font-size: 1.5em; color: #28a745;">→</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>

        <div class="settings-actions" style="margin-top: 20px;">
            <button class="settings-btn settings-btn-secondary" onclick="setupNewGameAdvanced()">
                ← Back
            </button>
            <button class="settings-btn settings-btn-secondary" onclick="showDrivePicker()">
                📁 Browse Manually
            </button>
        </div>
    `;

    // Add hover effect for game items
    if (!document.getElementById('game-item-styles')) {
        const style = document.createElement('style');
        style.id = 'game-item-styles';
        style.textContent = `
            .game-item:hover > div {
                border-color: #007bff !important;
                background: #e8f4fd !important;
                transform: translateX(5px);
            }
        `;
        document.head.appendChild(style);
    }
}

function showManualBrowseOption(drives) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">🔍 No Games Found</h2>
            <p class="settings-subtitle">No trivia_game folders found automatically</p>
        </div>
        
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4em; margin-bottom: 20px;">📁</div>
            <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 15px; padding: 25px; margin: 20px 0; max-width: 500px; margin-left: auto; margin-right: auto;">
                <h3 style="color: #856404; margin: 0 0 15px 0;">Manual Browse Required</h3>
                <p style="color: #856404; margin: 0; font-size: 1.1em;">We couldn't find any trivia_game folders automatically. You can browse your USB drives manually to find and install your game.</p>
            </div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-secondary" onclick="setupNewGameAdvanced()">
                ← Back
            </button>
            <button class="settings-btn settings-btn-primary" onclick="showDriveSelection(${JSON.stringify(drives).replace(/"/g, '&quot;')})">
                📁 Browse USB Drives
            </button>
        </div>
    `;
}

function confirmInstallGame(gamePath, driveName) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">🎮 Install Game?</h2>
            <p class="settings-subtitle">Ready to install this trivia game</p>
        </div>
        
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4em; margin-bottom: 20px;">🎮</div>
            <div style="background: #e8f5e8; border: 2px solid #28a745; border-radius: 15px; padding: 25px; margin: 20px 0; max-width: 400px; margin-left: auto; margin-right: auto;">
                <h3 style="color: #155724; margin: 0 0 15px 0;">Ready to Install</h3>
                <p style="color: #155724; margin: 0; font-size: 1.1em;">Install trivia game from ${driveName}?</p>
            </div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-secondary" onclick="showDrivePicker()">
                ← Back
            </button>
            <button class="settings-btn settings-btn-success" onclick="executeReplaceTriviaFolder('${gamePath}')">
                🎮 Install Game
            </button>
        </div>
    `;
}

function showNoUsbMessage(message) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">💾 USB Drive Not Connected</h2>
            <p class="settings-subtitle">Please connect a USB drive to continue</p>
        </div>
        
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 6em; margin-bottom: 20px;">🔌</div>
            <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 15px; padding: 25px; margin: 20px 0; max-width: 500px; margin-left: auto; margin-right: auto;">
                <h3 style="color: #856404; margin: 0 0 15px 0;">USB Drive Required</h3>
                <p style="color: #856404; margin: 0 0 15px 0; font-size: 1.1em;">${message}</p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 15px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #495057;">Instructions:</h4>
                    <ol style="text-align: left; color: #495057; margin: 0; padding-left: 20px;">
                        <li>Connect your USB drive to the Raspberry Pi</li>
                        <li>Wait for it to be automatically mounted</li>
                        <li>Click "Try Again" to detect the USB drive</li>
                        <li>Browse your USB drive for trivia_game folders</li>
                    </ol>
                </div>
            </div>
        </div>

        <div class="settings-actions" style="margin-top: 30px;">
            <button class="settings-btn settings-btn-secondary" onclick="setupNewGameAdvanced()">
                ← Back to Setup
            </button>
            <button class="settings-btn settings-btn-primary" onclick="showDrivePicker()">
                🔄 Try Again
            </button>
        </div>
    `;
}

function showDriveSelection(drives) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">💾 Select USB Drive</h2>
            <p class="settings-subtitle">Choose a USB drive to browse for your trivia folder</p>
        </div>
        <div class="settings-section">
            <h3 class="settings-section-title">Available USB Drives</h3>
            <div class="drive-list" id="drive-list">
                ${drives.map(drive => `
                    <div class="drive-item" onclick="selectDrive('${drive.path}', '${drive.name}')" 
                         title="Click to browse ${drive.name}">
                        <div class="drive-icon">
                            💾
                        </div>
                        <div class="drive-info">
                            <div class="drive-name">${drive.name}</div>
                            <div class="drive-path">${drive.path}</div>
                            <div style="font-size: 0.8em; color: #28a745; font-weight: bold; margin-top: 2px;">
                                ✅ USB Drive Connected
                            </div>
                        </div>
                        <div class="drive-arrow">→</div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="settings-section">
            <div class="settings-actions">
                <button class="settings-btn settings-btn-secondary" onclick="setupNewGameAdvanced()">
                    ← Back to Setup
                </button>
                <button class="settings-btn settings-btn-secondary" onclick="showDrivePicker()">
                    🔄 Refresh USB Drives
                </button>
            </div>
        </div>
    `;

    // Add CSS for drive list if not exists
    if (!document.getElementById('drive-list-styles')) {
        const style = document.createElement('style');
        style.id = 'drive-list-styles';
        style.textContent = `
            .drive-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-height: 300px;
                overflow-y: auto;
                padding: 10px;
            }
            .drive-item {
                display: flex;
                align-items: center;
                padding: 15px;
                border: 2px solid #ddd;
                border-radius: 10px;
                background: #f8f9fa;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .drive-item:hover {
                border-color: #007bff;
                background: #e8f4fd;
                transform: translateX(5px);
            }
            .drive-icon {
                font-size: 2em;
                margin-right: 15px;
            }
            .drive-info {
                flex: 1;
            }
            .drive-name {
                font-weight: bold;
                font-size: 1.1em;
                color: #333;
            }
            .drive-path {
                font-size: 0.9em;
                color: #666;
                font-family: 'Courier New', monospace;
                background: #eee;
                padding: 2px 6px;
                border-radius: 4px;
                margin-top: 5px;
                display: inline-block;
            }
            .drive-arrow {
                font-size: 1.5em;
                color: #007bff;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }
}

async function selectDrive(drivePath, driveName) {
    try {
        showFolderBrowser(drivePath, driveName);
    } catch (error) {
        console.error('Error selecting drive:', error);
        showError('Failed to access location: ' + error.message);
    }
}

async function showFolderBrowser(currentPath, locationName) {
    const settingsContent = document.querySelector('.settings-content');
    
    // Show loading state
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">📁 Browse Folders</h2>
            <p class="settings-subtitle">Select location for trivia game folder</p>
        </div>
        <div style="text-align: center; padding: 20px;">
            <div style="font-size: 2em; animation: spin 1s linear infinite;">📂</div>
            <p>Loading folders...</p>
        </div>
    `;

    try {
        const response = await fetch('/api/filesystem/browse/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderPath: currentPath })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || 'Failed to browse folders');
        }

        displayFolderBrowser(data.currentPath, data.folders, locationName);
    } catch (error) {
        console.error('Error browsing folders:', error);
        showError('Failed to browse folders: ' + error.message);
    }
}

function displayFolderBrowser(currentPath, folders, locationName) {
    const settingsContent = document.querySelector('.settings-content');
    
    // Get parent path for "Up" button - simple implementation
    let parentPath = null;
    if (currentPath !== '/' && currentPath.length > 1) {
        const parts = currentPath.split('/').filter(p => p);
        parts.pop(); // Remove last part
        parentPath = '/' + parts.join('/');
        if (parentPath === '/') parentPath = '/';
    }

    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">📁 Browse USB Drive</h2>
            <p class="settings-subtitle">USB Drive: ${locationName || currentPath}</p>
        </div>
        
        <div class="folder-browser">
            <div class="current-path">
                <strong>📍 Current Path:</strong> 
                <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; font-family: monospace;">
                    ${currentPath}
                </code>
            </div>
            
             <div class="folder-actions" style="margin: 15px 0;">
                 ${parentPath && parentPath !== currentPath ? `
                    <button class="settings-btn settings-btn-secondary" onclick="showFolderBrowser('${parentPath}', 'Parent Folder')" style="margin-right: 10px;">
                      Back
                   </button>
               ` : ''}
           

            <div class="folder-list" style="max-height: 250px; overflow-y: auto; border: 2px solid #ddd; border-radius: 8px; padding: 10px;">
                ${folders.length === 0 ? 
                    '<p style="text-align: center; color: #666; padding: 20px;">No folders found in this location</p>' 
                    : 
                                         folders.map(folder => {
                         const isTriviaGame = folder.name.toLowerCase() === 'trivia_game';
                         const onclickAction = isTriviaGame 
                             ? `confirmReplaceTriviaGame('${folder.path.replace(/'/g, "\\'")}')` 
                             : `showFolderBrowser('${folder.path.replace(/'/g, "\\'")}', '${folder.name.replace(/'/g, "\\'")}')`; 
                         return `
                             <div class="folder-item ${isTriviaGame ? 'trivia-game-folder' : ''}" onclick="${onclickAction}">
                                 <span class="folder-icon">${isTriviaGame ? '🎮' : '📂'}</span>
                                 <span class="folder-name">${folder.name}${isTriviaGame ? ' (Click to Replace)' : ''}</span>
                                 <span class="folder-arrow">${isTriviaGame ? '🔄' : '→'}</span>
                             </div>
                         `;
                     }).join('')
                }
            </div>
        </div>

        <div class="settings-actions" style="margin-top: 20px;">
            <button class="settings-btn settings-btn-secondary" onclick="showDrivePicker()">
                ← Back to USB Drives
            </button>
        </div>
    `;

    // Add folder browser CSS if not exists
    if (!document.getElementById('folder-browser-styles')) {
        const style = document.createElement('style');
        style.id = 'folder-browser-styles';
        style.textContent = `
            .folder-browser {
                margin: 20px 0;
            }
            .current-path {
                background: #f8f9fa;
                padding: 10px;
                border-radius: 8px;
                margin-bottom: 15px;
                font-size: 0.9em;
            }
            .folder-item {
                display: flex;
                align-items: center;
                padding: 8px 12px;
                margin: 2px 0;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .folder-item:hover {
                background: #e8f4fd;
                border-left: 4px solid #007bff;
            }
            .folder-icon {
                margin-right: 10px;
                font-size: 1.2em;
            }
            .folder-name {
                flex: 1;
                font-weight: 500;
            }
            .folder-arrow {
                color: #007bff;
                font-weight: bold;
            }
            .trivia-game-folder {
                background-color: #f0f7fa; /* Light blue background */
                border-left: 4px solid #40c4ff; /* Blue border */
            }
            .trivia-game-folder:hover {
                background-color: #e0f2f7; /* Slightly darker blue on hover */
            }
        `;
        document.head.appendChild(style);
    }
}

function confirmReplaceTriviaGame(sourcePath) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">🎮 Install This Game?</h2>
            <p class="settings-subtitle">Ready to install trivia game</p>
        </div>
        
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4em; margin-bottom: 20px;">🎮</div>
            <div style="background: #e8f5e8; border: 2px solid #28a745; border-radius: 15px; padding: 25px; margin: 20px 0; max-width: 400px; margin-left: auto; margin-right: auto;">
                <h3 style="color: #155724; margin: 0 0 15px 0;">Trivia Game Found!</h3>
                <p style="color: #155724; margin: 0; font-size: 1.1em;">Install this trivia game and start playing?</p>
            </div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-secondary" onclick="showFolderBrowser('${sourcePath.substring(0, sourcePath.lastIndexOf('/'))}', 'Parent Folder')">
                ← Back
            </button>
            <button class="settings-btn settings-btn-success" onclick="executeReplaceTriviaFolder('${sourcePath}')">
                🎮 Install Game
            </button>
        </div>
    `;
}

async function executeCustomGameSetup(targetPath) {
    const settingsContent = document.querySelector('.settings-content');
    
    // Show processing state
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">⚙️ Creating Trivia Folder</h2>
            <p class="settings-subtitle">Please wait...</p>
        </div>
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4em; animation: bounce 1s ease-in-out infinite;">🥧</div>
            <p style="margin-top: 20px; font-size: 1.2em;">Creating trivia folder at custom location...</p>
        </div>
        <style>
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-20px); }
            }
        </style>
    `;

    try {
        const response = await fetch('/api/filesystem/setup-game/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                targetPath: targetPath,
                folderName: 'trivia_game'
            })
        });

        const data = await response.json();

        if (data.success) {
            showCustomSetupSuccess(data.message, data.details);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Error setting up custom trivia folder:', error);
        showError('Failed to create trivia folder: ' + error.message);
    }
}

function showCustomSetupSuccess(message, details) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">✅ Custom Setup Complete!</h2>
            <p class="settings-subtitle">Trivia folder created at custom location</p>
        </div>
        
        <div style="background: #d4edda; border: 2px solid #28a745; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h4 style="margin: 0 0 15px 0; color: #155724;">🎉 Success!</h4>
            <p style="color: #155724; margin-bottom: 15px;">${message}</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <h5 style="margin: 0 0 10px 0;">📁 Details:</h5>
                <p><strong>Folder:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px;">${details.folderCreated}</code></p>
                ${details.folderExisted ? `<p><strong>Previous folder:</strong> Successfully replaced</p>` : ''}
                <p><strong>Ready to use:</strong> New trivia questions loaded</p>
            </div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-primary" onclick="setupNewGameAdvanced()">
                🔄 Setup Another Location
            </button>
            <button class="settings-btn settings-btn-success" onclick="closeSettingsModal()">
                ✅ Done
            </button>
        </div>
    `;
} 