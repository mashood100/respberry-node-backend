const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

// Import our modules
const NetworkUtils = require('./src/network-utils');
const QRCodeGenerator = require('./src/qr-generator');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// In-memory storage for proof of concept
const gameData = {
    contents: [],
    devices: [],
    activeContentId: null
};

// Multiplayer Trivia Game State
const triviaGameState = {
    isActive: false,
    currentPhase: 'waiting', // 'waiting', 'question-display', 'answering', 'results', 'leaderboard', 'finished'
    currentQuestionIndex: 0,
    timeRemaining: 40,
    questionDisplayTimeRemaining: 10,
    players: new Map(), // sessionId -> player object
    currentAnswers: new Map(), // sessionId -> answer
    gameTimer: null,
    questionDisplayTimer: null,
    questions: [
        {
            question: "What is the capital city of France?",
            correct: "Paris",
            options: ["London", "Berlin", "Paris", "Madrid"]
        },
        {
            question: "Which planet is known as the Red Planet?",
            correct: "Mars", 
            options: ["Venus", "Mars", "Jupiter", "Saturn"]
        },
        {
            question: "What is the largest mammal in the world?",
            correct: "Blue Whale",
            options: ["African Elephant", "Blue Whale", "Giraffe", "Sperm Whale"]
        },
        {
            question: "In which year did World War II end?",
            correct: "1945",
            options: ["1943", "1944", "1945", "1946"]
        },
        {
            question: "What is the chemical symbol for gold?",
            correct: "Au",
            options: ["Go", "Gd", "Au", "Ag"]
        },
        {
            question: "Who painted the Mona Lisa?",
            correct: "Leonardo da Vinci",
            options: ["Pablo Picasso", "Leonardo da Vinci", "Vincent van Gogh", "Michelangelo"]
        },
        {
            question: "What is the smallest country in the world?",
            correct: "Vatican City",
            options: ["Monaco", "Vatican City", "San Marino", "Liechtenstein"]
        },
        {
            question: "Which element has the atomic number 1?",
            correct: "Hydrogen",
            options: ["Helium", "Hydrogen", "Oxygen", "Carbon"]
        },
        {
            question: "What is the hardest natural substance on Earth?",
            correct: "Diamond",
            options: ["Diamond", "Gold", "Iron", "Quartz"]
        },
        {
            question: "How many continents are there?",
            correct: "7",
            options: ["5", "6", "7", "8"]
        },
        {
            question: "What is the currency of Japan?",
            correct: "Yen",
            options: ["Yuan", "Yen", "Won", "Rupee"]
        },
        {
            question: "Which ocean is the largest?",
            correct: "Pacific Ocean",
            options: ["Atlantic Ocean", "Indian Ocean", "Pacific Ocean", "Arctic Ocean"]
        },
        {
            question: "What gas do plants absorb from the atmosphere?",
            correct: "Carbon Dioxide",
            options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Hydrogen"]
        },
        {
            question: "Who wrote 'Romeo and Juliet'?",
            correct: "William Shakespeare",
            options: ["Charles Dickens", "William Shakespeare", "Jane Austen", "Mark Twain"]
        },
        {
            question: "What is the speed of light in vacuum?",
            correct: "299,792,458 m/s",
            options: ["299,792,458 m/s", "300,000,000 m/s", "299,000,000 m/s", "298,792,458 m/s"]
        },
        {
            question: "Which planet has the most moons?",
            correct: "Saturn",
            options: ["Jupiter", "Saturn", "Earth", "Mars"]
        },
        {
            question: "What is the largest desert in the world?",
            correct: "Antarctica",
            options: ["Sahara", "Arabian", "Antarctica", "Gobi"]
        },
        {
            question: "Which programming language is known as the 'language of the web'?",
            correct: "JavaScript",
            options: ["Python", "Java", "JavaScript", "C++"]
        },
        {
            question: "What is the formula for water?",
            correct: "H2O",
            options: ["H2O", "CO2", "O2", "H2SO4"]
        },
        {
            question: "Who developed the theory of relativity?",
            correct: "Albert Einstein",
            options: ["Isaac Newton", "Albert Einstein", "Galileo Galilei", "Stephen Hawking"]
        }
    ],
    eliminatedAnswers: [] // New array to track eliminated wrong answers
};

// Player management functions
function addPlayer(sessionId, deviceInfo) {
    if (!triviaGameState.players.has(sessionId)) {
        const player = {
            sessionId: sessionId,
            name: `Player ${triviaGameState.players.size + 1}`,
            score: 0,
            currentAnswer: null,
            answeredAt: null,
            currentQuestionScore: 0,
            isConnected: true,
            deviceInfo: deviceInfo
        };
        triviaGameState.players.set(sessionId, player);
        console.log(`✅ Player added: ${player.name} (${sessionId})`);
        broadcastGameState();
        return player;
    }
    return triviaGameState.players.get(sessionId);
}

function removePlayer(sessionId) {
    if (triviaGameState.players.has(sessionId)) {
        const player = triviaGameState.players.get(sessionId);
        triviaGameState.players.delete(sessionId);
        console.log(`❌ Player removed: ${player.name} (${sessionId})`);
        broadcastGameState();
    }
}

// Calculate score based on correctness and time remaining
function calculateScore(isCorrect, timeRemaining) {
    if (!isCorrect) {
        return 0; // Wrong or no answer = 0 points
    }
    
    // Correct answer: 60 base points + time bonus (1 point per second remaining)
    const baseScore = 60;
    const timeBonus = Math.max(0, timeRemaining); // Ensure non-negative
    return baseScore + timeBonus;
}

function updatePlayerAnswer(sessionId, answer) {
    const player = triviaGameState.players.get(sessionId);
    if (player && triviaGameState.currentPhase === 'answering') {
        const previousAnswer = player.currentAnswer;
        player.currentAnswer = answer;
        player.answeredAt = Date.now();
        triviaGameState.currentAnswers.set(sessionId, answer);
        
        // Calculate current score dynamically (for real-time display)
        const currentQuestion = triviaGameState.questions[triviaGameState.currentQuestionIndex];
        const isCorrect = answer === currentQuestion.correct;
        const currentScore = calculateScore(isCorrect, triviaGameState.timeRemaining);
        
        // Store the current score temporarily (this will be finalized when question ends)
        player.currentQuestionScore = currentScore;
        
        if (previousAnswer && previousAnswer !== answer) {
            console.log(`📝 ${player.name} changed answer from: ${previousAnswer} to: ${answer} (Score: ${currentScore})`);
        } else {
            console.log(`📝 ${player.name} answered: ${answer} (Score: ${currentScore})`);
        }
        
        broadcastGameState();
        return true;
    }
    return false;
}

function updatePlayerName(sessionId, newName) {
    const player = triviaGameState.players.get(sessionId);
    if (player && triviaGameState.currentPhase === 'waiting') {
        const oldName = player.name;
        player.name = newName.trim().substring(0, 20); // Limit to 20 characters
        console.log(`✏️ Player name updated: ${oldName} -> ${player.name} (${sessionId})`);
        broadcastGameState();
        return { success: true, newName: player.name };
    }
    return { success: false, reason: 'Cannot update name after game starts' };
}

function getGameState() {
    const currentQuestion = triviaGameState.questions[triviaGameState.currentQuestionIndex];
    return {
        isActive: triviaGameState.isActive,
        currentPhase: triviaGameState.currentPhase,
        currentQuestionIndex: triviaGameState.currentQuestionIndex,
        totalQuestions: triviaGameState.questions.length,
        timeRemaining: triviaGameState.timeRemaining,
        questionDisplayTimeRemaining: triviaGameState.questionDisplayTimeRemaining,
        currentQuestion: currentQuestion,
        players: Array.from(triviaGameState.players.values()).map(player => ({
            ...player,
            currentQuestionScore: player.currentQuestionScore || 0 // Include current question score for real-time display
        })),
        playerCount: triviaGameState.players.size,
        answeredCount: triviaGameState.currentAnswers.size
    };
}

function broadcastGameState() {
    const state = getGameState();
    io.emit('game_state_update', state);
    console.log(`📡 Broadcasting game state: ${state.currentPhase}, players: ${state.playerCount}`);
}

// Game control functions
function startTriviaGame() {
    if (triviaGameState.isActive) {
        console.log('🚫 Game already active');
        return false;
    }
    
    console.log('🚀 Starting multiplayer trivia game');
    triviaGameState.isActive = true;
    triviaGameState.currentPhase = 'question-display';
    triviaGameState.currentQuestionIndex = 0;
    triviaGameState.questionDisplayTimeRemaining = 10;
    triviaGameState.timeRemaining = 40;
    
    // Clear previous answers and eliminations
    triviaGameState.currentAnswers.clear();
    triviaGameState.eliminatedAnswers = []; // Reset eliminated answers for first question
    triviaGameState.players.forEach(player => {
        player.currentAnswer = null;
        player.answeredAt = null;
    });
    
    broadcastGameState();
    startQuestionDisplayPhase();
    return true;
}

function startQuestionDisplayPhase() {
    console.log('📖 Starting question display phase (10 seconds)');
    triviaGameState.currentPhase = 'question-display';
    triviaGameState.questionDisplayTimeRemaining = 10;
    
    triviaGameState.questionDisplayTimer = setInterval(() => {
        triviaGameState.questionDisplayTimeRemaining--;
        broadcastGameState();
        
        if (triviaGameState.questionDisplayTimeRemaining <= 0) {
            clearInterval(triviaGameState.questionDisplayTimer);
            startAnsweringPhase();
        }
    }, 1000);
}

function startAnsweringPhase() {
    console.log('⏰ Starting answering phase (40 seconds)');
    triviaGameState.currentPhase = 'answering';
    triviaGameState.timeRemaining = 40;
    
    // Clear any existing timer before starting a new one
    if (triviaGameState.gameTimer) {
        clearInterval(triviaGameState.gameTimer);
    }
    
    triviaGameState.gameTimer = setInterval(() => {
        triviaGameState.timeRemaining--;
        
        // Don't recalculate scores every second - scores are locked when answered
        // Only broadcast the updated time
        broadcastGameState();
        
        // Handle elimination at specific times
        if (triviaGameState.timeRemaining === 25 || triviaGameState.timeRemaining === 10) {
            eliminateWrongAnswer();
        }
        
        if (triviaGameState.timeRemaining <= 0) {
            clearInterval(triviaGameState.gameTimer);
            endQuestion();
        }
    }, 1000);
}

function eliminateWrongAnswer() {
    const currentQuestion = triviaGameState.questions[triviaGameState.currentQuestionIndex];
    if (!currentQuestion) return;

    // Find answers that are not correct and have not been eliminated yet
    const availableWrongAnswers = currentQuestion.options
        .map((option, index) => ({ option, index }))
        .filter(item => item.option !== currentQuestion.correct && !triviaGameState.eliminatedAnswers.includes(item.index));

    if (availableWrongAnswers.length > 0) {
        // Randomly select one wrong answer to eliminate
        const randomIndex = Math.floor(Math.random() * availableWrongAnswers.length);
        const answerToEliminate = availableWrongAnswers[randomIndex];

        // Add to eliminated list and broadcast
        triviaGameState.eliminatedAnswers.push(answerToEliminate.index);
        io.emit('eliminate_wrong_answer', { answerIndex: answerToEliminate.index });
        console.log(`❌ Eliminating answer index: ${answerToEliminate.index}`);
    }
}

function endQuestion() {
    console.log('🏁 Question ended, showing results');
    triviaGameState.currentPhase = 'results';
    
    // Prepare results with current question scores before resetting them
    const currentQuestion = triviaGameState.questions[triviaGameState.currentQuestionIndex];
    const playerResults = [];
    
    triviaGameState.players.forEach(player => {
        const questionScore = player.currentQuestionScore || 0;
        
        if (player.currentAnswer) {
            // Add the current question score to total score
            player.score += questionScore;
            console.log(`📊 ${player.name}: +${questionScore} points (Total: ${player.score})`);
        } else {
            console.log(`📊 ${player.name}: No answer, +0 points (Total: ${player.score})`);
        }
        
        // Store result data before resetting
        playerResults.push({
            name: player.name,
            answer: player.currentAnswer,
            isCorrect: player.currentAnswer === currentQuestion.correct,
            score: player.score,
            answeredAt: player.answeredAt,
            questionScore: questionScore // Store the actual score earned this question
        });
        
        // Reset current question score
        player.currentQuestionScore = 0;
    });
    
    // Calculate and broadcast results
    const results = {
        correctAnswer: currentQuestion.correct,
        playerResults: playerResults
    };
    
    io.emit('question_results', results);
    broadcastGameState();
    
    // Move to next question or end game
    setTimeout(() => {
        triviaGameState.currentQuestionIndex++;
        
        if (triviaGameState.currentQuestionIndex >= triviaGameState.questions.length) {
            // Game finished - show final leaderboard
            endGame();
        } else {
            // Check if we should show leaderboard (every 5 questions)
            const questionNumber = triviaGameState.currentQuestionIndex + 1; // +1 because we just finished a question
            if (questionNumber % 5 === 0) {
                // Show leaderboard every 5 questions
                showLeaderboard();
            } else {
                // Continue to next question
                prepareNextQuestion();
            }
        }
    }, 5000); // Show results for 5 seconds
}

function prepareNextQuestion() {
    // Clear answers for next question
    triviaGameState.currentAnswers.clear();
    triviaGameState.eliminatedAnswers = []; // Reset eliminated answers for the new question
    triviaGameState.players.forEach(player => {
        player.currentAnswer = null;
        player.answeredAt = null;
        player.currentQuestionScore = 0; // Reset score for new question
    });
    startQuestionDisplayPhase();
}

function showLeaderboard() {
    console.log('📊 Showing leaderboard after question', triviaGameState.currentQuestionIndex);
    triviaGameState.currentPhase = 'leaderboard';
    
    // Create leaderboard data
    const leaderboardData = {
        currentQuestion: triviaGameState.currentQuestionIndex,
        totalQuestions: triviaGameState.questions.length,
        leaderboard: Array.from(triviaGameState.players.values())
            .sort((a, b) => b.score - a.score)
            .map((player, index) => ({
                rank: index + 1,
                name: player.name,
                score: player.score,
                sessionId: player.sessionId
            }))
    };
    
    io.emit('show_leaderboard', leaderboardData);
    broadcastGameState();
    
    // Continue to next question after 8 seconds
    setTimeout(() => {
        prepareNextQuestion();
    }, 8000);
}

function endGame() {
    console.log('🎊 Game finished!');
    triviaGameState.currentPhase = 'finished';
    triviaGameState.isActive = false;
    
    // Calculate final rankings
    const finalResults = Array.from(triviaGameState.players.values())
        .sort((a, b) => b.score - a.score)
        .map((player, index) => ({
            rank: index + 1,
            name: player.name,
            score: player.score,
            sessionId: player.sessionId
        }));
    
    io.emit('game_finished', {
        finalResults: finalResults,
        totalQuestions: triviaGameState.questions.length
    });
    
    broadcastGameState();
}

function resetTriviaGame() {
    console.log('🔄 Resetting trivia game');
    
    // Clear timers
    if (triviaGameState.gameTimer) {
        clearInterval(triviaGameState.gameTimer);
        triviaGameState.gameTimer = null;
    }
    if (triviaGameState.questionDisplayTimer) {
        clearInterval(triviaGameState.questionDisplayTimer);
        triviaGameState.questionDisplayTimer = null;
    }
    
    // Reset game state
    triviaGameState.isActive = false;
    triviaGameState.currentPhase = 'waiting';
    triviaGameState.currentQuestionIndex = 0;
    triviaGameState.timeRemaining = 40;
    triviaGameState.questionDisplayTimeRemaining = 10;
    triviaGameState.currentAnswers.clear();
    triviaGameState.eliminatedAnswers = []; // Reset eliminated answers
    
    // Reset player scores but keep them connected
    triviaGameState.players.forEach(player => {
        player.score = 0;
        player.currentAnswer = null;
        player.answeredAt = null;
    });
    
    broadcastGameState();
}

// Simple data management functions
function createContent(data) {
    const content = {
        id: uuidv4(),
        title: data.title,
        contentType: data.contentType || 'text',
        textContent: data.textContent || '',
        imageUrl: data.imageUrl || null,
        backgroundColor: data.backgroundColor || '#ffffff',
        textColor: data.textColor || '#000000',
        fontSize: data.fontSize || 24,
        isActive: false,
        createdAt: new Date().toISOString()
    };
    gameData.contents.push(content);
    return content;
}

function activateContent(contentId) {
    // Deactivate all content
    gameData.contents.forEach(content => content.isActive = false);
    
    // Activate the specified content
    const content = gameData.contents.find(c => c.id === contentId);
    if (content) {
        content.isActive = true;
        gameData.activeContentId = contentId;
        return content;
    }
    return null;
}

function getActiveContent() {
    return gameData.contents.find(content => content.isActive) || null;
}

function getAllContent() {
    return gameData.contents.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function trackDevice(sessionId, ipAddress, userAgent) {
    let device = gameData.devices.find(d => d.sessionId === sessionId);
    
    if (device) {
        device.isActive = true;
        device.lastSeen = new Date().toISOString();
    } else {
        device = {
            id: uuidv4(),
            sessionId,
            ipAddress,
            userAgent,
            connectedAt: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            isActive: true
        };
        gameData.devices.push(device);
    }
    
    return device;
}

function getDeviceStats() {
    const totalDevices = gameData.devices.length;
    const activeDevices = gameData.devices.filter(d => d.isActive).length;
    return { totalDevices, activeDevices };
}

// Create some initial sample content
const sampleContent1 = createContent({
    title: 'Welcome to Game Hub!',
    contentType: 'text',
    textContent: '🎮 Welcome to the Node.js Game Hub! Connect your mobile devices and enjoy synchronized content.Visit the admin panel to create your own content.',
    backgroundColor: '#4CAF50',
    textColor: '#ffffff',
    fontSize: 28
});

activateContent(sampleContent1.id);

createContent({
    title: 'Instructions',
    contentType: 'text',
    textContent: '📱 How to Connect:1. Scan the WiFi QR code 2. Scan the URL QR code 3. Enjoy synchronized content!',
    backgroundColor: '#2196F3',
    textColor: '#ffffff',
    fontSize: 24
});

// Middleware
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'gamehub-nodejs-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Configure Handlebars
const { engine } = require('express-handlebars');
app.engine('hbs', engine({
    extname: 'hbs',
    defaultLayout: 'layout',
    layoutsDir: path.join(__dirname, 'views'),
    partialsDir: path.join(__dirname, 'views/partials')
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Static files
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
    fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Utility function to get device ID
function getDeviceId(req) {
    if (!req.session.deviceId) {
        req.session.deviceId = uuidv4();
    }
    return req.session.deviceId;
}

// Routes

// Main Pi Display Route
app.get('/', async (req, res) => {
    try {
        const currentIp = await NetworkUtils.getLocalIp();
        const mobileUrl = `http://${currentIp}:8000/mobile/`;
        
        const [hotspotName, hotspotPassword, hotspotSource] = await NetworkUtils.getDeviceHotspotSettings();
        
        let passwordWarning = null;
        let wifiQrCode = null;
        
        if (!hotspotPassword) {
            passwordWarning = "⚠️ Could not detect hotspot password. Please check your system settings.";
        } else {
            wifiQrCode = await QRCodeGenerator.generateWifiQrCode(hotspotName, hotspotPassword, mobileUrl);
        }
        
        const urlQrCode = await QRCodeGenerator.generateQrCode(mobileUrl);
        const activeContent = getActiveContent();
        const stats = getDeviceStats();
        
        res.render('pi_display', {
            currentIp,
            mobileUrl,
            hotspotName,
            hotspotPassword: hotspotPassword || "❌ PASSWORD NEEDED",
            hotspotSource,
            passwordWarning,
            wifiQrCode,
            urlQrCode,
            activeContent,
            totalDevices: stats.totalDevices,
            activeDevices: stats.activeDevices
        });
    } catch (error) {
        console.error('Error in main route:', error);
        res.status(500).send('Server Error');
    }
});

// Mobile Display Route
app.get('/mobile/', (req, res) => {
    try {
        const sessionId = req.sessionID;
        const deviceId = getDeviceId(req);
        
        // Get client IP
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'] || '';
        
        console.log('📱 Mobile client connecting from IP:', ip);
        
        // Track this device
        const device = trackDevice(sessionId, ip, userAgent);
        
        // Get active content
        const activeContent = getActiveContent();
        
        res.render('mobile_display', {
            activeContent,
            device: {
                sessionId: device.sessionId
            }
        });
    } catch (error) {
        console.error('Error in mobile route:', error);
        res.status(500).send('Server Error');
    }
});

// WebSocket Debug Route
app.get('/debug/', (req, res) => {
    try {
        // Get client and server IP information
        const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
        const serverIP = req.get('host') || req.hostname;
        
        console.log('🔧 Debug page accessed from:', clientIP);
        
        res.render('debug_websocket', {
            clientIP: clientIP,
            serverIP: serverIP
        });
    } catch (error) {
        console.error('Error in debug route:', error);
        res.status(500).send('Server Error');
    }
});

// Content Management Route
app.get('/admin-panel/', (req, res) => {
    try {
        const contents = getAllContent();
        const activeContent = getActiveContent();
        
        res.render('content_management', {
            contents,
            activeContent
        });
    } catch (error) {
        console.error('Error in admin panel route:', error);
        res.status(500).send('Server Error');
    }
});

// Trivia Question Route (Main Display Screen)
app.get('/trivia/', async (req, res) => {
    try {
        console.log('🎯 Trivia main display accessed');
        
        // Get network information for QR codes
        const currentIp = await NetworkUtils.getLocalIp();
        const userUrl = `http://${currentIp}:8000/user/`;
        
        // Use fixed WiFi credentials for the game
        const hotspotName = "GameHub-Direct";
        const hotspotPassword = "gamehub123";
        
        let passwordWarning = null;
        let wifiQrCode = null;
        
        try {
            // Generate WiFi QR code that connects to hotspot and opens user page
            wifiQrCode = await QRCodeGenerator.generateWifiQrCode(hotspotName, hotspotPassword, userUrl);
            console.log('✅ WiFi QR code generated successfully');
        } catch (error) {
            console.error('❌ Error generating WiFi QR code:', error);
            wifiQrCode = null;
        }
        
        // Generate URL QR code specifically for user page
        let userUrlQrCode = null;
        try {
            console.log('🔄 Generating QR code for URL:', userUrl);
            userUrlQrCode = await QRCodeGenerator.generateQrCode(userUrl, 8);
            if (userUrlQrCode) {
                console.log('✅ User URL QR code generated successfully, length:', userUrlQrCode.length);
            } else {
                console.log('⚠️ QR code generated but returned null/empty');
            }
        } catch (error) {
            console.error('❌ Error generating User URL QR code:', error);
            console.error('❌ Error details:', error.message);
            userUrlQrCode = null;
        }
        
        console.log('🔗 Generated QR codes for trivia game:', {
            hotspotName,
            hasPassword: !!hotspotPassword,
            userUrl,
            hasWifiQr: !!wifiQrCode,
            hasUserQr: !!userUrlQrCode,
            wifiQrLength: wifiQrCode ? wifiQrCode.length : 0,
            userQrLength: userUrlQrCode ? userUrlQrCode.length : 0
        });
        
        res.render('trivia_display', {
            currentIp,
            userUrl,
            hotspotName,
            hotspotPassword,
            passwordWarning,
            wifiQrCode,
            userUrlQrCode
        });
    } catch (error) {
        console.error('Error in trivia route:', error);
        res.status(500).send('Server Error');
    }
});

// User Route (Individual Player Screen)
app.get('/user/', (req, res) => {
    try {
        const sessionId = req.sessionID;
        const deviceId = getDeviceId(req);
        
        // Get client IP
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'] || '';
        
        console.log('📱 User client connecting from IP:', ip);
        
        // Track this device as a player
        const device = trackDevice(sessionId, ip, userAgent);
        
        res.render('trivia_user', {
            device: {
                sessionId: device.sessionId,
                id: device.id
            }
        });
    } catch (error) {
        console.error('Error in user route:', error);
        res.status(500).send('Server Error');
    }
});

// API Routes

// Create new content
app.post('/api/content/create/', upload.single('image'), (req, res) => {
    try {
        const {
            title,
            content_type = 'text',
            text_content = '',
            background_color = '#ffffff',
            text_color = '#000000',
            font_size = 24
        } = req.body;
        
        const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
        
        const content = createContent({
            title,
            contentType: content_type,
            textContent: text_content,
            backgroundColor: background_color,
            textColor: text_color,
            fontSize: parseInt(font_size),
            imageUrl
        });
        
        res.json({
            success: true,
            message: 'Content created',
            contentId: content.id
        });
    } catch (error) {
        console.error('Error creating content:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// Update/activate content
app.post('/api/content/update/', (req, res) => {
    try {
        const { content_id } = req.body;
        
        if (!content_id) {
            return res.json({
                success: false,
                message: 'Content ID required'
            });
        }
        
        const content = activateContent(content_id);
        
        if (!content) {
            return res.json({
                success: false,
                message: 'Content not found'
            });
        }
        
        // Notify all connected clients via WebSocket
        const updateData = {
            id: content.id,
            title: content.title,
            content_type: content.contentType,
            text_content: content.textContent,
            image_url: content.imageUrl,
            background_color: content.backgroundColor,
            text_color: content.textColor,
            font_size: content.fontSize
        };
        
        console.log('📢 Broadcasting content update to all clients:', updateData);
        console.log('🔗 Connected clients count:', io.engine.clientsCount);
        
        io.emit('content_update', updateData);
        
        res.json({
            success: true,
            message: 'Content updated and broadcast sent',
            connectedClients: io.engine.clientsCount
        });
    } catch (error) {
        console.error('Error updating content:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// Get active content
app.get('/api/content/active/', (req, res) => {
    try {
        const activeContent = getActiveContent();
        
        if (activeContent) {
            res.json({
                success: true,
                content: {
                    id: activeContent.id,
                    title: activeContent.title,
                    content_type: activeContent.contentType,
                    text_content: activeContent.textContent,
                    image_url: activeContent.imageUrl,
                    background_color: activeContent.backgroundColor,
                    text_color: activeContent.textColor,
                    font_size: activeContent.fontSize
                }
            });
        } else {
            res.json({
                success: false,
                message: 'No active content'
            });
        }
    } catch (error) {
        console.error('Error getting active content:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// Get device stats
app.get('/api/stats/', async (req, res) => {
    try {
        const stats = getDeviceStats();
        const currentIp = await NetworkUtils.getLocalIp();
        const [hotspotName] = await NetworkUtils.getDeviceHotspotSettings();
        
        res.json({
            total_devices: stats.totalDevices,
            active_devices: stats.activeDevices,
            server_ip: currentIp,
            hotspot_name: hotspotName
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.json({
            total_devices: 0,
            active_devices: 0,
            server_ip: 'Unknown',
            hotspot_name: 'GameHub-Direct'
        });
    }
});

// Stats API endpoint
app.get('/api/stats/', (req, res) => {
    try {
        const stats = getDeviceStats();
        const connectedClients = io.engine.clientsCount || 0;
        
        res.json({
            success: true,
            active_devices: stats.activeDevices,
            total_devices: stats.totalDevices,
            connected_websockets: connectedClients,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// File System API endpoints for game setup
const os = require('os');

// Get available storage devices/drives
app.get('/api/filesystem/drives/', (req, res) => {
    try {
        const drives = [];
        
        if (process.platform === 'win32') {
            // Windows - enumerate drive letters
            for (let i = 65; i <= 90; i++) { // A-Z
                const driveLetter = String.fromCharCode(i) + ':';
                const drivePath = driveLetter + '\\';
                try {
                    if (fs.existsSync(drivePath)) {
                        const stats = fs.statSync(drivePath);
                        drives.push({
                            name: driveLetter,
                            path: drivePath,
                            type: 'drive',
                            size: null // Could add size detection later
                        });
                    }
                } catch (err) {
                    // Drive not accessible, skip
                }
            }
        } else {
            // Unix-like systems (Linux, macOS, Raspberry Pi)
            drives.push({
                name: 'Root (/)',
                path: '/',
                type: 'drive',
                size: null
            });
            
            // Add common mount points
            const commonMounts = ['/home', '/Users', '/mnt', '/media', '/Volumes'];
            commonMounts.forEach(mountPath => {
                try {
                    if (fs.existsSync(mountPath)) {
                        const items = fs.readdirSync(mountPath);
                        items.forEach(item => {
                            const fullPath = path.join(mountPath, item);
                            try {
                                const stats = fs.statSync(fullPath);
                                if (stats.isDirectory()) {
                                    drives.push({
                                        name: `${item} (${mountPath})`,
                                        path: fullPath,
                                        type: 'mount',
                                        size: null
                                    });
                                }
                            } catch (err) {
                                // Skip inaccessible directories
                            }
                        });
                    }
                } catch (err) {
                    // Mount point doesn't exist or not accessible
                }
            });
        }
        
        res.json({
            success: true,
            drives: drives
        });
    } catch (error) {
        console.error('Error getting drives:', error);
        res.json({
            success: false,
            message: error.message,
            drives: []
        });
    }
});

// Browse folders in a given path
app.post('/api/filesystem/browse/', (req, res) => {
    try {
        const { folderPath } = req.body;
        
        if (!folderPath) {
            return res.json({
                success: false,
                message: 'Folder path is required'
            });
        }
        
        // Security check - prevent access to sensitive system directories
        const normalizedPath = path.normalize(folderPath);
        const blacklistedPaths = [
            '/etc', '/sys', '/proc', '/dev', '/boot',
            'C:\\Windows\\System32', 'C:\\Windows\\system32',
            'C:\\Program Files', 'C:\\Program Files (x86)'
        ];
        
        const isBlacklisted = blacklistedPaths.some(blacklisted => 
            normalizedPath.startsWith(blacklisted)
        );
        
        if (isBlacklisted) {
            return res.json({
                success: false,
                message: 'Access to this directory is not allowed for security reasons'
            });
        }
        
        if (!fs.existsSync(normalizedPath)) {
            return res.json({
                success: false,
                message: 'Path does not exist'
            });
        }
        
        const items = fs.readdirSync(normalizedPath);
        const folders = [];
        
        items.forEach(item => {
            try {
                const fullPath = path.join(normalizedPath, item);
                const stats = fs.statSync(fullPath);
                
                if (stats.isDirectory()) {
                    folders.push({
                        name: item,
                        path: fullPath,
                        isDirectory: true,
                        size: null,
                        modified: stats.mtime
                    });
                }
            } catch (err) {
                // Skip inaccessible items
            }
        });
        
        // Sort folders alphabetically
        folders.sort((a, b) => a.name.localeCompare(b.name));
        
        res.json({
            success: true,
            currentPath: normalizedPath,
            folders: folders
        });
    } catch (error) {
        console.error('Error browsing folders:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// Check for specific folder and handle replacement
app.post('/api/filesystem/setup-game/', (req, res) => {
    try {
        const { targetPath, folderName = 'GameHub-Setup' } = req.body; // Default folder name, can be customized
        
        if (!targetPath) {
            return res.json({
                success: false,
                message: 'Target path is required'
            });
        }
        
        const normalizedPath = path.normalize(targetPath);
        const gameFolder = path.join(normalizedPath, folderName);
        
        // Check if the folder exists
        const folderExists = fs.existsSync(gameFolder);
        
        if (folderExists) {
            // Backup existing folder
            const backupFolder = path.join(normalizedPath, `${folderName}_backup_${Date.now()}`);
            try {
                fs.renameSync(gameFolder, backupFolder);
                console.log(`Backed up existing folder to: ${backupFolder}`);
            } catch (err) {
                return res.json({
                    success: false,
                    message: `Failed to backup existing folder: ${err.message}`
                });
            }
        }
        
        // Create new game folder
        try {
            fs.mkdirSync(gameFolder, { recursive: true });
            
            // Create initial game structure (you can customize this)
            const gameStructure = [
                'config',
                'assets',
                'questions',
                'logs'
            ];
            
            gameStructure.forEach(subFolder => {
                const subFolderPath = path.join(gameFolder, subFolder);
                fs.mkdirSync(subFolderPath, { recursive: true });
            });
            
            // Create a sample config file
            const configContent = {
                version: "1.0.0",
                created: new Date().toISOString(),
                gameType: "trivia",
                settings: {
                    maxPlayers: 50,
                    questionTime: 30,
                    autoStart: false
                }
            };
            
            fs.writeFileSync(
                path.join(gameFolder, 'config', 'game-config.json'),
                JSON.stringify(configContent, null, 2)
            );
            
            res.json({
                success: true,
                message: `Game setup completed successfully at: ${gameFolder}`,
                details: {
                    folderCreated: gameFolder,
                    folderExisted: folderExists,
                    backupCreated: folderExists ? `${folderName}_backup_${Date.now()}` : null
                }
            });
            
        } catch (err) {
            res.json({
                success: false,
                message: `Failed to create game folder: ${err.message}`
            });
        }
        
    } catch (error) {
        console.error('Error setting up game:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// Simple API to replace trivia_game folder
app.post('/api/replace-trivia-folder/', (req, res) => {
    try {
        const triviaGamePath = path.join(__dirname, 'static', 'trivia_game');
        
        // Check if the folder exists
        const folderExists = fs.existsSync(triviaGamePath);
        
        if (folderExists) {
            // Remove existing folder
            try {
                fs.rmSync(triviaGamePath, { recursive: true, force: true });
                console.log('Removed existing trivia_game folder');
            } catch (err) {
                return res.json({
                    success: false,
                    message: `Failed to remove existing folder: ${err.message}`
                });
            }
        }
        
        // Create new trivia_game folder
        try {
            fs.mkdirSync(triviaGamePath, { recursive: true });
            
            // Create a new trivia_questions.json file
            const newQuestions = [
                {
                    "question": "What is the capital of France?",
                    "options": ["London", "Berlin", "Paris", "Madrid"],
                    "correct": 2
                },
                {
                    "question": "Which planet is known as the Red Planet?",
                    "options": ["Venus", "Mars", "Jupiter", "Saturn"],
                    "correct": 1
                }
            ];
            
            fs.writeFileSync(
                path.join(triviaGamePath, 'trivia_questions.json'),
                JSON.stringify(newQuestions, null, 2)
            );
            
            res.json({
                success: true,
                message: `Trivia game folder replaced successfully at: ${triviaGamePath}`,
                details: {
                    folderPath: triviaGamePath,
                    folderExisted: folderExists,
                    filesCreated: ['trivia_questions.json']
                }
            });
            
        } catch (err) {
            res.json({
                success: false,
                message: `Failed to create new folder: ${err.message}`
            });
        }
        
    } catch (error) {
        console.error('Error replacing trivia folder:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// WebSocket handling with enhanced debugging and multiplayer trivia
io.on('connection', (socket) => {
    console.log('🔗 Client connected:', socket.id, '| Total clients:', io.engine.clientsCount);
    
    // Send current active content to newly connected client
    const activeContent = getActiveContent();
    if (activeContent) {
        const contentData = {
            id: activeContent.id,
            title: activeContent.title,
            content_type: activeContent.contentType,
            text_content: activeContent.textContent,
            image_url: activeContent.imageUrl,
            background_color: activeContent.backgroundColor,
            text_color: activeContent.textColor,
            font_size: activeContent.fontSize
        };
        
        console.log('📤 Sending initial content to new client:', socket.id, contentData.title);
        socket.emit('content_update', contentData);
    } else {
        console.log('📭 No active content to send to new client:', socket.id);
    }
    
    // MULTIPLAYER TRIVIA EVENTS
    
    // Player joins trivia game
    socket.on('join_trivia_game', (data) => {
        console.log('🎮 Player joining trivia game:', socket.id, data);
        const player = addPlayer(data.sessionId, {
            socketId: socket.id,
            userAgent: data.userAgent || 'Unknown'
        });
        
        // Send current game state to the player
        socket.emit('game_state_update', getGameState());
        socket.emit('player_joined', {
            player: player,
            gameState: getGameState()
        });
        
        // Store session ID in socket for cleanup
        socket.sessionId = data.sessionId;
    });
    
    // Player submits an answer
    socket.on('submit_answer', (data) => {
        console.log('📝 Answer submitted:', socket.id, data);
        const success = updatePlayerAnswer(data.sessionId, data.answer);
        
        socket.emit('answer_submitted', {
            success: success,
            answer: data.answer,
            timestamp: Date.now()
        });
    });
    
    // Player updates their name
    socket.on('update_player_name', (data) => {
        console.log('✏️ Name update request:', socket.id, data);
        const result = updatePlayerName(data.sessionId, data.newName);
        
        socket.emit('name_update_response', {
            success: result.success,
            newName: result.newName,
            reason: result.reason,
            timestamp: Date.now()
        });
    });
    
    // Game control events (for host/admin)
    socket.on('start_trivia_game', () => {
        console.log('🚀 Start game request from:', socket.id);
        const started = startTriviaGame();
        socket.emit('game_start_response', { success: started });
    });
    
    socket.on('reset_trivia_game', () => {
        console.log('🔄 Reset game request from:', socket.id);
        resetTriviaGame();
        socket.emit('game_reset_response', { success: true });
    });
    
    // Request current game state
    socket.on('get_game_state', () => {
        socket.emit('game_state_update', getGameState());
    });
    
    // ORIGINAL CONTENT MANAGEMENT EVENTS
    
    // Handle device heartbeat
    socket.on('device_heartbeat', (data) => {
        console.log('💓 Heartbeat from:', socket.id, data);
        
        if (data.session_id) {
            // Update device activity in memory
            const device = gameData.devices.find(d => d.sessionId === data.session_id);
            if (device) {
                device.lastSeen = new Date().toISOString();
                device.isActive = true;
                console.log('💓 Updated device activity:', device.sessionId);
            }
        }
    });
    
    // Handle get active content request
    socket.on('get_active_content', () => {
        console.log('📥 Client requesting active content:', socket.id);
        
        const activeContent = getActiveContent();
        if (activeContent) {
            const contentData = {
                id: activeContent.id,
                title: activeContent.title,
                content_type: activeContent.contentType,
                text_content: activeContent.textContent,
                image_url: activeContent.imageUrl,
                background_color: activeContent.backgroundColor,
                text_color: activeContent.textColor,
                font_size: activeContent.fontSize
            };
            
            console.log('📤 Sending requested content to:', socket.id, contentData.title);
            socket.emit('content_update', contentData);
        } else {
            console.log('📭 No active content available for:', socket.id);
        }
    });
    
    // Handle admin test broadcasts
    socket.on('admin_test', (data) => {
        console.log('🧪 Admin test broadcast received:', data);
        
        // Broadcast test message to all clients
        io.emit('admin_test_response', {
            message: 'Test broadcast successful!',
            original: data,
            timestamp: new Date().toISOString(),
            connectedClients: io.engine.clientsCount
        });
        
        console.log('🧪 Test broadcast sent to all clients');
    });
    
    socket.on('disconnect', (reason) => {
        console.log('❌ Client disconnected:', socket.id, '| Reason:', reason, '| Remaining clients:', io.engine.clientsCount);
        
        // Remove player from trivia game if they were connected
        if (socket.sessionId) {
            console.log('🎮 Removing player from trivia game:', socket.sessionId);
            removePlayer(socket.sessionId);
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
    });
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, '0.0.0.0', async () => {
    console.log(`🎮 Raspberry Pi Game Hub running on port ${PORT}`);
    console.log(`📱 Local access: http://localhost:${PORT}`);
    
    try {
        const localIp = await NetworkUtils.getLocalIp();
        console.log(`🌐 Network access: http://${localIp}:${PORT}`);
        console.log(`📱 Mobile URL: http://${localIp}:${PORT}/mobile/`);
        
        const [hotspotName, hotspotPassword] = await NetworkUtils.getDeviceHotspotSettings();
        console.log(`📡 WiFi: ${hotspotName} / ${hotspotPassword || 'Password detection failed'}`);
    } catch (error) {
        console.log('Network detection failed, using defaults');
    }
    
    console.log('🚀 Server ready for connections!');
}); 