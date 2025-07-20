const Database = require('../src/database');

console.log('🎮 Initializing Raspberry Pi Game Hub Database...');

try {
    const db = new Database();
    
    // Create some sample content
    console.log('📝 Creating sample content...');
    
    const sampleContent1 = db.createContent({
        title: 'Welcome to Game Hub!',
        contentType: 'text',
        textContent: '🎮 Welcome to the Raspberry Pi Game Hub!<br><br>Connect your mobile devices and enjoy synchronized content.<br><br>Visit the admin panel to create your own content.',
        backgroundColor: '#4CAF50',
        textColor: '#ffffff',
        fontSize: 28
    });
    
    const sampleContent2 = db.createContent({
        title: 'Instructions',
        contentType: 'text',
        textContent: '📱 How to Connect:<br><br>1. Scan the WiFi QR code<br>2. Scan the URL QR code<br>3. Enjoy synchronized content!',
        backgroundColor: '#2196F3',
        textColor: '#ffffff',
        fontSize: 24
    });
    
    // Activate the first content
    db.activateContent(sampleContent1.id);
    
    console.log('✅ Database initialized successfully!');
    console.log(`📊 Created ${db.getAllContent().length} sample content items`);
    console.log('🚀 You can now start the server with: npm start');
    
    db.close();
} catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
} 