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
const Database = require('./src/database');
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

// Database setup
const db = new Database();
db.startCleanupInterval(); // Start periodic cleanup

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
        const activeContent = db.getActiveContent();
        const stats = db.getDeviceStats();
        
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
        
        // Track this device
        const device = db.trackDevice(sessionId, ip, userAgent);
        
        // Get active content
        const activeContent = db.getActiveContent();
        
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

// Content Management Route
app.get('/admin-panel/', (req, res) => {
    try {
        const contents = db.getAllContent();
        const activeContent = db.getActiveContent();
        
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
        
        const content = db.createContent({
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
        
        const content = db.activateContent(content_id);
        
        if (!content) {
            return res.json({
                success: false,
                message: 'Content not found'
            });
        }
        
        // Notify all connected clients via WebSocket
        io.emit('content_update', {
            id: content.id,
            title: content.title,
            content_type: content.contentType,
            text_content: content.textContent,
            image_url: content.imageUrl,
            background_color: content.backgroundColor,
            text_color: content.textColor,
            font_size: content.fontSize
        });
        
        res.json({
            success: true,
            message: 'Content updated'
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
        const activeContent = db.getActiveContent();
        
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
        const stats = db.getDeviceStats();
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

// WebSocket handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Send current active content to newly connected client
    const activeContent = db.getActiveContent();
    if (activeContent) {
        socket.emit('content_update', {
            id: activeContent.id,
            title: activeContent.title,
            content_type: activeContent.contentType,
            text_content: activeContent.textContent,
            image_url: activeContent.imageUrl,
            background_color: activeContent.backgroundColor,
            text_color: activeContent.textColor,
            font_size: activeContent.fontSize
        });
    }
    
    // Handle device heartbeat
    socket.on('device_heartbeat', (data) => {
        if (data.session_id) {
            db.updateDeviceActivity(data.session_id);
        }
    });
    
    // Handle get active content request
    socket.on('get_active_content', () => {
        const activeContent = db.getActiveContent();
        if (activeContent) {
            socket.emit('content_update', {
                id: activeContent.id,
                title: activeContent.title,
                content_type: activeContent.contentType,
                text_content: activeContent.textContent,
                image_url: activeContent.imageUrl,
                background_color: activeContent.backgroundColor,
                text_color: activeContent.textColor,
                font_size: activeContent.fontSize
            });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
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