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

// WebSocket handling with enhanced debugging
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