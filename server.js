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
    currentPhase: 'waiting', // 'waiting', 'question-display', 'answering', 'results', 'finished'
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
        }
    ]
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

function updatePlayerAnswer(sessionId, answer) {
    const player = triviaGameState.players.get(sessionId);
    if (player && triviaGameState.currentPhase === 'answering') {
        player.currentAnswer = answer;
        player.answeredAt = Date.now();
        triviaGameState.currentAnswers.set(sessionId, answer);
        console.log(`📝 ${player.name} answered: ${answer}`);
        
        // Check if answer is correct and award points
        const currentQuestion = triviaGameState.questions[triviaGameState.currentQuestionIndex];
        if (answer === currentQuestion.correct) {
            player.score += 1;
            console.log(`🎉 ${player.name} got it right! Score: ${player.score}`);
        }
        
        broadcastGameState();
        return true;
    }
    return false;
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
        players: Array.from(triviaGameState.players.values()),
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
    
    // Clear previous answers
    triviaGameState.currentAnswers.clear();
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
    
    triviaGameState.gameTimer = setInterval(() => {
        triviaGameState.timeRemaining--;
        broadcastGameState();
        
        // Handle elimination at specific times
        if (triviaGameState.timeRemaining === 30) {
            io.emit('eliminate_wrong_answer', { eliminationCount: 1 });
        } else if (triviaGameState.timeRemaining === 20) {
            io.emit('eliminate_wrong_answer', { eliminationCount: 2 });
        }
        
        if (triviaGameState.timeRemaining <= 0) {
            clearInterval(triviaGameState.gameTimer);
            endQuestion();
        }
    }, 1000);
}

function endQuestion() {
    console.log('🏁 Question ended, showing results');
    triviaGameState.currentPhase = 'results';
    
    // Calculate and broadcast results
    const currentQuestion = triviaGameState.questions[triviaGameState.currentQuestionIndex];
    const results = {
        correctAnswer: currentQuestion.correct,
        playerResults: Array.from(triviaGameState.players.values()).map(player => ({
            name: player.name,
            answer: player.currentAnswer,
            isCorrect: player.currentAnswer === currentQuestion.correct,
            score: player.score,
            answeredAt: player.answeredAt
        }))
    };
    
    io.emit('question_results', results);
    broadcastGameState();
    
    // Move to next question or end game
    setTimeout(() => {
        triviaGameState.currentQuestionIndex++;
        if (triviaGameState.currentQuestionIndex >= triviaGameState.questions.length) {
            endGame();
        } else {
            // Clear answers for next question
            triviaGameState.currentAnswers.clear();
            triviaGameState.players.forEach(player => {
                player.currentAnswer = null;
                player.answeredAt = null;
            });
            startQuestionDisplayPhase();
        }
    }, 5000); // Show results for 5 seconds
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