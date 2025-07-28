// Multiplayer Trivia User Screen JavaScript
// This handles individual player screens (/user) - INTERACTIVE

let socket;
let playerData = {
    sessionId: null,
    name: 'Player',
    score: 0,
    currentAnswer: null,
    hasAnswered: false,
    currentQuestionScore: 0
};

let gameState = {
    currentPhase: 'waiting',
    isActive: false,
    currentQuestion: null,
    timeRemaining: 40,
    questionDisplayTimeRemaining: 10,
    eliminatedAnswers: []
};

// Background Music Management
let backgroundMusic = null;
let isMusicPlaying = false;

function initializeBackgroundMusic() {
    backgroundMusic = document.getElementById('background-music');
    if (backgroundMusic) {
        backgroundMusic.volume = 0.3; // Set default volume to 30%
        console.log('🎵 Background music initialized');
    }
}

function playBackgroundMusic() {
    if (backgroundMusic && !isMusicPlaying) {
        backgroundMusic.play().then(() => {
            isMusicPlaying = true;
            console.log('🎵 Background music started');
            updateMusicToggleButton();
        }).catch(error => {
            console.error('❌ Could not play background music:', error);
        });
    }
}

function stopBackgroundMusic() {
    if (backgroundMusic && isMusicPlaying) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
        isMusicPlaying = false;
        console.log('🔇 Background music stopped');
        updateMusicToggleButton();
    }
}

function toggleBackgroundMusic() {
    if (isMusicPlaying) {
        stopBackgroundMusic();
    } else {
        playBackgroundMusic();
    }
}

function setMusicVolume(value) {
    if (backgroundMusic) {
        backgroundMusic.volume = value / 100;
        console.log(`🔊 Music volume set to ${value}%`);
    }
}

function updateMusicToggleButton() {
    const toggleButton = document.getElementById('music-toggle');
    if (toggleButton) {
        toggleButton.textContent = isMusicPlaying ? '🔊 Music: ON' : '🔇 Music: OFF';
        toggleButton.style.background = isMusicPlaying ? '#28a745' : '#dc3545';
    }
}

// DOM Elements
const elements = {
    // Screens
    waitingScreen: document.getElementById('waiting-screen'),
    gameScreen: document.getElementById('game-screen'),
    resultsScreen: document.getElementById('results-screen'),
    leaderboardScreen: document.getElementById('leaderboard-screen'),
    finalResultsScreen: document.getElementById('final-results-screen'),
    
    // Player info
    playerName: document.getElementById('player-name'),
    connectionStatus: document.getElementById('connection-status'),
    yourScore: document.getElementById('your-score'),
    
    // Waiting screen
    waitingInfo: document.getElementById('waiting-info'),
    
    // Name editor
    nameEditor: document.getElementById('name-editor'),
    nameDisplay: document.getElementById('name-display'),
    nameInputContainer: document.getElementById('name-input-container'),
    currentNameDisplay: document.getElementById('current-name-display'),
    nameInput: document.getElementById('name-input'),
    
    // Full-screen question
    fullscreenQuestionView: document.getElementById('fullscreen-question-view'),
    fullscreenQuestionText: document.getElementById('fullscreen-question-text'),
    questionCountdown: document.getElementById('question-countdown'),
    
    // Main game content
    mainGameContent: document.getElementById('main-game-content'),
    questionText: document.getElementById('question-text'),
    progressFill: document.getElementById('progress-fill'),
    gameStatus: document.getElementById('game-status'),
    answerOptions: document.querySelectorAll('.answer-option'),
    answerSubmitted: document.getElementById('answer-submitted'),
    
    // Results screens
    resultMessage: document.getElementById('result-message'),
    correctAnswerDisplay: document.getElementById('correct-answer-display'),
    finalResultMessage: document.getElementById('final-result-message'),
    finalScoreDisplay: document.getElementById('final-score-display'),
    
    // Leaderboard elements
    leaderboardMessage: document.getElementById('leaderboard-message'),
    leaderboardUserContent: document.getElementById('leaderboard-user-content')
};

// Initialize player data from server
function initializePlayerData() {
    if (window.deviceInfo) {
        playerData.sessionId = window.deviceInfo.sessionId;
        console.log('📱 Player session ID:', playerData.sessionId);
    }
}

// Initialize WebSocket connection
function initializeSocket() {
    console.log('🔗 Initializing user WebSocket...');
    
    socket = io({
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 10000,
        forceNew: true
    });
    
    socket.on('connect', function() {
        console.log('✅ User connected:', socket.id);
        updateConnectionStatus(true);
        
        // Join the trivia game
        socket.emit('join_trivia_game', {
            sessionId: playerData.sessionId,
            userAgent: navigator.userAgent
        });
    });
    
    socket.on('connect_error', function(error) {
        console.error('❌ User connection error:', error);
        updateConnectionStatus(false);
    });
    
    socket.on('disconnect', function(reason) {
        console.log('❌ User disconnected:', reason);
        updateConnectionStatus(false);
    });
    
    // Player joined response
    socket.on('player_joined', function(data) {
        console.log('🎮 Player joined successfully:', data.player);
        playerData.name = data.player.name;
        playerData.score = data.player.score;
        updatePlayerDisplay();
    });
    
    // Game state updates
    socket.on('game_state_update', function(state) {
        console.log('📡 User received game state:', state.currentPhase);
        updateGameState(state);
    });
    
    // Answer submission response
    socket.on('answer_submitted', function(response) {
        console.log('📝 Answer submission response:', response);
        if (response.success) {
            showAnswerSubmitted();
            // Don't disable options - allow answer changes until time runs out
        }
    });
    
    // Answer elimination events
    socket.on('eliminate_wrong_answer', function(data) {
        console.log('❌ Eliminating wrong answer:', data);
        eliminateAnswer(data.answerIndex);
    });
    
    // Name update response
    socket.on('name_update_response', function(response) {
        console.log('✏️ Name update response:', response);
        if (!response.success) {
            alert(`Failed to update name: ${response.reason || 'Unknown error'}`);
            // Revert to previous name display
            cancelEditingName();
        }
    });
    
    // Question results
    socket.on('question_results', function(results) {
        console.log('📊 Question results:', results);
        showQuestionResults(results);
    });
    
    // Show leaderboard (every 5 questions)
    socket.on('show_leaderboard', function(data) {
        console.log('📊 Show leaderboard:', data);
        showLeaderboard(data);
    });

    // Game finished
    socket.on('game_finished', function(data) {
        console.log('🏆 Game finished:', data);
        showFinalResults(data);
    });
}

// Update game state
function updateGameState(state) {
    gameState = state;
    
    // Start background music when game moves to question-display or answering phase
    if ((state.currentPhase === 'question-display' || state.currentPhase === 'answering') && !isMusicPlaying) {
        playBackgroundMusic();
    }
    
    // Update player score from server data
    const myPlayer = state.players.find(p => p.sessionId === playerData.sessionId);
    if (myPlayer) {
        playerData.score = myPlayer.score;
        playerData.currentQuestionScore = myPlayer.currentQuestionScore || 0;
        playerData.hasAnswered = !!myPlayer.currentAnswer;
        updatePlayerDisplay();
    }
    
    updateUI();
    updateProgress();
}

// Update UI based on current phase
function updateUI() {
    switch (gameState.currentPhase) {
        case 'waiting':
            showWaitingScreen();
            break;
        case 'question-display':
            showQuestionDisplayPhase();
            break;
        case 'answering':
            showAnsweringPhase();
            break;
        case 'results':
            // Results are handled by question_results event
            break;
        case 'leaderboard':
            // Leaderboard is handled by show_leaderboard event
            break;
        case 'finished':
            // Final results are handled by game_finished event
            break;
    }
}

// Show waiting screen
function showWaitingScreen() {
    elements.waitingScreen.style.display = 'flex';
    elements.gameScreen.style.display = 'none';
    elements.resultsScreen.style.display = 'none';
    elements.leaderboardScreen.style.display = 'none';
    elements.finalResultsScreen.style.display = 'none';
    
    elements.waitingInfo.textContent = 'Waiting for the game host to start the trivia...';
    elements.yourScore.style.display = 'none';
    
    // Show name editor during waiting phase
    if (elements.nameEditor) {
        elements.nameEditor.style.display = 'block';
    }
}

// Show question display phase
function showQuestionDisplayPhase() {
    elements.waitingScreen.style.display = 'none';
    elements.gameScreen.style.display = 'block';
    elements.resultsScreen.style.display = 'none';
    elements.leaderboardScreen.style.display = 'none';
    elements.finalResultsScreen.style.display = 'none';
    
    // Hide name editor once game starts
    if (elements.nameEditor) {
        elements.nameEditor.style.display = 'none';
    }
    
    // Show full-screen question
    elements.fullscreenQuestionView.classList.add('active');
    elements.mainGameContent.style.display = 'none';
    
    if (gameState.currentQuestion) {
        elements.fullscreenQuestionText.textContent = gameState.currentQuestion.question;
        elements.questionCountdown.textContent = gameState.questionDisplayTimeRemaining;
    }
    
    elements.yourScore.style.display = 'block';
    resetAnswerState();
}

// Show answering phase
function showAnsweringPhase() {
    // Hide full-screen question and show main game
    elements.fullscreenQuestionView.classList.remove('active');
    elements.mainGameContent.style.display = 'block';
    
    // Explicitly hide leaderboard screen when moving to answering phase
    elements.leaderboardScreen.style.display = 'none';
    
    if (gameState.currentQuestion) {
        elements.questionText.textContent = gameState.currentQuestion.question;
        updateAnswerOptions(gameState.currentQuestion.options);
        
        // Restore selected answer highlighting if player has already answered
        if (playerData.hasAnswered && playerData.currentAnswer) {
            restoreSelectedAnswer();
        }
    }
    
    updateGameStatus();
    
    // Always enable answer options during answering phase (allow changing answers)
    enableAnswerOptions();
}

// Update answer options
function updateAnswerOptions(options) {
    if (!options) return;
    
    elements.answerOptions.forEach((option, index) => {
        if (index < options.length) {
            const letterSpan = option.querySelector('.answer-letter');
            const textSpan = option.querySelector('.answer-text');
            
            letterSpan.textContent = String.fromCharCode(65 + index); // A, B, C, D
            textSpan.textContent = options[index];
            
            // Reset state
            option.classList.remove('eliminated', 'correct', 'selected', 'disabled');
            const overlay = option.querySelector('.elimination-overlay');
            overlay.style.opacity = '0';
            overlay.style.transform = 'scale(0)';
        }
    });
    
    // Reset eliminated answers tracking
    gameState.eliminatedAnswers = [];
}

// Enable answer options for interaction
function enableAnswerOptions() {
    elements.answerOptions.forEach(option => {
        option.classList.add('interactive');
        option.classList.remove('disabled');
    });
}

// Disable answer options (after answering)
function disableAnswerOptions() {
    elements.answerOptions.forEach(option => {
        option.classList.remove('interactive');
        option.classList.add('disabled');
    });
}

// Select an answer
function selectAnswer(index) {
    if (gameState.currentPhase !== 'answering') {
        console.log('❌ Cannot select answer - wrong phase');
        return;
    }
    
    if (!gameState.currentQuestion || !gameState.currentQuestion.options[index]) {
        console.log('❌ Invalid answer index:', index);
        return;
    }
    
    const selectedAnswer = gameState.currentQuestion.options[index];
    const previousAnswer = playerData.currentAnswer;
    
    playerData.currentAnswer = selectedAnswer;
    playerData.hasAnswered = true;
    
    // Visual feedback
    elements.answerOptions.forEach((option, i) => {
        if (i === index) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
    
    // Submit answer to server
    socket.emit('submit_answer', {
        sessionId: playerData.sessionId,
        answer: selectedAnswer
    });
    
    if (previousAnswer && previousAnswer !== selectedAnswer) {
        console.log('📝 Changed answer from:', previousAnswer, 'to:', selectedAnswer);
    } else {
        console.log('📝 Selected answer:', selectedAnswer);
    }
}

// Show answer submitted notification
function showAnswerSubmitted() {
    elements.answerSubmitted.style.display = 'block';
    
    setTimeout(() => {
        elements.answerSubmitted.style.display = 'none';
    }, 3000);
}

// Reset answer state for new question
function resetAnswerState() {
    playerData.currentAnswer = null;
    playerData.hasAnswered = false;
    playerData.currentQuestionScore = 0;
    
    // Reset eliminated answers array for new question
    gameState.eliminatedAnswers = [];
    
    elements.answerOptions.forEach(option => {
        option.classList.remove('selected', 'eliminated', 'correct');
        option.style.animation = ''; // Clear any animations
    });
    
    elements.answerSubmitted.style.display = 'none';
}

// Restore selected answer highlighting
function restoreSelectedAnswer() {
    if (!gameState.currentQuestion || !playerData.currentAnswer) return;
    
    const answerIndex = gameState.currentQuestion.options.indexOf(playerData.currentAnswer);
    
    if (answerIndex !== -1 && elements.answerOptions[answerIndex]) {
        // Clear all selections first
        elements.answerOptions.forEach(option => {
            option.classList.remove('selected');
        });
        
        // Highlight the selected answer
        elements.answerOptions[answerIndex].classList.add('selected');
        console.log('🎯 Restored selection highlighting for answer:', playerData.currentAnswer);
    }
}

// Eliminate a specific answer
function eliminateAnswer(answerIndex) {
    if (typeof answerIndex === 'undefined' || !elements.answerOptions[answerIndex]) return;

    gameState.eliminatedAnswers.push(answerIndex);

    // Apply elimination animation
    const optionElement = elements.answerOptions[answerIndex];
    optionElement.classList.add('eliminated');
    optionElement.style.animation = 'disappearAnswer 1.2s ease-in-out forwards';
    
    console.log(`❌ Eliminated option ${answerIndex}`);
}

// Show question results
function showQuestionResults(results) {
    elements.gameScreen.style.display = 'none';
    elements.resultsScreen.style.display = 'flex';
    
    const myResult = results.playerResults.find(p => p.name === playerData.name);
    
    if (myResult) {
        const questionScore = myResult.questionScore || 0;
        
        if (myResult.isCorrect) {
            elements.resultMessage.className = 'result-message correct';
            elements.resultMessage.textContent = `🎉 Correct! +${questionScore} points`;
        } else if (myResult.answer) {
            elements.resultMessage.className = 'result-message incorrect';
            elements.resultMessage.textContent = '❌ Incorrect (+0 points)';
        } else {
            elements.resultMessage.className = 'result-message no-answer';
            elements.resultMessage.textContent = '⏰ Time\'s Up! (+0 points)';
        }
        
        // Update score display
        playerData.score = myResult.score;
        playerData.currentQuestionScore = 0; // Reset for next question
        updatePlayerDisplay();
    }
    
    elements.correctAnswerDisplay.textContent = `Correct Answer: ${results.correctAnswer}`;
    
    // Return to game after 5 seconds (when next question starts)
    setTimeout(() => {
        if (gameState.currentPhase === 'question-display') {
            elements.resultsScreen.style.display = 'none';
            showQuestionDisplayPhase();
        }
    }, 5000);
}

// Show leaderboard (every 5 questions)
function showLeaderboard(data) {
    elements.waitingScreen.style.display = 'none';
    elements.gameScreen.style.display = 'none';
    elements.resultsScreen.style.display = 'none';
    elements.finalResultsScreen.style.display = 'none';
    elements.leaderboardScreen.style.display = 'flex';
    
    // Update leaderboard title
    if (elements.leaderboardMessage) {
        elements.leaderboardMessage.textContent = 
            `📊 Leaderboard - Question ${data.currentQuestion} of ${data.totalQuestions}`;
    }
    
    // Clear and populate leaderboard content
    if (elements.leaderboardUserContent) {
        elements.leaderboardUserContent.innerHTML = '';
        
        data.leaderboard.forEach((player, index) => {
            const leaderboardItem = document.createElement('div');
            
            // Determine class based on rank and if it's current user
            let itemClass = 'user-leaderboard-item';
            if (player.sessionId === playerData.sessionId) {
                itemClass += ' current-user';
            } else if (index === 0) {
                itemClass += ' rank-1';
            } else if (index === 1) {
                itemClass += ' rank-2';
            } else if (index === 2) {
                itemClass += ' rank-3';
            } else {
                itemClass += ' rank-other';
            }
            
            leaderboardItem.className = itemClass;
            
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const isCurrentUser = player.sessionId === playerData.sessionId ? ' (You)' : '';
            const maxPossibleScore = data.currentQuestion * 100; // Each question max 100 points
            
            leaderboardItem.innerHTML = `
                <div class="user-rank-info">
                    <div class="user-rank-number">${rankEmoji}</div>
                    <div class="user-player-name">${player.name}${isCurrentUser}</div>
                </div>
                <div class="user-player-score">${player.score}/${maxPossibleScore}</div>
            `;
            
            elements.leaderboardUserContent.appendChild(leaderboardItem);
        });
    }
    
    console.log('📊 Leaderboard displayed for user');
}

// Show final results
function showFinalResults(data) {
    elements.waitingScreen.style.display = 'none';
    elements.gameScreen.style.display = 'none';
    elements.resultsScreen.style.display = 'none';
    elements.leaderboardScreen.style.display = 'none';
    elements.finalResultsScreen.style.display = 'flex';
    
    const myResult = data.finalResults.find(r => r.sessionId === playerData.sessionId);
    
    if (myResult) {
        let resultText = '🏆 Game Complete!';
        if (myResult.rank === 1) {
            resultText = '🥇 You Won!';
        } else if (myResult.rank === 2) {
            resultText = '🥈 Second Place!';
        } else if (myResult.rank === 3) {
            resultText = '🥉 Third Place!';
        }
        
        elements.finalResultMessage.textContent = resultText;
        const maxPossibleTotal = data.totalQuestions * 100; // Each question max 100 points
        elements.finalScoreDisplay.textContent = 
            `Your Final Score: ${myResult.score}/${maxPossibleTotal}`;
    } else {
        elements.finalResultMessage.textContent = '🏆 Game Complete!';
        const maxPossibleTotal = data.totalQuestions * 100; // Each question max 100 points
        elements.finalScoreDisplay.textContent = `Your Final Score: ${playerData.score}/${maxPossibleTotal}`;
    }
}

// Update player display
function updatePlayerDisplay() {
    // Hide player name during game to avoid blocking question text
    if (gameState.currentPhase === 'answering' || gameState.currentPhase === 'question-display') {
        elements.playerName.style.display = 'none';
        elements.yourScore.style.display = 'none'; // Hide score section during game
    } else {
        elements.playerName.style.display = 'block';
        elements.playerName.textContent = playerData.name;
        elements.yourScore.style.display = 'block';
        elements.yourScore.textContent = `Score: ${playerData.score}`;
    }
    
    updateNameEditor();
}

// Update connection status
function updateConnectionStatus(connected) {
    if (connected) {
        elements.connectionStatus.className = 'user-status connected';
        elements.connectionStatus.textContent = '● Connected';
    } else {
        elements.connectionStatus.className = 'user-status disconnected';
        elements.connectionStatus.textContent = '● Disconnected';
    }
}

// Update progress bar
function updateProgress() {
    const totalTime = gameState.currentPhase === 'question-display' ? 10 : 40;
    const timeRemaining = gameState.currentPhase === 'question-display' 
        ? gameState.questionDisplayTimeRemaining 
        : gameState.timeRemaining;
    
    const percentage = ((totalTime - timeRemaining) / totalTime) * 100;
    elements.progressFill.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
}

// Update game status
function updateGameStatus() {
    let statusText = '';
    
    if (playerData.hasAnswered) {
        statusText = `✅ Answer submitted! You can still change it. Time remaining: ${gameState.timeRemaining}s`;
    } else {
        statusText = `Select your answer! Time remaining: ${gameState.timeRemaining}s`;
    }
    
    if (elements.gameStatus && elements.gameStatus.querySelector('.status-text')) {
        elements.gameStatus.querySelector('.status-text').textContent = statusText;
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    console.log('📱 Trivia user screen loaded');
    initializePlayerData();
    initializeSocket();
    initializeBackgroundMusic(); // Initialize music on page load
    initializeNameEditor(); // Initialize name editor
});

// Initialize name editor with keyboard support
function initializeNameEditor() {
    if (elements.nameInput) {
        elements.nameInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                saveNewName();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                cancelEditingName();
            }
        });
    }
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && socket && !socket.connected) {
        console.log('🔄 Page visible again, reconnecting...');
        setTimeout(initializeSocket, 1000);
    }
});

// Name editing functions
function startEditingName() {
    if (gameState.currentPhase !== 'waiting') {
        console.log('❌ Cannot edit name - game has started');
        return;
    }
    
    elements.nameDisplay.style.display = 'none';
    elements.nameInputContainer.style.display = 'block';
    elements.nameInput.value = playerData.name;
    elements.nameInput.focus();
    elements.nameInput.select();
    
    console.log('✏️ Started editing name');
}

function saveNewName() {
    const newName = elements.nameInput.value.trim();
    
    if (!newName) {
        alert('Please enter a valid name!');
        return;
    }
    
    if (newName.length > 20) {
        alert('Name must be 20 characters or less!');
        return;
    }
    
    if (newName === playerData.name) {
        cancelEditingName();
        return;
    }
    
    // Update local player data
    playerData.name = newName;
    
    // Send name update to server
    socket.emit('update_player_name', {
        sessionId: playerData.sessionId,
        newName: newName
    });
    
    // Update displays
    updatePlayerDisplay();
    updateNameEditor();
    
    // Hide input and show display
    elements.nameInputContainer.style.display = 'none';
    elements.nameDisplay.style.display = 'flex';
    
    console.log('✅ Name updated to:', newName);
}

function cancelEditingName() {
    elements.nameInputContainer.style.display = 'none';
    elements.nameDisplay.style.display = 'flex';
    elements.nameInput.value = '';
    
    console.log('❌ Name editing cancelled');
}

function updateNameEditor() {
    if (elements.currentNameDisplay) {
        elements.currentNameDisplay.textContent = playerData.name;
    }
}

// Make functions available globally
window.selectAnswer = selectAnswer;
window.toggleBackgroundMusic = toggleBackgroundMusic;
window.setMusicVolume = setMusicVolume;
window.startEditingName = startEditingName;
window.saveNewName = saveNewName;
window.cancelEditingName = cancelEditingName; 