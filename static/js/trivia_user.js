// Multiplayer Trivia User Screen JavaScript
// This handles individual player screens (/user) - INTERACTIVE

let socket;
let playerData = {
    sessionId: null,
    name: 'Player',
    score: 0,
    currentAnswer: null,
    hasAnswered: false
};

let gameState = {
    currentPhase: 'waiting',
    isActive: false,
    currentQuestion: null,
    timeRemaining: 40,
    questionDisplayTimeRemaining: 10,
    eliminatedAnswers: []
};

// DOM Elements
const elements = {
    // Screens
    waitingScreen: document.getElementById('waiting-screen'),
    gameScreen: document.getElementById('game-screen'),
    resultsScreen: document.getElementById('results-screen'),
    finalResultsScreen: document.getElementById('final-results-screen'),
    
    // Player info
    playerName: document.getElementById('player-name'),
    connectionStatus: document.getElementById('connection-status'),
    yourScore: document.getElementById('your-score'),
    
    // Waiting screen
    waitingInfo: document.getElementById('waiting-info'),
    
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
    finalScoreDisplay: document.getElementById('final-score-display')
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
            disableAnswerOptions();
        }
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
    
    // Game finished
    socket.on('game_finished', function(data) {
        console.log('🏆 Game finished:', data);
        showFinalResults(data);
    });
}

// Update game state
function updateGameState(state) {
    gameState = state;
    
    // Update player score from server data
    const myPlayer = state.players.find(p => p.sessionId === playerData.sessionId);
    if (myPlayer) {
        playerData.score = myPlayer.score;
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
    elements.finalResultsScreen.style.display = 'none';
    
    elements.waitingInfo.textContent = 'Waiting for the game host to start the trivia...';
    elements.yourScore.style.display = 'none';
}

// Show question display phase
function showQuestionDisplayPhase() {
    elements.waitingScreen.style.display = 'none';
    elements.gameScreen.style.display = 'block';
    elements.resultsScreen.style.display = 'none';
    elements.finalResultsScreen.style.display = 'none';
    
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
    
    if (gameState.currentQuestion) {
        elements.questionText.textContent = gameState.currentQuestion.question;
        updateAnswerOptions(gameState.currentQuestion.options);
    }
    
    updateGameStatus();
    
    // Enable answer options if player hasn't answered yet
    if (!playerData.hasAnswered) {
        enableAnswerOptions();
    } else {
        disableAnswerOptions();
    }
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
    if (playerData.hasAnswered || gameState.currentPhase !== 'answering') {
        console.log('❌ Cannot select answer - already answered or wrong phase');
        return;
    }
    
    if (!gameState.currentQuestion || !gameState.currentQuestion.options[index]) {
        console.log('❌ Invalid answer index:', index);
        return;
    }
    
    const selectedAnswer = gameState.currentQuestion.options[index];
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
    
    console.log('📝 Selected answer:', selectedAnswer);
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
    
    // Reset eliminated answers array for new question
    gameState.eliminatedAnswers = [];
    
    elements.answerOptions.forEach(option => {
        option.classList.remove('selected', 'eliminated', 'correct');
        option.style.animation = ''; // Clear any animations
    });
    
    elements.answerSubmitted.style.display = 'none';
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
        if (myResult.isCorrect) {
            elements.resultMessage.className = 'result-message correct';
            elements.resultMessage.textContent = '🎉 Correct!';
        } else if (myResult.answer) {
            elements.resultMessage.className = 'result-message incorrect';
            elements.resultMessage.textContent = '❌ Incorrect';
        } else {
            elements.resultMessage.className = 'result-message no-answer';
            elements.resultMessage.textContent = '⏰ Time\'s Up!';
        }
        
        // Update score display
        playerData.score = myResult.score;
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

// Show final results
function showFinalResults(data) {
    elements.waitingScreen.style.display = 'none';
    elements.gameScreen.style.display = 'none';
    elements.resultsScreen.style.display = 'none';
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
        elements.finalScoreDisplay.textContent = 
            `Your Final Score: ${myResult.score}/${data.totalQuestions}`;
    } else {
        elements.finalResultMessage.textContent = '🏆 Game Complete!';
        elements.finalScoreDisplay.textContent = `Your Final Score: ${playerData.score}/${data.totalQuestions}`;
    }
}

// Update player display
function updatePlayerDisplay() {
    elements.playerName.textContent = playerData.name;
    elements.yourScore.textContent = `Score: ${playerData.score}`;
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
        statusText = `✅ Answer submitted! Waiting for time to run out...`;
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
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && socket && !socket.connected) {
        console.log('🔄 Page visible again, reconnecting...');
        setTimeout(initializeSocket, 1000);
    }
});

// Make selectAnswer function available globally
window.selectAnswer = selectAnswer; 