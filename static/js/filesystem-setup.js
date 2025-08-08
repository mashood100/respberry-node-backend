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
                <h2 class="settings-title">🎮 Setup New Game</h2>
                <p class="settings-subtitle">Choose how you want to set up your trivia game</p>
            </div>
            
            <div class="settings-section">
                <h3 class="settings-section-title">Quick Replace (Recommended)</h3>
                <div style="background: #e8f5e8; border: 2px solid #28a745; border-radius: 10px; padding: 15px; margin: 10px 0;">
                    <p style="margin: 0 0 10px 0; color: #155724;"><strong>🚀 Fast Option:</strong> Replace the current trivia_game folder</p>
                    <ul style="margin: 5px 0; padding-left: 20px; color: #155724; font-size: 0.9em;">
                        <li>Removes <code>static/trivia_game</code> folder</li>
                        <li>Creates new folder with fresh questions</li>
                        <li>No file browsing needed</li>
                    </ul>
                </div>
                <div class="settings-actions">
                    <button class="settings-btn settings-btn-success" onclick="showQuickReplaceConfirmation()">
                        ⚡ Quick Replace
                    </button>
                </div>
            </div>

            <div class="settings-section">
                <h3 class="settings-section-title">Custom Location (Advanced)</h3>
                <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 10px; padding: 15px; margin: 10px 0;">
                    <p style="margin: 0 0 10px 0; color: #856404;"><strong>📁 Custom Option:</strong> Choose where to create trivia folder</p>
                    <ul style="margin: 5px 0; padding-left: 20px; color: #856404; font-size: 0.9em;">
                        <li>Browse your Raspberry Pi filesystem</li>
                        <li>Select USB drives or custom locations</li>
                        <li>Perfect for external storage</li>
                    </ul>
                </div>
                <div class="settings-actions">
                    <button class="settings-btn settings-btn-primary" onclick="showDrivePicker()">
                        📂 Browse Locations
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error showing options:', error);
        showError('Failed to show setup options: ' + error.message);
    }
}

function showQuickReplaceConfirmation() {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">⚠️ Confirm Quick Replace</h2>
            <p class="settings-subtitle">This will replace the current trivia_game folder</p>
        </div>
        
        <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">📋 What will happen:</h4>
            <ul style="margin: 5px 0; padding-left: 20px; color: #856404;">
                <li>Current <code>static/trivia_game</code> folder will be removed</li>
                <li>A new trivia_game folder will be created</li>
                <li>New trivia_questions.json file will be generated</li>
            </ul>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-secondary" onclick="setupNewGameAdvanced()">
                ← Back to Options
            </button>
            <button class="settings-btn settings-btn-success" onclick="executeReplaceTriviaFolder()">
                🚀 Replace Folder
            </button>
        </div>
    `;
}

async function executeReplaceTriviaFolder(sourcePath) {
    const settingsContent = document.querySelector('.settings-content');
    
    // Show processing state
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">⚙️ Replacing Trivia Folder</h2>
            <p class="settings-subtitle">Please wait...</p>
        </div>
        <div style="text-align: center; padding: 40px;">
            <div style="font-size: 4em; animation: bounce 1s ease-in-out infinite;">🔄</div>
            <p style="margin-top: 20px; font-size: 1.2em;">Copying trivia_game folder...</p>
        </div>
        <style>
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-20px); }
            }
        </style>
    `;

    try {
        const requestBody = {};
        
        if (sourcePath) {
            // Copy from selected folder to project folder
            requestBody.sourcePath = sourcePath;
        }
        // If no sourcePath, it will use the default behavior (quick replace)
        
        const response = await fetch('/api/replace-trivia-folder/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
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
            <h2 class="settings-title">✅ Folder Replaced Successfully!</h2>
            <p class="settings-subtitle">Trivia game folder has been updated</p>
        </div>
        
        <div style="background: #d4edda; border: 2px solid #28a745; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h4 style="margin: 0 0 15px 0; color: #155724;">🎉 Success!</h4>
            <p style="color: #155724; margin-bottom: 15px;">${message}</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                <h5 style="margin: 0 0 10px 0;">📁 Details:</h5>
                ${details.sourcePath ? `<p><strong>Copied From:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px;">${details.sourcePath}</code></p>` : ''}
                <p><strong>Target Location:</strong> <code style="background: white; padding: 2px 6px; border-radius: 3px;">${details.targetPath || details.folderPath}</code></p>
                ${details.itemsCopied ? `<p><strong>Items Copied:</strong> ${details.itemsCopied.join(', ')}</p>` : ''}
                ${details.filesCreated ? `<p><strong>Files Created:</strong> ${details.filesCreated.join(', ')}</p>` : ''}
                ${details.folderExisted ? `<p><strong>Previous folder:</strong> Successfully removed</p>` : ''}
            </div>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-primary" onclick="setupNewGameAdvanced()">
                🔄 Replace Again
            </button>
            <button class="settings-btn settings-btn-success" onclick="closeSettingsModal()">
                ✅ Done
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
            <h2 class="settings-title">❌ Error</h2>
            <p class="settings-subtitle">Something went wrong</p>
        </div>
        
        <div style="background: #f8d7da; border: 2px solid #dc3545; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #721c24;">⚠️ Error Details:</h4>
            <p style="color: #721c24;">${errorMessage}</p>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-secondary" onclick="setupNewGameAdvanced()">
                🔄 Try Again
            </button>
            <button class="settings-btn settings-btn-primary" onclick="closeSettingsModal()">
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
                <h2 class="settings-title">🔄 Loading Storage Locations</h2>
                <p class="settings-subtitle">Scanning Raspberry Pi filesystem...</p>
            </div>
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 3em; animation: spin 2s linear infinite;">🥧</div>
                <p style="margin-top: 20px; font-size: 1.2em;">Detecting drives and mount points...</p>
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
            throw new Error(data.message || 'Failed to load drives');
        }

        showDriveSelection(data.drives);
    } catch (error) {
        console.error('Error loading drives:', error);
        showError('Failed to load storage locations: ' + error.message);
    }
}

function showDriveSelection(drives) {
    const settingsContent = document.querySelector('.settings-content');
    settingsContent.innerHTML = `
        <div class="settings-close" onclick="closeSettingsModal()" title="Close Settings">
            ✕
        </div>
        <div class="settings-header">
            <h2 class="settings-title">💾 Select Storage Location</h2>
            <p class="settings-subtitle">Choose a location to browse for your trivia folder</p>
        </div>
        <div class="settings-section">
            <h3 class="settings-section-title">Available Locations</h3>
            <div class="drive-list" id="drive-list">
                ${drives.map(drive => `
                    <div class="drive-item" onclick="selectDrive('${drive.path}', '${drive.name}')" 
                         title="Click to browse ${drive.name}">
                        <div class="drive-icon">
                            ${drive.type === 'drive' ? '🥧' : drive.path.includes('/media') ? '💾' : '📁'}
                        </div>
                        <div class="drive-info">
                            <div class="drive-name">${drive.name}</div>
                            <div class="drive-path">${drive.path}</div>
                        </div>
                        <div class="drive-arrow">→</div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="settings-section">
            <div class="settings-actions">
                <button class="settings-btn settings-btn-secondary" onclick="setupNewGameAdvanced()">
                    ← Back to Options
                </button>
                <button class="settings-btn settings-btn-secondary" onclick="showDrivePicker()">
                    ↻ Refresh Locations
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
            <h2 class="settings-title">📁 Choose Folder Location</h2>
            <p class="settings-subtitle">Current: ${locationName || currentPath}</p>
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
                ← Back to Locations
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
            <h2 class="settings-title">⚠️ Confirm Replace Trivia Game</h2>
            <p class="settings-subtitle">Ready to copy the trivia_game folder</p>
        </div>
        
        <div style="background: #fff3cd; border: 2px solid #ffc107; border-radius: 10px; padding: 20px; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">📋 Copy Details:</h4>
            <p><strong>From (Source):</strong> <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px;">${sourcePath}</code></p>
            <p><strong>To (Target):</strong> <code style="background: #f8f9fa; padding: 2px 6px; border-radius: 3px;">./static/trivia_game</code></p>
            <p style="margin: 15px 0 5px 0; color: #856404;"><strong>⚠️ Important:</strong></p>
            <ul style="margin: 5px 0; padding-left: 20px; color: #856404;">
                <li>The project's trivia_game folder will be completely replaced</li>
                <li>All contents from the source folder will be copied</li>
                <li>The game will use the new folder after restart</li>
            </ul>
        </div>

        <div class="settings-actions">
            <button class="settings-btn settings-btn-secondary" onclick="showFolderBrowser('${sourcePath.substring(0, sourcePath.lastIndexOf('/'))}', 'Parent Folder')">
                ← Back
            </button>
            <button class="settings-btn settings-btn-success" onclick="executeReplaceTriviaFolder('${sourcePath}')">
                🔄 Copy and Replace
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