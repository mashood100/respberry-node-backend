#!/bin/bash

# Game Hub Launcher Installer
# Creates desktop shortcuts and makes the launcher executable

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🎮 Game Hub Launcher Installer${NC}"
echo "=================================="

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAUNCHER_SCRIPT="$SCRIPT_DIR/game_hub_launcher.py"

echo -e "${BLUE}📁 Installation directory: $SCRIPT_DIR${NC}"

# Check if Python launcher exists
if [ ! -f "$LAUNCHER_SCRIPT" ]; then
    echo -e "${RED}❌ Error: game_hub_launcher.py not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found game_hub_launcher.py${NC}"

# Make the Python launcher executable
chmod +x "$LAUNCHER_SCRIPT"
echo -e "${GREEN}✅ Made launcher executable${NC}"

# Detect OS and create appropriate shortcuts
OS_TYPE=$(uname -s)

case "$OS_TYPE" in
    "Darwin")  # macOS
        echo -e "${BLUE}🍎 Detected macOS${NC}"
        
        # Create macOS application bundle
        APP_DIR="$HOME/Desktop/Game Hub.app"
        mkdir -p "$APP_DIR/Contents/MacOS"
        mkdir -p "$APP_DIR/Contents/Resources"
        
        # Create Info.plist
        cat > "$APP_DIR/Contents/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>game_hub_launcher</string>
    <key>CFBundleIdentifier</key>
    <string>com.gamehub.launcher</string>
    <key>CFBundleName</key>
    <string>Game Hub</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

        # Create launch script
        cat > "$APP_DIR/Contents/MacOS/game_hub_launcher" << EOF
#!/bin/bash
cd "$SCRIPT_DIR"
python3 "$LAUNCHER_SCRIPT"
EOF
        
        chmod +x "$APP_DIR/Contents/MacOS/game_hub_launcher"
        
        echo -e "${GREEN}✅ Created macOS app bundle: ~/Desktop/Game Hub.app${NC}"
        ;;
        
    "Linux")  # Linux
        echo -e "${BLUE}🐧 Detected Linux${NC}"
        
        # Create desktop entry
        DESKTOP_FILE="$HOME/Desktop/Game Hub.desktop"
        cat > "$DESKTOP_FILE" << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Game Hub Launcher
Comment=Raspberry Pi Game Hub One-Click Launcher
Exec=bash -c "cd '$SCRIPT_DIR' && python3 '$LAUNCHER_SCRIPT'"
Icon=applications-games
Terminal=false
Categories=Game;Network;
StartupNotify=true
EOF
        
        chmod +x "$DESKTOP_FILE"
        
        # Also create in applications menu
        APPS_DIR="$HOME/.local/share/applications"
        mkdir -p "$APPS_DIR"
        cp "$DESKTOP_FILE" "$APPS_DIR/"
        
        echo -e "${GREEN}✅ Created Linux desktop shortcut: ~/Desktop/Game Hub.desktop${NC}"
        echo -e "${GREEN}✅ Added to applications menu${NC}"
        ;;
        
    *)
        echo -e "${YELLOW}⚠️  Unknown OS: $OS_TYPE${NC}"
        echo -e "${YELLOW}📝 Manual launch: python3 $LAUNCHER_SCRIPT${NC}"
        ;;
esac

# Create a simple command-line launcher script
SIMPLE_LAUNCHER="$SCRIPT_DIR/launch_game_hub.sh"
cat > "$SIMPLE_LAUNCHER" << EOF
#!/bin/bash
# Simple command-line launcher for Game Hub
cd "$SCRIPT_DIR"
python3 "$LAUNCHER_SCRIPT"
EOF

chmod +x "$SIMPLE_LAUNCHER"
echo -e "${GREEN}✅ Created command-line launcher: ./launch_game_hub.sh${NC}"

# Check Python and dependencies
echo ""
echo -e "${BLUE}🔍 Checking Python environment...${NC}"

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✅ Python found: $PYTHON_VERSION${NC}"
    
    # Check if tkinter is available
    if python3 -c "import tkinter" 2>/dev/null; then
        echo -e "${GREEN}✅ tkinter (GUI library) is available${NC}"
    else
        echo -e "${RED}❌ tkinter not available${NC}"
        echo -e "${YELLOW}📝 Install with: sudo apt-get install python3-tk${NC}"
    fi
else
    echo -e "${RED}❌ Python3 not found${NC}"
    echo -e "${YELLOW}📝 Install Python3 first${NC}"
fi

# Final instructions
echo ""
echo -e "${BLUE}🎉 Installation Complete!${NC}"
echo "=========================="
echo ""
echo -e "${GREEN}🎮 How to launch Game Hub:${NC}"

case "$OS_TYPE" in
    "Darwin")
        echo "   • Double-click 'Game Hub.app' on your Desktop"
        ;;
    "Linux") 
        echo "   • Double-click 'Game Hub.desktop' on your Desktop"
        echo "   • Or find 'Game Hub Launcher' in your applications menu"
        ;;
esac

echo "   • Or run: ./launch_game_hub.sh"
echo "   • Or run: python3 game_hub_launcher.py"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   • The launcher will automatically run all setup scripts"
echo "   • No terminal interaction required - just click and wait"
echo "   • Close the launcher window to stop the game hub"
echo "   • Use 'Validate Setup' button to check everything is ready"
echo ""
echo -e "${GREEN}🚀 Ready to launch!${NC}"