# Raspberry Pi Game Hub - Node.js Express Version

A Node.js Express recreation of the original Django-based Raspberry Pi Game Hub. This project creates a local hotspot network that allows mobile devices to connect and view synchronized content in real-time.

## 🎮 Features

- **Local Hotspot Integration**: Automatically detects and generates QR codes for WiFi connection
- **Real-time Content Sync**: Uses Socket.IO for instant content updates across all connected devices
- **Cross-platform Hotspot Detection**: Works on Raspberry Pi, macOS, Windows, and Linux
- **Content Management System**: Create and manage text, image, and mixed content with custom styling
- **Device Tracking**: Monitor connected devices and usage statistics
- **Responsive Design**: Beautiful, modern UI optimized for both desktop and mobile
- **Auto-reconnection**: Robust WebSocket connections with automatic reconnection

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- Git

### Installation

1. **Clone and setup the project:**

   ```bash
   cd nodejs-gamehub
   npm install
   ```

2. **Start the server:**

   ```bash
   npm start
   ```

3. **For development (with auto-restart):**
   ```bash
   npm run dev
   ```

The server will start on port 8000 and automatically detect your local network settings.

## 📱 How to Use

### Step 1: Start the Server

Run the Node.js server on your Raspberry Pi or local machine:

```bash
npm start
```

### Step 2: Connect Mobile Devices

1. On the Pi display (http://your-ip:8000), you'll see QR codes
2. **WiFi QR Code**: Scan to auto-connect to your hotspot
3. **URL QR Code**: Scan to open the game hub on your phone
4. Or manually navigate to: `http://your-ip:8000/mobile/`

### Step 3: Manage Content

Visit the admin panel at `http://your-ip:8000/admin-panel/` to:

- Create new content (text, images, or mixed)
- Customize colors and fonts
- Activate content to push to all devices instantly
- Monitor connected device statistics

## 🏗️ Project Structure

```
nodejs-gamehub/
├── server.js              # Main Express server
├── src/
│   ├── database.js         # SQLite database operations
│   ├── network-utils.js    # Network detection utilities
│   └── qr-generator.js     # QR code generation
├── views/
│   ├── layout.hbs         # Main layout template
│   ├── pi_display.hbs     # Raspberry Pi display view
│   ├── mobile_display.hbs # Mobile device view
│   └── content_management.hbs # Admin panel
├── uploads/               # User uploaded images
├── gamehub.db            # SQLite database (created automatically)
└── package.json
```

## 🔧 API Endpoints

### Web Routes

- `GET /` - Pi display interface
- `GET /mobile/` - Mobile device interface
- `GET /admin-panel/` - Content management interface

### API Routes

- `POST /api/content/create/` - Create new content
- `POST /api/content/update/` - Activate content
- `GET /api/content/active/` - Get current active content
- `GET /api/stats/` - Get device statistics

### WebSocket Events

- `content_update` - Real-time content synchronization
- `device_heartbeat` - Keep device connections alive
- `get_active_content` - Request current content

## 🌐 Network Configuration

The system automatically detects hotspot settings for different platforms:

### Raspberry Pi

- Reads from `/etc/hostapd/hostapd.conf`
- Falls back to NetworkManager detection
- Default IP: `192.168.4.1`

### macOS

- Detects computer name via `scutil`
- Attempts to read Internet Sharing passwords from keychain
- Default IP: `192.168.2.1`

### Windows

- Uses hostname and attempts Mobile Hotspot profile detection
- Default IP: `192.168.137.1`

### Linux

- Uses NetworkManager where available
- Falls back to hostname detection
- Default IP: `192.168.4.1`

## 📊 Database Schema

The system uses SQLite with the following tables:

### game_content

- `id` - UUID primary key
- `title` - Content title
- `content_type` - Type: text, image, or mixed
- `text_content` - Text content
- `image_url` - Path to uploaded image
- `background_color` - Hex color code
- `text_color` - Hex color code
- `font_size` - Font size in pixels
- `is_active` - Boolean (only one can be active)
- `created_at`, `updated_at` - Timestamps

### connected_devices

- `id` - UUID primary key
- `session_id` - Unique session identifier
- `ip_address` - Client IP address
- `user_agent` - Client user agent
- `connected_at`, `last_seen` - Timestamps
- `is_active` - Boolean connection status

### game_sessions

- `id` - UUID primary key
- `name` - Session name
- `started_at`, `ended_at` - Session timestamps
- `is_active` - Boolean session status
- `qr_code_scans` - Count of QR code scans

## 🔨 Development

### Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run init-db` - Initialize database (if needed)

### Environment Variables

- `PORT` - Server port (default: 8000)
- `NODE_ENV` - Environment (development/production)

### Adding Features

1. **New API endpoints**: Add routes in `server.js`
2. **Database changes**: Modify `src/database.js`
3. **UI changes**: Edit templates in `views/`
4. **Network utilities**: Extend `src/network-utils.js`

## 🚨 Troubleshooting

### Common Issues

**"Could not detect hotspot password"**

- Check your system's hotspot configuration
- Ensure the hotspot is actually running
- Try manually setting the password in the admin panel

**"WebSocket connection failed"**

- Check firewall settings
- Ensure port 8000 is accessible
- Verify the server is running

**"No devices connecting"**

- Confirm hotspot is broadcasting
- Check IP address detection
- Try connecting manually to the displayed URL

### Log Output

The server logs include:

- Network detection results
- WebSocket connection events
- Database operations
- Error messages

## 📦 Dependencies

### Core Dependencies

- **express** - Web framework
- **socket.io** - Real-time WebSocket communication
- **better-sqlite3** - Fast SQLite database
- **express-handlebars** - Template engine
- **multer** - File upload handling
- **qrcode** - QR code generation
- **uuid** - UUID generation

### Development Dependencies

- **nodemon** - Development auto-restart

## 🔗 Comparison with Django Version

This Node.js version provides the same functionality as the original Django version:

| Feature      | Django Version      | Node.js Version         |
| ------------ | ------------------- | ----------------------- |
| Framework    | Django + Channels   | Express + Socket.IO     |
| Database     | SQLite + Django ORM | SQLite + better-sqlite3 |
| Templates    | Django Templates    | Handlebars              |
| WebSockets   | Django Channels     | Socket.IO               |
| File Uploads | Django Forms        | Multer                  |
| QR Codes     | qrcode + Pillow     | qrcode                  |

## 📄 License

MIT License - Feel free to use this project for any purpose.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review the server logs for error messages
3. Ensure all dependencies are properly installed
4. Verify network connectivity and hotspot functionality

---

**Happy Gaming! 🎮**
