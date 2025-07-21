#!/bin/bash

# Universal Game Hub Startup Script - Node.js Version
# Automatically detects OS and uses existing hotspot settings when available
# Supports: Raspberry Pi OS, macOS, Windows (WSL), and Linux

echo "🎮 Starting Node.js Game Hub - Universal Mode"
echo "=============================================="

# Default fallback configuration (only used if no existing settings found)
DEFAULT_HOTSPOT_SSID="GameHub-Direct"
DEFAULT_HOTSPOT_PASSWORD="gamehub123"
SERVER_PORT="8000"

# Variables for detected settings
HOTSPOT_SSID=""
HOTSPOT_PASSWORD=""
HOTSPOT_SOURCE=""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo "❌ Please don't run this script as root. We'll ask for sudo when needed."
    exit 1
fi

# Function to show progress spinner
show_spinner() {
    local pid=$1
    local message=$2
    local delay=0.1
    local spinstr='|/-\'
    echo -n "$message "
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        local temp=${spinstr#?}
        printf "[%c]" "$spinstr"
        local spinstr=$temp${spinstr%"$temp"}
        sleep $delay
        printf "\b\b\b"
    done
    printf "   \b\b\b"
    echo "✅"
}

# Function to detect existing hotspot settings
detect_hotspot_settings() {
    echo "🔍 Detecting existing hotspot settings..."
    
    case $OS_TYPE in
        "raspberry_pi"|"linux")
            # Check existing hostapd configuration
            if [ -f "/etc/hostapd/hostapd.conf" ]; then
                existing_ssid=$(grep "^ssid=" /etc/hostapd/hostapd.conf 2>/dev/null | cut -d'=' -f2)
                existing_password=$(grep "^wpa_passphrase=" /etc/hostapd/hostapd.conf 2>/dev/null | cut -d'=' -f2)
                
                if [ -n "$existing_ssid" ] && [ -n "$existing_password" ]; then
                    HOTSPOT_SSID="$existing_ssid"
                    HOTSPOT_PASSWORD="$existing_password"
                    HOTSPOT_SOURCE="existing hostapd config"
                    echo "✅ Found existing hotspot: $HOTSPOT_SSID"
                    return 0
                fi
            fi
            
            # Check NetworkManager saved connections
            if command -v nmcli &> /dev/null; then
                hotspot_connection=$(nmcli -t -f NAME,TYPE con show | grep ":802-11-wireless" | head -1 | cut -d':' -f1)
                if [ -n "$hotspot_connection" ]; then
                    existing_ssid=$(nmcli -t -f 802-11-wireless.ssid con show "$hotspot_connection" 2>/dev/null | cut -d':' -f2)
                    existing_password=$(nmcli -s -t -f 802-11-wireless-security.psk con show "$hotspot_connection" 2>/dev/null | cut -d':' -f2)
                    
                    if [ -n "$existing_ssid" ] && [ -n "$existing_password" ]; then
                        HOTSPOT_SSID="$existing_ssid"
                        HOTSPOT_PASSWORD="$existing_password"
                        HOTSPOT_SOURCE="NetworkManager profile"
                        echo "✅ Found NetworkManager hotspot: $HOTSPOT_SSID"
                        return 0
                    fi
                fi
            fi
            ;;
            
        "macos")
            # Check macOS Internet Sharing preferences
            if [ -f "/Library/Preferences/SystemConfiguration/preferences.plist" ]; then
                # Try to extract WiFi hotspot settings (requires plutil)
                if command -v plutil &> /dev/null; then
                    existing_ssid=$(plutil -extract "NetworkServices" raw "/Library/Preferences/SystemConfiguration/preferences.plist" 2>/dev/null | grep -i "ssid" | head -1 | cut -d'"' -f4)
                    if [ -n "$existing_ssid" ]; then
                        HOTSPOT_SSID="$existing_ssid"
                        HOTSPOT_PASSWORD="$(security find-generic-password -w -s 'AirPort network password' 2>/dev/null || echo '')"
                        HOTSPOT_SOURCE="macOS Internet Sharing"
                        echo "✅ Found macOS hotspot: $HOTSPOT_SSID"
                        return 0
                    fi
                fi
            fi
            
            # Check for common macOS hotspot patterns
            device_name=$(scutil --get ComputerName 2>/dev/null)
            if [ -n "$device_name" ]; then
                HOTSPOT_SSID="$device_name"
                # Generate a reasonable default password based on device name
                device_suffix=$(echo "$device_name" | sed 's/[^a-zA-Z0-9]//g' | tr '[:upper:]' '[:lower:]' | tail -c 5)
                HOTSPOT_PASSWORD="${device_suffix}123"
                HOTSPOT_SOURCE="device name + generated password"
                echo "✅ Using device name as hotspot: $HOTSPOT_SSID"
                echo "✅ Generated password: $HOTSPOT_PASSWORD"
                return 0
            fi
            ;;
            
        "windows")
            # Check Windows Mobile Hotspot settings
            if command -v netsh.exe &> /dev/null; then
                hotspot_info=$(netsh.exe wlan show profile name="Local Area Connection* 12" key=clear 2>/dev/null)
                if [ -n "$hotspot_info" ]; then
                    existing_ssid=$(echo "$hotspot_info" | grep "SSID name" | cut -d'"' -f2)
                    existing_password=$(echo "$hotspot_info" | grep "Key Content" | cut -d':' -f2 | xargs)
                    
                    if [ -n "$existing_ssid" ]; then
                        HOTSPOT_SSID="$existing_ssid"
                        HOTSPOT_PASSWORD="$existing_password"
                        HOTSPOT_SOURCE="Windows Mobile Hotspot"
                        echo "✅ Found Windows hotspot: $HOTSPOT_SSID"
                        return 0
                    fi
                fi
            fi
            
            # Fallback to computer name
            computer_name=$(hostname 2>/dev/null)
            if [ -n "$computer_name" ]; then
                HOTSPOT_SSID="$computer_name"
                # Generate a reasonable default password based on computer name
                device_suffix=$(echo "$computer_name" | sed 's/[^a-zA-Z0-9]//g' | tr '[:upper:]' '[:lower:]' | tail -c 5)
                HOTSPOT_PASSWORD="${device_suffix}123"
                HOTSPOT_SOURCE="computer name + generated password"
                echo "✅ Using computer name as hotspot: $HOTSPOT_SSID"
                echo "✅ Generated password: $HOTSPOT_PASSWORD"
                return 0
            fi
            ;;
    esac
    
    echo "⚠️  No existing hotspot settings found"
    return 1
}

# Function to prompt user for hotspot settings
prompt_hotspot_settings() {
    echo ""
    echo "🔧 Hotspot Configuration"
    echo "========================"
    
    # Show current settings
    echo "📱 Current settings:"
    echo "   SSID: ${HOTSPOT_SSID:-$DEFAULT_HOTSPOT_SSID}"
    echo "   Password: ${HOTSPOT_PASSWORD:-$DEFAULT_HOTSPOT_PASSWORD}"
    echo "   Source: ${HOTSPOT_SOURCE:-default}"
    echo ""
    echo "Would you like to:"
    echo "   1) Use these settings (Recommended)"
    echo "   2) Enter custom settings"
    echo "   3) Use default GameHub settings"
    echo ""
    read -p "Choice (1-3, default: 1): " choice
    
    case $choice in
        2)
            echo "📱 Enter custom hotspot name:"
            read -p "SSID: " custom_ssid
            echo "🔑 Enter custom password:"
            read -s -p "Password: " custom_password
            echo ""
            if [ -n "$custom_ssid" ] && [ -n "$custom_password" ]; then
                HOTSPOT_SSID="$custom_ssid"
                HOTSPOT_PASSWORD="$custom_password"
                HOTSPOT_SOURCE="user input"
            else
                echo "⚠️  Invalid input, using detected settings"
            fi
            ;;
        3)
            HOTSPOT_SSID="$DEFAULT_HOTSPOT_SSID"
            HOTSPOT_PASSWORD="$DEFAULT_HOTSPOT_PASSWORD"
            HOTSPOT_SOURCE="default"
            ;;
        *)
            echo "✅ Using detected settings"
            ;;
    esac
    
    # Final fallback to defaults
    if [ -z "$HOTSPOT_SSID" ]; then
        HOTSPOT_SSID="$DEFAULT_HOTSPOT_SSID"
        HOTSPOT_PASSWORD="$DEFAULT_HOTSPOT_PASSWORD"
        HOTSPOT_SOURCE="default fallback"
    fi
}

# Function to detect and setup Node.js
setup_nodejs() {
    echo "🟢 Checking Node.js installation..."
    
    # Variable to store the Node.js command to use
    NODE_CMD=""
    NODE_VERSION=""
    NPM_CMD=""
    
    # Check for node command
    if command -v node &> /dev/null; then
        NODE_CMD="node"
        NODE_VERSION=$(node --version 2>&1)
        echo "✅ Found Node.js: $NODE_VERSION"
        
        # Check Node.js version (require 16+)
        major_version=$(echo "$NODE_VERSION" | sed 's/v//' | cut -d'.' -f1)
        if [ "$major_version" -ge 16 ]; then
            echo "✅ Node.js version is compatible"
        else
            echo "⚠️  Node.js version $NODE_VERSION is too old (require 16+)"
            echo "   Attempting to install newer version..."
            install_nodejs
            if [ $? -ne 0 ]; then
                return 1
            fi
        fi
    else
        echo "❌ No Node.js installation found"
        install_nodejs
        if [ $? -ne 0 ]; then
            return 1
        fi
    fi
    
    # Check for npm
    if command -v npm &> /dev/null; then
        NPM_CMD="npm"
        NPM_VERSION=$(npm --version 2>&1)
        echo "✅ Found npm: $NPM_VERSION"
        return 0
    else
        echo "❌ npm not found"
        install_nodejs
        return $?
    fi
}

# Function to install Node.js
install_nodejs() {
    echo "📦 Installing Node.js..."
    
    case $OS_TYPE in
        "raspberry_pi"|"linux")
            echo "🔄 Installing Node.js on Linux..."
            
            # Try NodeSource repository for latest LTS
            if command -v curl &> /dev/null; then
                echo "📥 Adding NodeSource repository..."
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - &
                show_spinner $! "Adding NodeSource repository"
                
                sudo apt-get install -y nodejs &
                show_spinner $! "Installing Node.js"
            elif command -v apt &> /dev/null; then
                # Fallback to distribution packages
                sudo apt update -qq &
                show_spinner $! "Updating package lists"
                sudo apt install -y nodejs npm &
                show_spinner $! "Installing Node.js and npm"
            elif command -v yum &> /dev/null; then
                sudo yum install -y nodejs npm &
                show_spinner $! "Installing Node.js and npm"
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y nodejs npm &
                show_spinner $! "Installing Node.js and npm"
            elif command -v pacman &> /dev/null; then
                sudo pacman -S --noconfirm nodejs npm &
                show_spinner $! "Installing Node.js and npm"
            else
                echo "❌ Unsupported Linux distribution"
                return 1
            fi
            ;;
            
        "macos")
            echo "🔄 Installing Node.js on macOS..."
            if command -v brew &> /dev/null; then
                brew install node &
                show_spinner $! "Installing Node.js via Homebrew"
            elif command -v port &> /dev/null; then
                sudo port install nodejs18 +universal &
                show_spinner $! "Installing Node.js via MacPorts"
            else
                echo "❌ Neither Homebrew nor MacPorts found"
                echo "📋 Please install Node.js manually:"
                echo "   • Install Homebrew: https://brew.sh"
                echo "   • Then run: brew install node"
                echo "   • Or download from: https://nodejs.org/downloads/"
                return 1
            fi
            ;;
            
        "windows")
            echo "🔄 Installing Node.js on Windows..."
            if command -v winget &> /dev/null; then
                winget install OpenJS.NodeJS &
                show_spinner $! "Installing Node.js via winget"
            elif command -v choco &> /dev/null; then
                choco install nodejs -y &
                show_spinner $! "Installing Node.js via Chocolatey"
            else
                echo "❌ Neither winget nor Chocolatey found"
                echo "📋 Please install Node.js manually:"
                echo "   • Download from: https://nodejs.org/downloads/"
                echo "   • Or install via Microsoft Store"
                return 1
            fi
            ;;
            
        *)
            echo "❌ Unsupported operating system for automatic Node.js installation"
            echo "📋 Please install Node.js manually and try again"
            return 1
            ;;
    esac
    
    # Verify installation
    sleep 2
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        NODE_CMD="node"
        NODE_VERSION=$(node --version 2>&1)
        NPM_CMD="npm"
        NPM_VERSION=$(npm --version 2>&1)
        echo "✅ Successfully installed Node.js: $NODE_VERSION"
        echo "✅ Successfully installed npm: $NPM_VERSION"
        return 0
    fi
    
    echo "❌ Node.js installation failed or not detected"
    return 1
}

# Function to detect operating system
detect_os() {
    echo "🔍 Detecting operating system..."
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Check if it's Raspberry Pi
        if [ -f /proc/cpuinfo ] && grep -q "Raspberry Pi\|BCM2" /proc/cpuinfo 2>/dev/null; then
            echo "🥧 Detected: Raspberry Pi OS"
            OS_TYPE="raspberry_pi"
            HOTSPOT_IP="192.168.4.1"
            WIFI_INTERFACE="wlan0"
        elif command -v systemctl &> /dev/null; then
            echo "🐧 Detected: Linux (systemd)"
            OS_TYPE="linux"
            HOTSPOT_IP="192.168.4.1"
            WIFI_INTERFACE="wlan0"
        else
            echo "🐧 Detected: Linux (generic)"
            OS_TYPE="linux_generic"
            HOTSPOT_IP="192.168.4.1"
            WIFI_INTERFACE="wlan0"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🍎 Detected: macOS"
        OS_TYPE="macos"
        HOTSPOT_IP="192.168.2.1"
        WIFI_INTERFACE="en0"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || grep -q Microsoft /proc/version 2>/dev/null; then
        echo "🪟 Detected: Windows (WSL/MSYS)"
        OS_TYPE="windows"
        HOTSPOT_IP="192.168.137.1"
        WIFI_INTERFACE="wlan0"
    else
        echo "❓ Detected: Unknown OS ($OSTYPE)"
        OS_TYPE="unknown"
        HOTSPOT_IP="127.0.0.1"
        WIFI_INTERFACE="wlan0"
    fi
    
    echo "   IP will be: $HOTSPOT_IP"
    echo "   Interface: $WIFI_INTERFACE"
}

# Function to install system dependencies with progress
install_system_dependencies() {
    echo "📦 Installing system dependencies for $OS_TYPE..."
    
    case $OS_TYPE in
        "raspberry_pi"|"linux")
            echo "🔄 Updating package list..."
            sudo apt update -qq &
            show_spinner $! "Updating repositories"
            
            echo "🔄 Installing system packages..."
            packages=("hostapd" "dnsmasq")
            
            for package in "${packages[@]}"; do
                echo "   📥 Installing $package..."
                sudo apt install -y "$package" > /dev/null 2>&1 &
                show_spinner $! "Installing $package"
            done
            ;;
            
        "macos")
            echo "🔄 Installing macOS packages..."
            if ! command -v brew &> /dev/null; then
                echo "🍺 Installing Homebrew..."
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" &
                show_spinner $! "Installing Homebrew"
            fi
            
            echo "   📥 Installing build tools..."
            xcode-select --install 2>/dev/null || echo "   ✅ Xcode tools already installed"
            ;;
            
        "windows")
            echo "🔄 Installing Windows (WSL) packages..."
            if command -v apt &> /dev/null; then
                sudo apt update -qq &
                show_spinner $! "Updating repositories"
                
                packages=("build-essential")
                
                for package in "${packages[@]}"; do
                    echo "   📥 Installing $package..."
                    sudo apt install -y "$package" > /dev/null 2>&1 &
                    show_spinner $! "Installing $package"
                done
            fi
            ;;
            
        *)
            echo "⚠️  Unknown OS - skipping system dependencies..."
            ;;
    esac
}

# Function to install Node.js dependencies with progress
install_nodejs_dependencies() {
    echo "📦 Installing Node.js dependencies..."
    
    # Check if package.json exists
    if [ -f "package.json" ]; then
        echo "📥 Installing npm packages..."
        
        # Install dependencies with verbose output
        echo "🔄 Installing packages (this may take a while)..."
        
        # Check if node_modules exists
        if [ -d "node_modules" ]; then
            echo "📦 Found existing node_modules, checking for updates..."
            $NPM_CMD install 2>&1 | while IFS= read -r line; do
                if [[ $line == *"added"* ]] || [[ $line == *"updated"* ]]; then
                    echo "   ✅ $line"
                elif [[ $line == *"WARN"* ]]; then
                    echo "   ⚠️  $line"
                elif [[ $line == *"ERR"* ]]; then
                    echo "   ❌ $line"
                fi
            done
        else
            echo "📦 Installing packages for the first time..."
            $NPM_CMD install 2>&1 | while IFS= read -r line; do
                if [[ $line == *"added"* ]]; then
                    echo "   ✅ $line"
                elif [[ $line == *"WARN"* ]]; then
                    echo "   ⚠️  $line"
                elif [[ $line == *"ERR"* ]]; then
                    echo "   ❌ $line"
                fi
            done
        fi
        
        echo "✅ Node.js dependencies installed successfully"
    else
        echo "⚠️  No package.json found in current directory"
        echo "❌ Please run this script from the nodejs-gamehub directory"
        return 1
    fi
}



# Main execution starts here
echo ""

# Detect OS
detect_os

# Check and setup Node.js
if ! setup_nodejs; then
    echo "❌ Node.js is required but could not be installed or detected."
    echo "📋 Please install Node.js 16+ manually and try again."
    exit 1
fi

# Detect existing hotspot settings
if ! detect_hotspot_settings; then
    # Prompt user for hotspot settings if no existing ones found
    prompt_hotspot_settings
fi

# Handle missing passwords (critical for QR code generation)
if [ -n "$HOTSPOT_SSID" ] && [ -z "$HOTSPOT_PASSWORD" ]; then
    echo ""
    echo "🚨 CRITICAL: Hotspot password required for QR code generation!"
    echo "📱 Hotspot Name: $HOTSPOT_SSID"
    echo "🔍 Could not auto-detect password from system settings"
    echo ""
    echo "📋 Please check your system and find the actual hotspot password:"
    
    case $OS_TYPE in
        "macos")
            echo "   1. Go to System Preferences → Sharing → Internet Sharing"
            echo "   2. Click 'Wi-Fi Options...' to see the password"
            echo "   3. Or check Keychain Access for saved WiFi passwords"
            ;;
        "windows")
            echo "   1. Go to Settings → Network & Internet → Mobile hotspot"
            echo "   2. Check the 'Network password' field"
            echo "   3. Or use: netsh wlan show profile name=\"$HOTSPOT_SSID\" key=clear"
            ;;
        "raspberry_pi"|"linux")
            echo "   1. Check /etc/hostapd/hostapd.conf for 'wpa_passphrase'"
            echo "   2. Or check NetworkManager: nmcli connection show"
            ;;
    esac
    
    echo ""
    while [ -z "$HOTSPOT_PASSWORD" ]; do
        read -s -p "🔑 Enter the ACTUAL hotspot password for '$HOTSPOT_SSID': " HOTSPOT_PASSWORD
        echo ""
        
        if [ -z "$HOTSPOT_PASSWORD" ]; then
            echo "❌ Password cannot be empty! QR codes won't work without the correct password."
            echo "   Would you like to:"
            echo "   1) Try again (Recommended)"
            echo "   2) Use default password 'gamehub123' (QR codes may not work)"
            echo "   3) Skip hotspot setup (Local network only)"
            echo ""
            read -p "Choice (1-3): " choice
            
            case $choice in
                2)
                    HOTSPOT_PASSWORD="$DEFAULT_HOTSPOT_PASSWORD"
                    HOTSPOT_SOURCE="$HOTSPOT_SOURCE + fallback default"
                    echo "⚠️  Using default password - QR codes may not work for auto-connection"
                    break
                    ;;
                3)
                    HOTSPOT_PASSWORD="SKIP_HOTSPOT"
                    HOTSPOT_SOURCE="manual setup required"
                    echo "⚠️  Skipping hotspot setup - manual connection required"
                    break
                    ;;
                *)
                    echo "🔄 Please try entering the password again..."
                    ;;
            esac
        else
            # Validate password length
            if [ ${#HOTSPOT_PASSWORD} -lt 8 ]; then
                echo "⚠️  WiFi passwords should be at least 8 characters. Are you sure this is correct?"
                read -p "Continue anyway? (y/N): " confirm
                if [[ ! $confirm =~ ^[Yy]$ ]]; then
                    HOTSPOT_PASSWORD=""
                    continue
                fi
            fi
            
            HOTSPOT_SOURCE="$HOTSPOT_SOURCE + user provided"
            echo "✅ Password accepted"
        fi
    done
fi

# Display final settings
echo ""
echo "📡 Final Hotspot Configuration:"
echo "   SSID: $HOTSPOT_SSID"
echo "   Password: $HOTSPOT_PASSWORD"
echo "   Source: $HOTSPOT_SOURCE"
echo ""

# Install system dependencies
install_system_dependencies

# Install Node.js dependencies
install_nodejs_dependencies

# Check hotspot configuration (don't set it up)
echo "📡 Checking hotspot configuration..."
echo "💡 Use your existing hotspot setup script to configure the actual hotspot"
HOTSPOT_SUCCESS=false
case $OS_TYPE in
    "raspberry_pi"|"linux")
        if pgrep hostapd > /dev/null && pgrep dnsmasq > /dev/null; then
            echo "✅ Hotspot services are running"
            HOTSPOT_SUCCESS=true
        else
            echo "⚠️  Hotspot services not running - use your setup script first"
        fi
        ;;
    "macos")
        if pgrep -f "InternetSharing" > /dev/null 2>&1; then
            echo "✅ macOS Internet Sharing is active"
            HOTSPOT_SUCCESS=true
        else
            echo "⚠️  macOS Internet Sharing not active - configure manually"
        fi
        ;;
    "windows")
        echo "💡 Check Windows Mobile Hotspot manually in Settings"
        HOTSPOT_SUCCESS=true  # Assume it's configured
        ;;
esac

# Show info about in-memory storage
echo "💾 Using in-memory storage (no database setup needed)..."
if [ -f "scripts/init-db.js" ]; then
    echo "📊 Sample content will be created automatically when server starts"
else
    echo "⚠️  Info script not found - sample content will still be created"
fi

# Detect IP address
echo "🌐 Detecting network configuration..."
DETECTED_IP=""

# Enhanced IP detection
for i in {1..5}; do
    case $OS_TYPE in
        "raspberry_pi"|"linux")
            DETECTED_IP=$(ip addr show $WIFI_INTERFACE 2>/dev/null | grep -o "inet [0-9.]*" | cut -d' ' -f2 | head -1)
            ;;
        "macos")
            DETECTED_IP=$(ifconfig $WIFI_INTERFACE 2>/dev/null | grep "inet " | awk '{print $2}' | head -1)
            ;;
        "windows")
            DETECTED_IP=$(ipconfig.exe | grep -A 1 "Wireless LAN adapter" | grep "IPv4" | awk '{print $NF}' | head -1)
            ;;
    esac
    
    # Fallback to hostname
    if [ -z "$DETECTED_IP" ]; then
        DETECTED_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    # Final fallback to OS-specific default
    if [ -z "$DETECTED_IP" ] || [ "$DETECTED_IP" == "127.0.0.1" ]; then
        DETECTED_IP="$HOTSPOT_IP"
    fi
    
    if [ "$DETECTED_IP" != "$HOTSPOT_IP" ] && [ "$DETECTED_IP" != "127.0.0.1" ]; then
        echo "✅ Network interface ready: $DETECTED_IP"
        break
    fi
    
    sleep 1
done

# Display results
echo ""
echo "🎯 ========== NODE.JS GAME HUB READY =========="
echo "🖥️  Operating System: $OS_TYPE"
echo "🟢 Node.js Version: $NODE_VERSION ($NODE_CMD)"
echo "📦 npm Version: $NPM_VERSION ($NPM_CMD)"
echo "🌐 Server IP: $DETECTED_IP"

if [ "$HOTSPOT_SUCCESS" = true ]; then
    echo "📡 Hotspot Status: DETECTED/ACTIVE"
    echo "📱 Hotspot SSID: $HOTSPOT_SSID"
    echo "🔑 Hotspot Password: $HOTSPOT_PASSWORD"
    echo "🔧 Configuration Source: $HOTSPOT_SOURCE"
else
    echo "📡 Hotspot Status: NOT DETECTED/INACTIVE"
    echo "🌐 Network Mode: Will use local network IP"
    echo "💡 Set up hotspot using your existing script, then restart"
fi

echo ""
echo "📱 Connection URLs:"
echo "   Main Display: http://$DETECTED_IP:$SERVER_PORT/"
echo "   Mobile View:  http://$DETECTED_IP:$SERVER_PORT/mobile/"
echo "   Admin Panel:  http://$DETECTED_IP:$SERVER_PORT/admin-panel/"
echo ""

if [ "$HOTSPOT_SUCCESS" = true ]; then
    echo "📋 MOBILE CONNECTION STEPS:"
    echo "   1. Connect to WiFi: '$HOTSPOT_SSID'"
    echo "   2. Enter password: '$HOTSPOT_PASSWORD'"
    echo "   3. Scan QR code OR go to: http://$DETECTED_IP:$SERVER_PORT/mobile/"
    echo "   📝 Note: Using $HOTSPOT_SOURCE for QR code generation"
else
    echo "📋 SETUP REQUIRED:"
    echo "   1. Use your existing hotspot setup script to configure hotspot"
    echo "   2. Set SSID to: '$HOTSPOT_SSID' and password to: '$HOTSPOT_PASSWORD'"
    echo "   3. Or ensure devices are on same network as this computer"
    echo "   4. Restart this script after hotspot is configured"
fi

echo ""
echo "🚀 Starting Node.js Game Hub server..."
echo "💡 Press Ctrl+C to stop"
echo "================================"

# Cleanup function
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    echo "👋 Game Hub stopped!"
    exit 0
}

# Set up cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start the Node.js server
$NODE_CMD server.js 