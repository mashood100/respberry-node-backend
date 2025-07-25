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
    eliminatedAnswers: []
};

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
        eliminateRandomWrongAnswer();
    });
    
    // Question results
    socket.on('question_results', function(results) {
        console.log('📊 Question results:', results);
        showQuestionResults(results);
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
    gameState = state;
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
    
    elements.phaseTitle.textContent = 'Question Display';
    updateQuestionNumber();
}

// Show answering phase (40 seconds)
function showAnsweringPhase() {
    // Hide full-screen question and show main game
    elements.fullscreenQuestionView.classList.remove('active');
    elements.mainGameContent.style.display = 'block';
    
    if (gameState.currentQuestion) {
        elements.questionText.textContent = gameState.currentQuestion.question;
        updateAnswerOptions(gameState.currentQuestion.options);
    }
    
    elements.phaseTitle.textContent = 'Answering Phase';
    updateGameStatus();
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
            
            // Reset elimination state
            option.classList.remove('eliminated', 'correct');
            const overlay = option.querySelector('.elimination-overlay');
            overlay.style.opacity = '0';
            overlay.style.transform = 'scale(0)';
        }
    });
    
    // Reset eliminated answers tracking
    gameState.eliminatedAnswers = [];
}

// Eliminate a random wrong answer
function eliminateRandomWrongAnswer() {
    if (!gameState.currentQuestion) return;
    
    const correctAnswer = gameState.currentQuestion.correct;
    const availableWrongAnswers = gameState.currentQuestion.options
        .map((option, index) => ({ option, index }))
        .filter(item => item.option !== correctAnswer && !gameState.eliminatedAnswers.includes(item.index));
    
    if (availableWrongAnswers.length === 0) return;
    
    // Randomly select a wrong answer to eliminate
    const randomIndex = Math.floor(Math.random() * availableWrongAnswers.length);
    const answerToEliminate = availableWrongAnswers[randomIndex];
    
    gameState.eliminatedAnswers.push(answerToEliminate.index);
    
    // Apply elimination animation
    const optionElement = elements.answerOptions[answerToEliminate.index];
    optionElement.classList.add('eliminated');
    
    console.log(`❌ Eliminated option ${answerToEliminate.index}: ${answerToEliminate.option}`);
}

// Show question results
function showQuestionResults(results) {
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

// Show final results
function showFinalResults(data) {
    elements.waitingScreen.style.display = 'none';
    elements.instructionsScreen.style.display = 'none';
    elements.gameDisplay.style.display = 'none';
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

// Update question number
function updateQuestionNumber() {
    const current = gameState.currentQuestionIndex + 1;
    const total = gameState.totalQuestions || 5;
    elements.questionNumber.textContent = `Question ${current} of ${total}`;
}

// Update game status
function updateGameStatus() {
    let statusText = '';
    
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