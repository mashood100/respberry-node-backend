const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class GameHubDatabase {
    constructor() {
        this.db = new Database(path.join(__dirname, '..', 'gamehub.db'));
        this.initializeTables();
    }

    initializeTables() {
        // Create GameContent table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS game_content (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content_type TEXT DEFAULT 'text',
                text_content TEXT DEFAULT '',
                image_url TEXT,
                background_color TEXT DEFAULT '#ffffff',
                text_color TEXT DEFAULT '#000000',
                font_size INTEGER DEFAULT 24,
                is_active BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create ConnectedDevice table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS connected_devices (
                id TEXT PRIMARY KEY,
                session_id TEXT UNIQUE NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT 1
            )
        `);

        // Create GameSession table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS game_sessions (
                id TEXT PRIMARY KEY,
                name TEXT,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                ended_at DATETIME,
                is_active BOOLEAN DEFAULT 1,
                max_connected_devices INTEGER DEFAULT 0,
                qr_code_scans INTEGER DEFAULT 0
            )
        `);

        // Create trigger to ensure only one active content
        this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS ensure_single_active_content
            BEFORE UPDATE ON game_content
            WHEN NEW.is_active = 1
            BEGIN
                UPDATE game_content SET is_active = 0 WHERE is_active = 1 AND id != NEW.id;
            END
        `);

        // Create trigger for updated_at
        this.db.exec(`
            CREATE TRIGGER IF NOT EXISTS update_content_timestamp
            AFTER UPDATE ON game_content
            BEGIN
                UPDATE game_content SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);

        // Create default session if none exists
        const sessionCount = this.db.prepare('SELECT COUNT(*) as count FROM game_sessions WHERE is_active = 1').get();
        if (sessionCount.count === 0) {
            this.createGameSession('Default Session');
        }

        console.log('Database initialized successfully');
    }

    // GameContent methods
    createContent(data) {
        const id = uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO game_content (
                id, title, content_type, text_content, image_url, 
                background_color, text_color, font_size
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id,
            data.title,
            data.contentType || 'text',
            data.textContent || '',
            data.imageUrl || null,
            data.backgroundColor || '#ffffff',
            data.textColor || '#000000',
            data.fontSize || 24
        );

        return this.getContentById(id);
    }

    getContentById(id) {
        const stmt = this.db.prepare('SELECT * FROM game_content WHERE id = ?');
        const content = stmt.get(id);
        
        if (content) {
            return this.formatContent(content);
        }
        return null;
    }

    getAllContent() {
        const stmt = this.db.prepare('SELECT * FROM game_content ORDER BY created_at DESC');
        const contents = stmt.all();
        return contents.map(content => this.formatContent(content));
    }

    getActiveContent() {
        const stmt = this.db.prepare('SELECT * FROM game_content WHERE is_active = 1 LIMIT 1');
        const content = stmt.get();
        
        if (content) {
            return this.formatContent(content);
        }
        return null;
    }

    activateContent(contentId) {
        // First deactivate all content
        const deactivateStmt = this.db.prepare('UPDATE game_content SET is_active = 0');
        deactivateStmt.run();

        // Then activate the specified content
        const activateStmt = this.db.prepare('UPDATE game_content SET is_active = 1 WHERE id = ?');
        const result = activateStmt.run(contentId);

        if (result.changes > 0) {
            return this.getContentById(contentId);
        }
        return null;
    }

    formatContent(content) {
        return {
            id: content.id,
            title: content.title,
            contentType: content.content_type,
            textContent: content.text_content,
            imageUrl: content.image_url,
            backgroundColor: content.background_color,
            textColor: content.text_color,
            fontSize: content.font_size,
            isActive: Boolean(content.is_active),
            createdAt: content.created_at,
            updatedAt: content.updated_at
        };
    }

    // ConnectedDevice methods
    trackDevice(sessionId, ipAddress, userAgent) {
        // Check if device already exists
        const existingStmt = this.db.prepare('SELECT * FROM connected_devices WHERE session_id = ?');
        let device = existingStmt.get(sessionId);

        if (device) {
            // Update existing device
            const updateStmt = this.db.prepare(`
                UPDATE connected_devices 
                SET is_active = 1, last_seen = CURRENT_TIMESTAMP 
                WHERE session_id = ?
            `);
            updateStmt.run(sessionId);
        } else {
            // Create new device
            const id = uuidv4();
            const insertStmt = this.db.prepare(`
                INSERT INTO connected_devices (id, session_id, ip_address, user_agent)
                VALUES (?, ?, ?, ?)
            `);
            insertStmt.run(id, sessionId, ipAddress, userAgent);

            // Update QR scan count
            this.incrementQrScans();
        }

        // Return device info
        device = existingStmt.get(sessionId);
        return {
            id: device.id,
            sessionId: device.session_id,
            ipAddress: device.ip_address,
            userAgent: device.user_agent,
            connectedAt: device.connected_at,
            lastSeen: device.last_seen,
            isActive: Boolean(device.is_active)
        };
    }

    updateDeviceActivity(sessionId) {
        const stmt = this.db.prepare(`
            UPDATE connected_devices 
            SET last_seen = CURRENT_TIMESTAMP 
            WHERE session_id = ?
        `);
        stmt.run(sessionId);
    }

    getDeviceStats() {
        const totalStmt = this.db.prepare('SELECT COUNT(*) as count FROM connected_devices');
        const activeStmt = this.db.prepare('SELECT COUNT(*) as count FROM connected_devices WHERE is_active = 1');
        
        const total = totalStmt.get();
        const active = activeStmt.get();

        return {
            totalDevices: total.count,
            activeDevices: active.count
        };
    }

    // GameSession methods
    createGameSession(name) {
        const id = uuidv4();
        const stmt = this.db.prepare(`
            INSERT INTO game_sessions (id, name) VALUES (?, ?)
        `);
        stmt.run(id, name);
        return id;
    }

    incrementQrScans() {
        const stmt = this.db.prepare(`
            UPDATE game_sessions 
            SET qr_code_scans = qr_code_scans + 1 
            WHERE is_active = 1
        `);
        stmt.run();
    }

    // Utility methods
    cleanup() {
        // Mark devices as inactive if they haven't been seen in 5 minutes
        const stmt = this.db.prepare(`
            UPDATE connected_devices 
            SET is_active = 0 
            WHERE datetime(last_seen) < datetime('now', '-5 minutes')
        `);
        stmt.run();
    }

    // Call cleanup periodically
    startCleanupInterval() {
        setInterval(() => {
            this.cleanup();
        }, 60000); // Every minute
    }

    close() {
        this.db.close();
    }
}

module.exports = GameHubDatabase; 