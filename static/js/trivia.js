// Enhanced Trivia Game with 40-second Timer
// Phase timing: 0-10s (all), 10s (eliminate 1), 20s (eliminate 1), 20-40s (pause), 40s (reveal)

// Game Configuration
const GAME_CONFIG = {
    TOTAL_TIME: 40, // Total time in seconds
    FIRST_ELIMINATION: 10, // First elimination at 10 seconds
    SECOND_ELIMINATION: 20, // Second elimination at 20 seconds
    FINAL_REVEAL: 40, // Final reveal at 40 seconds
    PAUSE_PHASE_START: 20, // Pause phase starts at 20 seconds
    PAUSE_PHASE_END: 40 // Pause phase ends at 40 seconds
};

// Background Music Management
let backgroundMusic = null;
let isMusicPlaying = false;

// Questions Management
let triviaQuestions = [];

// Load questions from JSON file
async function loadTriviaQuestions() {
    try {
        const response = await fetch('/static/trivia_game/trivia_questions.json?v=' + new Date().getTime());
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        triviaQuestions = data.questions;
        console.log('Successfully loaded', triviaQuestions.length, 'questions');
        
        // After loading questions, initialize the game
        initializeTrivia();
    } catch (error) {
        console.error('Error loading trivia questions:', error);
        updateGameStatus('❌ Error loading questions. Please refresh the page.');
    }
}

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

// Game State Management
let gameState = {
    currentQuestionIndex: 0,
    isActive: false,
    timeRemaining: GAME_CONFIG.TOTAL_TIME,
    currentPhase: 1,
    eliminatedAnswers: [],
    correctAnswerIndex: -1,
    timerInterval: null,
    wrongAnswerIndices: [],
    
    // New states for full-screen workflow
    showingQuestion: false,
    questionCountdown: 10,
    questionCountdownInterval: null,
    showingFinalAnswer: false
};

// DOM Elements Cache
const elements = {
    // Main game elements
    triviaContainer: document.getElementById('trivia-container'),
    questionText: document.getElementById('question-text'),
    timerCircle: document.getElementById('timer-circle'),
    timerText: document.getElementById('timer-text'),
    timerStatus: document.getElementById('timer-status'),
    progressFill: document.getElementById('progress-fill'),
    gameStatus: document.getElementById('game-status'),
    startBtn: document.getElementById('start-btn'),
    resetBtn: document.getElementById('reset-btn'),
    nextBtn: document.getElementById('next-btn'),
    announcer: document.getElementById('accessibility-announcer'),
    answerOptions: document.querySelectorAll('.answer-option'),
    
    // Full-screen elements
    fullscreenQuestionView: document.getElementById('fullscreen-question-view'),
    fullscreenQuestionText: document.getElementById('fullscreen-question-text'),
    questionCountdown: document.getElementById('question-countdown'),
    fullscreenAnswerView: document.getElementById('fullscreen-answer-view'),
    fullscreenAnswerText: document.getElementById('fullscreen-answer-text')
};

// Utility Functions
function announceToScreenReader(message) {
    if (elements.announcer) {
        elements.announcer.textContent = message;
        setTimeout(() => {
            elements.announcer.textContent = '';
        }, 1000);
    }
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function updateTimerCircle(timeRemaining) {
    const percentage = (timeRemaining / GAME_CONFIG.TOTAL_TIME) * 100;
    const degrees = (percentage / 100) * 360;
    
    let color = '#28a745'; // Green
    let className = '';
    
    if (timeRemaining <= 10) {
        color = '#dc3545'; // Red
        className = 'danger';
    } else if (timeRemaining <= 20) {
        color = '#ffc107'; // Yellow
        className = 'warning';
    }
    
    elements.timerCircle.style.background = 
        `conic-gradient(${color} ${degrees}deg, #e9ecef ${degrees}deg)`;
    
    elements.timerCircle.className = `timer-circle ${className}`;
    elements.timerText.textContent = timeRemaining;
}

function updateProgressBar() {
    let progress = 0;
    
    if (gameState.timeRemaining <= 30) progress = 25; // Phase 1 complete
    if (gameState.timeRemaining <= 20) progress = 50; // Phase 2 complete
    if (gameState.timeRemaining <= 0) progress = 100; // Phase 4 complete
    
    elements.progressFill.style.width = `${progress}%`;
}



function updateGameStatus(message) {
    const statusText = elements.gameStatus.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = message;
    }
}

function updateTimerStatus(message) {
    if (elements.timerStatus) {
        elements.timerStatus.textContent = message;
    }
}

// Full-Screen View Management
function showFullscreenQuestion(questionText) {
    gameState.showingQuestion = true;
    gameState.questionCountdown = 10;
    
    // Update question text
    elements.fullscreenQuestionText.textContent = questionText;
    elements.questionCountdown.textContent = gameState.questionCountdown;
    
    // Hide main container and show full-screen question
    elements.triviaContainer.classList.add('hidden');
    elements.fullscreenQuestionView.classList.add('active');
    
    // Start countdown
    gameState.questionCountdownInterval = setInterval(() => {
        gameState.questionCountdown--;
        elements.questionCountdown.textContent = gameState.questionCountdown;
        
        if (gameState.questionCountdown <= 0) {
            hideFullscreenQuestion();
        }
    }, 1000);
    
    announceToScreenReader(`Question displayed: ${questionText}. Game starting in 10 seconds.`);
    console.log('Showing full-screen question for 10 seconds');
}

function hideFullscreenQuestion() {
    gameState.showingQuestion = false;
    
    // Clear countdown interval
    if (gameState.questionCountdownInterval) {
        clearInterval(gameState.questionCountdownInterval);
        gameState.questionCountdownInterval = null;
    }
    
    // Hide full-screen question and show main container
    elements.fullscreenQuestionView.classList.remove('active');
    elements.triviaContainer.classList.remove('hidden');
    
    // Start the actual game timer
    startGameTimer();
    
    announceToScreenReader('Question phase complete. Game timer started.');
    console.log('Question phase complete, starting game timer');
}

function showFullscreenAnswer(answerText) {
    gameState.showingFinalAnswer = true;
    
    // Update answer text
    elements.fullscreenAnswerText.textContent = answerText;
    
    // Hide main container and show full-screen answer
    elements.triviaContainer.classList.add('hidden');
    elements.fullscreenAnswerView.classList.add('active');
    
    announceToScreenReader(`Game complete! The correct answer is: ${answerText}`);
    console.log('Showing full-screen correct answer');
}

function hideFullscreenAnswer() {
    gameState.showingFinalAnswer = false;
    
    // Hide full-screen answer and show main container
    elements.fullscreenAnswerView.classList.remove('active');
    elements.triviaContainer.classList.remove('hidden');
    
    console.log('Full-screen answer hidden');
}

// Question Management
function loadQuestion(questionData) {
    // Set question text
    elements.questionText.textContent = questionData.question;
    
    // Create all answers array and shuffle
    const allAnswers = [questionData.correct.text, ...questionData.wrong];
    const shuffledAnswers = shuffleArray(allAnswers);
    
    // Find correct answer index after shuffling
    gameState.correctAnswerIndex = shuffledAnswers.findIndex(
        answer => answer === questionData.correct.text
    );
    
    // Find wrong answer indices
    gameState.wrongAnswerIndices = shuffledAnswers
        .map((answer, index) => answer !== questionData.correct.text ? index : -1)
        .filter(index => index !== -1);
    
    // Reset answer options
    elements.answerOptions.forEach((option, index) => {
        option.classList.remove('correct', 'eliminated', 'eliminating');
        option.dataset.isCorrect = index === gameState.correctAnswerIndex ? 'true' : 'false';
        option.style.opacity = '1';
        option.style.transform = 'scale(1)';
        option.style.pointerEvents = 'auto';
        
        // Update content
        const letterSpan = option.querySelector('.answer-letter');
        const textSpan = option.querySelector('.answer-text');
        const overlay = option.querySelector('.elimination-overlay');
        
        letterSpan.textContent = String.fromCharCode(65 + index); // A, B, C, D
        textSpan.textContent = shuffledAnswers[index];
        
        // Reset elimination overlay
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0)';
    });
    
    console.log('Question loaded:', questionData.question);
    console.log('Correct answer at index:', gameState.correctAnswerIndex);
    console.log('Wrong answer indices:', gameState.wrongAnswerIndices);
}

// Game Logic Functions
function eliminateWrongAnswer() {
    const availableWrongAnswers = gameState.wrongAnswerIndices.filter(
        index => !gameState.eliminatedAnswers.includes(index)
    );
    
    if (availableWrongAnswers.length === 0) {
        console.log('No more wrong answers to eliminate');
        return;
    }
    
    // Randomly select a wrong answer to eliminate
    const randomIndex = Math.floor(Math.random() * availableWrongAnswers.length);
    const answerIndexToEliminate = availableWrongAnswers[randomIndex];
    
    // Add to eliminated list
    gameState.eliminatedAnswers.push(answerIndexToEliminate);
    
    // Apply elimination visual effect with animation sequence
    const optionToEliminate = elements.answerOptions[answerIndexToEliminate];
    const letterText = optionToEliminate.querySelector('.answer-letter').textContent;
    const answerText = optionToEliminate.querySelector('.answer-text').textContent;
    
    // Step 1: Start with elimination shake animation
    optionToEliminate.classList.add('eliminating');
    
    // Step 2: After shake, show elimination overlay and start disappearing
    setTimeout(() => {
        optionToEliminate.classList.remove('eliminating');
        optionToEliminate.classList.add('eliminated');
        
        // Announce after overlay appears
        announceToScreenReader(`Option ${letterText}, ${answerText}, has been eliminated.`);
        console.log(`Eliminated answer ${letterText}: ${answerText}`);
    }, 500); // Wait for shake animation to complete
    
    return answerIndexToEliminate;
}

function revealCorrectAnswer() {
    const correctOption = elements.answerOptions[gameState.correctAnswerIndex];
    correctOption.classList.add('correct');
    
    const letterText = correctOption.querySelector('.answer-letter').textContent;
    const answerText = correctOption.querySelector('.answer-text').textContent;
    
    // Show full-screen answer after a brief delay
    setTimeout(() => {
        showFullscreenAnswer(answerText);
    }, 1500);
    
    announceToScreenReader(`The correct answer is Option ${letterText}: ${answerText}`);
    console.log(`Revealed correct answer ${letterText}: ${answerText}`);
}

// Timer Management
function startGameTimer() {
    console.log('Starting game timer');
    updateTimerStatus('Game timer started! First elimination in 30 seconds.');
    updateGameStatus('🚀 All 4 answers visible - Choose wisely!');
    
    gameState.timerInterval = setInterval(() => {
        gameState.timeRemaining--;
        
        // Update visual elements
        updateTimerCircle(gameState.timeRemaining);
        updateProgressBar();
        
        // Handle phase transitions and eliminations
        handleTimeBasedEvents();
        
        // Check if timer finished
        if (gameState.timeRemaining <= 0) {
            endGame();
        }
    }, 1000);
}

function startTimer() {
    // This function is now just a wrapper for backwards compatibility
    startGameTimer();
}

function handleTimeBasedEvents() {
    const timeRemaining = gameState.timeRemaining;
    
    // Phase 1 to Phase 2: First elimination at 30 seconds (10 seconds elapsed)
    if (timeRemaining === 30 && gameState.currentPhase === 1) {
        gameState.currentPhase = 2;
        eliminateWrongAnswer();
        updateTimerStatus('First elimination complete! 3 answers remain.');
        updateGameStatus('🔥 First wrong answer eliminated!');
        announceToScreenReader('First wrong answer eliminated.');
    }
    
    // Phase 2 to Phase 3: Second elimination at 20 seconds (20 seconds elapsed)
    else if (timeRemaining === 20 && gameState.currentPhase === 2) {
        gameState.currentPhase = 3;
        eliminateWrongAnswer();
        updateTimerStatus('Second elimination complete! Final 2 answers remain.');
        updateGameStatus('⚡ Down to final 2 answers!');
        announceToScreenReader('Second wrong answer eliminated. Two answers remain.');
    }
    
    // Phase 3 to Phase 4: Final reveal at 0 seconds (40 seconds elapsed)
    else if (timeRemaining === 0 && gameState.currentPhase === 3) {
        gameState.currentPhase = 4;
        revealCorrectAnswer();
        updateTimerStatus('Challenge complete!');
        updateGameStatus('🎉 Challenge Complete! Correct answer revealed!');
        announceToScreenReader('Challenge complete! Correct answer revealed.');
    }
    
    // Dynamic status updates
    else if (timeRemaining > 20) {
        updateTimerStatus(`Next elimination in ${timeRemaining - 30} seconds...`);
    } else if (timeRemaining > 0) {
        updateTimerStatus(`Final reveal in ${timeRemaining} seconds...`);
    }
}

function stopTimer() {
    if (gameState.timerInterval) {
        clearInterval(gameState.timerInterval);
        gameState.timerInterval = null;
    }
}

function endGame() {
    stopTimer();
    gameState.isActive = false;
    
    // Enable control buttons
    elements.startBtn.disabled = false;
    elements.resetBtn.disabled = false;
    elements.nextBtn.disabled = false;
    
    updateTimerStatus('Challenge completed!');
    console.log('Game ended');
}

// Main Game Functions
function startTrivia() {
    if (gameState.isActive || gameState.showingQuestion) {
        console.log('Game already active or showing question');
        return;
    }
    
    // Start background music when game begins
    playBackgroundMusic();
    
    // Reset game state
    gameState.isActive = true;
    gameState.timeRemaining = GAME_CONFIG.TOTAL_TIME;
    gameState.currentPhase = 1;
    gameState.eliminatedAnswers = [];
    gameState.showingQuestion = false;
    gameState.showingFinalAnswer = false;
    
    // Hide any full-screen views
    hideFullscreenAnswer();
    
    // Reset visual elements
    elements.answerOptions.forEach(option => {
        option.classList.remove('eliminated', 'correct', 'eliminating');
        option.style.opacity = '1';
        option.style.transform = 'scale(1)';
        option.style.pointerEvents = 'auto';
        const overlay = option.querySelector('.elimination-overlay');
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0)';
    });
    
    // Update UI
    updateTimerCircle(gameState.timeRemaining);
    updateProgressBar();
    updateTimerStatus('Showing question for 10 seconds...');
    updateGameStatus('📖 Reading question phase...');
    
    // Disable start button, enable others
    elements.startBtn.disabled = true;
    elements.resetBtn.disabled = false;
    elements.nextBtn.disabled = false;
    
    // Start with full-screen question display
    const currentQuestion = triviaQuestions[gameState.currentQuestionIndex];
    showFullscreenQuestion(currentQuestion.question);
    
    announceToScreenReader('Trivia challenge started. Question will be displayed for 10 seconds, then the game timer begins.');
    console.log('Trivia challenge started with question display phase');
}

function resetTrivia() {
    // Stop all timers
    stopTimer();
    if (gameState.questionCountdownInterval) {
        clearInterval(gameState.questionCountdownInterval);
        gameState.questionCountdownInterval = null;
    }
    
    // Stop background music when game is reset
    stopBackgroundMusic();
    
    // Reset all states
    gameState.isActive = false;
    gameState.showingQuestion = false;
    gameState.showingFinalAnswer = false;
    gameState.timeRemaining = GAME_CONFIG.TOTAL_TIME;
    gameState.currentPhase = 1;
    gameState.eliminatedAnswers = [];
    
    // Hide all full-screen views
    elements.fullscreenQuestionView.classList.remove('active');
    elements.fullscreenAnswerView.classList.remove('active');
    elements.triviaContainer.classList.remove('hidden');
    
    // Reset visual elements
    elements.answerOptions.forEach(option => {
        option.classList.remove('eliminated', 'correct', 'eliminating');
        option.style.opacity = '1';
        option.style.transform = 'scale(1)';
        option.style.pointerEvents = 'auto';
        const overlay = option.querySelector('.elimination-overlay');
        overlay.style.opacity = '0';
        overlay.style.transform = 'scale(0)';
    });
    
    // Reset UI
    updateTimerCircle(gameState.timeRemaining);
    updateProgressBar();
    updateTimerStatus('Get ready to start...');
    updateGameStatus('Ready to start the 40-second challenge!');
    
    // Enable start button
    elements.startBtn.disabled = false;
    elements.resetBtn.disabled = false;
    elements.nextBtn.disabled = false;
    
    announceToScreenReader('Trivia challenge reset. Ready to start again.');
    console.log('Trivia challenge reset');
}

function nextQuestion() {
    // Stop current game if active
    if (gameState.isActive || gameState.showingQuestion || gameState.showingFinalAnswer) {
        stopTimer();
        if (gameState.questionCountdownInterval) {
            clearInterval(gameState.questionCountdownInterval);
            gameState.questionCountdownInterval = null;
        }
        gameState.isActive = false;
        gameState.showingQuestion = false;
        gameState.showingFinalAnswer = false;
    }
    
    // Move to next question
    gameState.currentQuestionIndex = (gameState.currentQuestionIndex + 1) % triviaQuestions.length;
    
    // Load new question
    loadQuestion(triviaQuestions[gameState.currentQuestionIndex]);
    
    // Reset game state
    resetTrivia();
    
    announceToScreenReader(`New question loaded: ${triviaQuestions[gameState.currentQuestionIndex].question}`);
    console.log('Loaded next question:', gameState.currentQuestionIndex);
}

// Keyboard Accessibility
function handleKeyboardNavigation(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        const focused = document.activeElement;
        
        if (focused.classList.contains('answer-option')) {
            event.preventDefault();
            const letter = focused.querySelector('.answer-letter').textContent;
            const text = focused.querySelector('.answer-text').textContent;
            announceToScreenReader(`Focused on Option ${letter}: ${text}`);
        }
    }
    
    // Quick shortcuts
    if (event.key === 's' || event.key === 'S') {
        if (!gameState.isActive) {
            startTrivia();
        }
    } else if (event.key === 'r' || event.key === 'R') {
        resetTrivia();
    } else if (event.key === 'n' || event.key === 'N') {
        nextQuestion();
    }
}

// Initialization
function initializeTrivia() {
    console.log('Initializing Enhanced Trivia Game...');
    
    // Initialize background music
    initializeBackgroundMusic();
    
    // Load first question
    loadQuestion(triviaQuestions[gameState.currentQuestionIndex]);
    
    // Set initial UI state
    updateTimerCircle(gameState.timeRemaining);
    updateProgressBar();
    updateTimerStatus('Get ready to start...');
    updateGameStatus('Ready to start the 40-second challenge!');
    
    // Add event listeners
    document.addEventListener('keydown', handleKeyboardNavigation);
    
    // Announce initialization
    announceToScreenReader('Enhanced trivia game loaded. Use the Start Challenge button to begin the 40-second timer.');
    
    console.log('Trivia game initialized successfully');
    console.log('Game configuration:', GAME_CONFIG);
    console.log('Available questions:', triviaQuestions.length);
}

// Page Load Event
window.addEventListener('load', loadTriviaQuestions);

// Visibility Change Handling
document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState.isActive) {
        console.log('Page hidden during active game - pausing might be needed');
    } else if (!document.hidden && gameState.isActive) {
        console.log('Page visible again during active game');
    }
});

// Export functions for global access (for onclick handlers)
window.startTrivia = startTrivia;
window.resetTrivia = resetTrivia;
window.nextQuestion = nextQuestion;
window.toggleBackgroundMusic = toggleBackgroundMusic;
window.setMusicVolume = setMusicVolume; 