// Multiplayer Trivia Display Screen JavaScript
// This handles the main display screen (/trivia) - READ ONLY

let socket;
let gameState = {
    currentPhase: 'waiting',
    isActive: false,
    players: [],
    currentQuestion: null,
    timeRemaining: 40,
    questionDisplayTimeRemaining: 10,
    eliminatedAnswers: [],
    currentQuestionId: null, // Track current question to avoid resetting eliminations
    answerEliminationPhase: 'initial' // initial, first-eliminated, second-eliminated, final-reveal, correct-reveal
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
    waitingScreen: document.getElementById('waiting-screen'),
    instructionsScreen: document.getElementById('instructions-screen'),
    gameDisplay: document.getElementById('game-display'),
    finalResults: document.getElementById('final-results'),
    
    // Waiting screen
    playerCountWaiting: document.getElementById('player-count-waiting'),
    startBtn: document.getElementById('start-btn'),
    
    // Instructions screen
    instructionPlayerCount: document.getElementById('instruction-player-count'),
    step1: document.getElementById('step-1'),
    step2: document.getElementById('step-2'),
    step1Status: document.getElementById('step-1-status'),
    step2Status: document.getElementById('step-2-status'),
    startGameBtn: document.getElementById('start-game-btn'),
    
    // Game display
    phaseTitle: document.getElementById('phase-title'),
    questionNumber: document.getElementById('question-number'),
    scoreboardContent: document.getElementById('scoreboard-content'),
    
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
    
    // Final results
    winnerPodium: document.getElementById('winner-podium')
};

// Initialize WebSocket connection
function initializeSocket() {
    console.log('🔗 Initializing display screen WebSocket...');
    
    socket = io({
        transports: ['websocket', 'polling'],
        upgrade: true,
        rememberUpgrade: true,
        timeout: 10000,
        forceNew: true
    });
    
    socket.on('connect', function() {
        console.log('✅ Display screen connected:', socket.id);
        
        // Request current game state
        socket.emit('get_game_state');
    });
    
    socket.on('connect_error', function(error) {
        console.error('❌ Display connection error:', error);
    });
    
    socket.on('disconnect', function(reason) {
        console.log('❌ Display disconnected:', reason);
    });
    
    // Game state updates
    socket.on('game_state_update', function(state) {
        console.log('📡 Display received game state:', state.currentPhase);
        updateGameState(state);
    });
    
    // Answer elimination events
    socket.on('eliminate_wrong_answer', function(data) {
        console.log('❌ Eliminating wrong answer:', data);
        eliminateAnswer(data.answerIndex);
    });
    
    // Question results
    socket.on('question_results', function(results) {
        console.log('📊 Question results:', results);
        showQuestionResults(results);
    });
    
    // Show leaderboard (every 5 questions)
    socket.on('show_leaderboard', function(data) {
        console.log('📊 Show leaderboard:', data);
        showInterimLeaderboard(data);
    });

    // Game finished
    socket.on('game_finished', function(data) {
        console.log('🏆 Game finished:', data);
        showFinalResults(data);
    });
    
    // Game control responses
    socket.on('game_start_response', function(response) {
        console.log('🚀 Game start response:', response);
        if (!response.success) {
            alert('Could not start game - already active or no players');
        }
    });
    
    socket.on('game_reset_response', function(response) {
        console.log('🔄 Game reset response:', response);
    });
}

// Update game state and UI
function updateGameState(state) {
    gameState = { ...gameState, ...state };
    updateUI();
    updateScoreboard();
    updateProgress();
    
    // Update instructions display if we're on that screen
    if (elements.instructionsScreen.style.display === 'flex') {
        updateInstructionsDisplay();
    }
}

// Update the main UI based on current phase
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
        case 'finished':
            // Final results are handled by game_finished event
            break;
    }
}

// Show waiting screen
function showWaitingScreen() {
    elements.waitingScreen.style.display = 'flex';
    elements.instructionsScreen.style.display = 'none';
    elements.gameDisplay.style.display = 'none';
    elements.finalResults.style.display = 'none';
    
    elements.playerCountWaiting.textContent = 
        `Waiting for players... (${gameState.playerCount} connected)`;
}

// Show instructions screen
function showInstructions() {
    elements.waitingScreen.style.display = 'none';
    elements.instructionsScreen.style.display = 'flex';
    elements.gameDisplay.style.display = 'none';
    elements.finalResults.style.display = 'none';
    
    updateInstructionsDisplay();
}

// Update instructions display based on player connections
function updateInstructionsDisplay() {
    const playerCount = gameState.playerCount || 0;
    
    // Update player count badge
    elements.instructionPlayerCount.textContent = playerCount;
    
    // Step 1: Always show as active (players should connect to hotspot)
    elements.step1.classList.add('active');
    elements.step1Status.textContent = 'Connect to GameHub-Direct network';
    elements.step1Status.className = 'step-status';
    
    // Step 2: Activate when players are connected
    if (playerCount > 0) {
        elements.step2.style.opacity = '1';
        elements.step2.classList.add('completed');
        elements.step2Status.textContent = `${playerCount} player(s) connected!`;
        elements.step2Status.className = 'step-status ready';
        
        // Enable start game button
        elements.startGameBtn.disabled = false;
        elements.startGameBtn.textContent = `🚀 Start Game (${playerCount} players)`;
    } else {
        elements.step2.style.opacity = '0.5';
        elements.step2.classList.remove('completed');
        elements.step2Status.textContent = 'Waiting for players to join...';
        elements.step2Status.className = 'step-status';
        
        // Disable start game button
        elements.startGameBtn.disabled = true;
        elements.startGameBtn.textContent = '🚀 Start Game Now';
    }
}

// Go back to waiting screen
function backToWaiting() {
    showWaitingScreen();
}

// Start the actual game
function startGameNow() {
    console.log('🚀 Starting game from instructions...');
    
    // Start background music when game begins
    playBackgroundMusic();
    
    if (socket && socket.connected) {
        socket.emit('start_trivia_game');
    } else {
        alert('Not connected to server. Please refresh and try again.');
    }
}

// Show question display phase (10 seconds)
function showQuestionDisplayPhase() {
    elements.waitingScreen.style.display = 'none';
    elements.instructionsScreen.style.display = 'none';
    elements.gameDisplay.style.display = 'block';
    elements.finalResults.style.display = 'none';
    
    // Show full-screen question
    elements.fullscreenQuestionView.classList.add('active');
    elements.mainGameContent.style.display = 'none';
    
    if (gameState.currentQuestion) {
        elements.fullscreenQuestionText.textContent = gameState.currentQuestion.question;
        elements.questionCountdown.textContent = gameState.questionDisplayTimeRemaining;
    }
}

// Show answering phase (40 seconds)
function showAnsweringPhase() {
    // Hide full-screen question and show main game
    elements.fullscreenQuestionView.classList.remove('active');
    elements.mainGameContent.style.display = 'block';
    
    if (gameState.currentQuestion) {
        // Check if this is a new question to avoid resetting eliminations during the same question
        const questionId = gameState.currentQuestion.question + JSON.stringify(gameState.currentQuestion.options);
        const isNewQuestion = gameState.currentQuestionId !== questionId;
        
        if (isNewQuestion) {
            gameState.currentQuestionId = questionId;
            gameState.answerEliminationPhase = 'initial';
        }
        
        elements.questionText.textContent = gameState.currentQuestion.question;
        updateAnswerOptions(gameState.currentQuestion.options, isNewQuestion);
    }
    
    updateGameStatus();
}

// Show final answers reveal (highlight remaining 2 answers)
function showFinalAnswersReveal() {
    console.log('✨ Showing final answers reveal');
    
    // Highlight remaining answers with a special effect
    elements.answerOptions.forEach((option, index) => {
        if (!gameState.eliminatedAnswers.includes(index)) {
            option.classList.add('final-reveal');
            
            // Add a pulsing highlight effect
            option.style.animation = 'finalRevealPulse 1s ease-in-out 3';
        }
    });
    
    updateGameStatus('🎯 Final two answers revealed! Showing correct answer next...');
    
    // Show correct answer after 3 seconds
    setTimeout(() => {
        showCorrectAnswerFullScreen();
    }, 3000);
}

// Show correct answer in full-screen
function showCorrectAnswerFullScreen() {
    if (!gameState.currentQuestion) return;
    
    console.log('🎯 Showing correct answer full-screen');
    gameState.answerEliminationPhase = 'correct-reveal';
    
    // Create full-screen overlay for correct answer
    const correctAnswer = gameState.currentQuestion.correct;
    const correctIndex = gameState.currentQuestion.options.indexOf(correctAnswer);
    const letterAnswer = String.fromCharCode(65 + correctIndex);
    
    // Hide main game content and show full-screen correct answer
    elements.mainGameContent.style.display = 'none';
    elements.fullscreenQuestionView.classList.add('active');
    elements.fullscreenQuestionView.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
    
    elements.fullscreenQuestionText.innerHTML = `
        <div style="font-size: 0.6em; color: #fff; margin-bottom: 20px;">Correct Answer:</div>
        <div style="font-size: 1.2em; font-weight: 900; color: #FFD700; margin-bottom: 15px;">
            ${letterAnswer}. ${correctAnswer}
        </div>
    `;
    
    elements.questionCountdown.innerHTML = `
        <div style="font-size: 0.8em; color: #fff;">
            🎉 Moving to next question in <span id="next-question-countdown">5</span> seconds
        </div>
    `;
    
    // Countdown to next question
    let countdown = 5;
    const countdownInterval = setInterval(() => {
        countdown--;
        const countdownEl = document.getElementById('next-question-countdown');
        if (countdownEl) {
            countdownEl.textContent = countdown;
        }
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            // Reset full-screen view styling
            elements.fullscreenQuestionView.style.background = '';
            elements.fullscreenQuestionView.classList.remove('active');
            elements.mainGameContent.style.display = 'block';
        }
    }, 1000);
}

// Update answer options
function updateAnswerOptions(options, isNewQuestion = false) {
    if (!options) return;
    
    elements.answerOptions.forEach((option, index) => {
        if (index < options.length) {
            const letterSpan = option.querySelector('.answer-letter');
            const textSpan = option.querySelector('.answer-text');
            
            letterSpan.textContent = String.fromCharCode(65 + index); // A, B, C, D
            textSpan.textContent = options[index];
            
            // Only reset elimination state for new questions
            if (isNewQuestion) {
                option.classList.remove('eliminated', 'correct', 'final-reveal');
                option.style.animation = '';
                const overlay = option.querySelector('.elimination-overlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    overlay.style.transform = 'scale(0)';
                }
            } else {
                // For same question, maintain elimination state
                if (gameState.eliminatedAnswers.includes(index)) {
                    option.classList.add('eliminated');
                }
            }
        }
    });
    
    // Only reset eliminated answers tracking for new questions
    if (isNewQuestion) {
        gameState.eliminatedAnswers = [];
    }
}

// Eliminate a specific wrong answer
function eliminateAnswer(answerIndex) {
    if (typeof answerIndex === 'undefined') return;

    gameState.eliminatedAnswers.push(answerIndex);
    
    // Apply elimination animation
    const optionElement = elements.answerOptions[answerIndex];
    if (optionElement) {
        optionElement.classList.add('eliminated');
        console.log(`❌ Eliminated option ${answerIndex}`);
        updateGameStatus(`❌ Wrong answer eliminated! ${gameState.eliminatedAnswers.length} down, ${4 - gameState.eliminatedAnswers.length} remaining.`);
    }
}

// Show question results
function showQuestionResults(results) {
    // Clear any ongoing timers
    // clearEliminationTimers(); // This function is removed, so this line is removed.
    
    // Highlight correct answer
    if (gameState.currentQuestion) {
        const correctAnswer = results.correctAnswer;
        const correctIndex = gameState.currentQuestion.options.indexOf(correctAnswer);
        
        if (correctIndex !== -1) {
            elements.answerOptions[correctIndex].classList.add('correct');
        }
    }
    
    updateGameStatus('Results: Correct answer revealed!');
}

// Show interim leaderboard (every 5 questions)
function showInterimLeaderboard(data) {
    // Hide other screens
    elements.waitingScreen.style.display = 'none';
    elements.instructionsScreen.style.display = 'none';
    elements.gameDisplay.style.display = 'none';
    elements.finalResults.style.display = 'none';
    
    // Show interim leaderboard screen
    const interimLeaderboard = document.getElementById('interim-leaderboard');
    const leaderboardTitle = document.getElementById('leaderboard-title');
    const leaderboardContent = document.getElementById('leaderboard-content');
    
    if (interimLeaderboard) {
        interimLeaderboard.style.display = 'flex';
    }
    
    // Update title
    if (leaderboardTitle) {
        leaderboardTitle.textContent = `📊 Leaderboard After Question ${data.currentQuestion} of ${data.totalQuestions}`;
    }
    
    // Clear and populate leaderboard content
    if (leaderboardContent) {
        leaderboardContent.innerHTML = '';
        
        data.leaderboard.forEach((player, index) => {
            const leaderboardItem = document.createElement('div');
            const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : 'rank-other';
            leaderboardItem.className = `leaderboard-item ${rankClass}`;
            
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            
            leaderboardItem.innerHTML = `
                <div class="rank-info">
                    <div class="rank-number">${rankEmoji}</div>
                    <div class="player-name-leaderboard">${player.name}</div>
                </div>
                <div class="player-score-leaderboard">${player.score}/${data.currentQuestion}</div>
            `;
            
            leaderboardContent.appendChild(leaderboardItem);
        });
    }
    
    console.log('📊 Interim leaderboard displayed');
}

// Show final results
function showFinalResults(data) {
    // Clear any ongoing timers
    // clearEliminationTimers(); // This function is removed, so this line is removed.
    
    elements.waitingScreen.style.display = 'none';
    elements.instructionsScreen.style.display = 'none';
    elements.gameDisplay.style.display = 'none';
    
    // Hide interim leaderboard
    const interimLeaderboard = document.getElementById('interim-leaderboard');
    if (interimLeaderboard) {
        interimLeaderboard.style.display = 'none';
    }
    
    elements.finalResults.style.display = 'flex';
    
    // Create podium for top 3 players
    elements.winnerPodium.innerHTML = '';
    
    const topPlayers = data.finalResults.slice(0, 3);
    
    topPlayers.forEach((player, index) => {
        const podiumPlace = document.createElement('div');
        podiumPlace.className = `podium-place ${['first', 'second', 'third'][index]}`;
        
        podiumPlace.innerHTML = `
            <div style="font-size: 2em; margin-bottom: 10px;">
                ${['🥇', '🥈', '🥉'][index]}
            </div>
            <div style="font-weight: 900; font-size: 1.2em; margin-bottom: 5px; color: #000;">
                ${player.name}
            </div>
            <div style="font-size: 1.5em; font-weight: bold; color: #000;">
                ${player.score}/${data.totalQuestions}
            </div>
        `;
        
        elements.winnerPodium.appendChild(podiumPlace);
    });
}

// Update scoreboard
function updateScoreboard() {
    if (!elements.scoreboardContent) return;
    
    // Sort players by score (highest first)
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    
    elements.scoreboardContent.innerHTML = '';
    
    if (sortedPlayers.length === 0) {
        elements.scoreboardContent.innerHTML = '<div style="text-align: center; color: #666;">No players connected</div>';
        return;
    }
    
    sortedPlayers.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = `player-item ${player.currentAnswer ? 'answered' : ''}`;
        
        playerItem.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-score">${player.score}</span>
        `;
        
        elements.scoreboardContent.appendChild(playerItem);
    });
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
function updateGameStatus(customStatus = null) {
    let statusText = '';
    
    if (customStatus) {
        statusText = customStatus;
    } else {
        switch (gameState.currentPhase) {
            case 'waiting':
                statusText = 'Waiting for players to join...';
                break;
            case 'question-display':
                statusText = `Reading question... ${gameState.questionDisplayTimeRemaining}s remaining`;
                break;
            case 'answering':
                const answered = gameState.answeredCount || 0;
                const total = gameState.playerCount || 0;
                statusText = `Players answered: ${answered}/${total} • Time: ${gameState.timeRemaining}s`;
                break;
            case 'results':
                statusText = 'Showing results...';
                break;
            case 'finished':
                statusText = 'Game completed!';
                break;
            default:
                statusText = 'Game in progress...';
        }
    }
    
    if (elements.gameStatus && elements.gameStatus.querySelector('.status-text')) {
        elements.gameStatus.querySelector('.status-text').textContent = statusText;
    }
}

// Game control functions
function startGame() {
    console.log('🚀 Requesting game start...');
    if (socket && socket.connected) {
        socket.emit('start_trivia_game');
    } else {
        alert('Not connected to server. Please refresh and try again.');
    }
}

function resetGame() {
    console.log('🔄 Requesting game reset...');
    if (socket && socket.connected) {
        socket.emit('reset_trivia_game');
    } else {
        alert('Not connected to server. Please refresh and try again.');
    }
}

// Initialize when page loads
window.addEventListener('load', () => {
    console.log('🎮 Trivia display screen loaded');
    initializeBackgroundMusic();
    initializeSocket();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && socket && !socket.connected) {
        console.log('🔄 Page visible again, reconnecting...');
        setTimeout(initializeSocket, 1000);
    }
});

// Make functions available globally
window.showInstructions = showInstructions;
window.backToWaiting = backToWaiting;
window.startGameNow = startGameNow;
window.resetGame = resetGame;
window.toggleBackgroundMusic = toggleBackgroundMusic;
window.setMusicVolume = setMusicVolume; 