#!/bin/bash

# Raspberry Pi Game Hub - Hotspot Setup Script (Node.js Version)
# Focused script for setting up hotspot only
# Supports: Raspberry Pi OS, macOS, Windows (WSL), and Linux

echo "📡 Game Hub Hotspot Setup - Node.js Version"
echo "============================================"

# Default fallback configuration
DEFAULT_HOTSPOT_SSID="GameHub-Direct"
DEFAULT_HOTSPOT_PASSWORD="gamehub123"

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
    
    echo "   Default IP: $HOTSPOT_IP"
    echo "   Interface: $WIFI_INTERFACE"
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
            # Check for common macOS hotspot patterns
            device_name=$(scutil --get ComputerName 2>/dev/null)
            if [ -n "$device_name" ]; then
                HOTSPOT_SSID="$device_name"
                # Try to get password from keychain
                HOTSPOT_PASSWORD="$(security find-generic-password -w -s 'AirPort network password' 2>/dev/null || echo '')"
                
                if [ -z "$HOTSPOT_PASSWORD" ]; then
                    # Generate a reasonable default password based on device name
                    device_suffix=$(echo "$device_name" | sed 's/[^a-zA-Z0-9]//g' | tr '[:upper:]' '[:lower:]' | tail -c 5)
                    HOTSPOT_PASSWORD="${device_suffix}123"
                    HOTSPOT_SOURCE="device name + generated password"
                else
                    HOTSPOT_SOURCE="device name + keychain password"
                fi
                
                echo "✅ Using device name as hotspot: $HOTSPOT_SSID"
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
    
    echo "📱 Would you like to:"
    echo "   1) Use detected/default settings"
    echo "   2) Enter custom settings"
    echo "   3) Create new GameHub hotspot"
    echo ""
    read -p "Choice (1-3, default: 1): " choice
    
    case $choice in
        2)
            echo "📱 Enter custom hotspot name:"
            read -p "SSID: " custom_ssid
            echo "🔑 Enter custom password (min 8 characters):"
            read -s -p "Password: " custom_password
            echo ""
            if [ -n "$custom_ssid" ] && [ ${#custom_password} -ge 8 ]; then
                HOTSPOT_SSID="$custom_ssid"
                HOTSPOT_PASSWORD="$custom_password"
                HOTSPOT_SOURCE="user input"
                echo "✅ Custom settings accepted"
            else
                echo "⚠️  Invalid input (password must be 8+ chars), using defaults"
                HOTSPOT_SSID="$DEFAULT_HOTSPOT_SSID"
                HOTSPOT_PASSWORD="$DEFAULT_HOTSPOT_PASSWORD"
                HOTSPOT_SOURCE="default fallback"
            fi
            ;;
        3)
            HOTSPOT_SSID="$DEFAULT_HOTSPOT_SSID"
            HOTSPOT_PASSWORD="$DEFAULT_HOTSPOT_PASSWORD"
            HOTSPOT_SOURCE="GameHub default"
            echo "✅ Using GameHub default settings"
            ;;
        *)
            # Use detected settings or defaults
            if [ -z "$HOTSPOT_SSID" ]; then
                HOTSPOT_SSID="$DEFAULT_HOTSPOT_SSID"
                HOTSPOT_PASSWORD="$DEFAULT_HOTSPOT_PASSWORD"
                HOTSPOT_SOURCE="default fallback"
            fi
            echo "✅ Using detected/default settings"
            ;;
    esac
}

# Function to install hotspot dependencies
install_hotspot_dependencies() {
    echo "📦 Installing hotspot dependencies for $OS_TYPE..."
    
    case $OS_TYPE in
        "raspberry_pi"|"linux")
            echo "🔄 Installing hostapd and dnsmasq..."
            sudo apt update -qq &
            show_spinner $! "Updating package lists"
            
            sudo apt install -y hostapd dnsmasq &
            show_spinner $! "Installing hotspot packages"
            
            # Stop services initially
            sudo systemctl stop hostapd dnsmasq 2>/dev/null || true
            sudo systemctl disable hostapd dnsmasq 2>/dev/null || true
            ;;
            
        "macos")
            echo "✅ macOS uses built-in Internet Sharing - no additional packages needed"
            ;;
            
        "windows")
            echo "✅ Windows uses built-in Mobile Hotspot - no additional packages needed"
            ;;
            
        *)
            echo "⚠️  Unknown OS - hotspot setup may not be available"
            ;;
    esac
}

# Function to setup Linux/Pi hotspot
setup_linux_hotspot() {
    echo "🐧 Setting up Linux hotspot..."
    
    # Check if required tools are available
    if ! command -v hostapd &> /dev/null || ! command -v dnsmasq &> /dev/null; then
        echo "❌ hostapd or dnsmasq not available"
        return 1
    fi
    
    # Stop any existing instances
    sudo pkill hostapd 2>/dev/null || true
    sudo pkill dnsmasq 2>/dev/null || true
    
    # Create hostapd configuration
    echo "📝 Creating hostapd configuration..."
    sudo tee /etc/hostapd/hostapd.conf > /dev/null << EOF
# Game Hub Hotspot Configuration
interface=$WIFI_INTERFACE
driver=nl80211
ssid=$HOTSPOT_SSID
hw_mode=g
channel=7
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=$HOTSPOT_PASSWORD
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
EOF

    # Create dnsmasq configuration
    echo "📝 Creating dnsmasq configuration..."
    sudo tee /etc/dnsmasq.d/gamehub.conf > /dev/null << EOF
# Game Hub DHCP Configuration
interface=$WIFI_INTERFACE
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
domain=local
address=/gamehub.local/$HOTSPOT_IP
EOF

    # Configure network interface
    echo "🔧 Configuring network interface..."
    sudo ifconfig $WIFI_INTERFACE down 2>/dev/null || true
    sudo ifconfig $WIFI_INTERFACE $HOTSPOT_IP netmask 255.255.255.0 up 2>/dev/null
    
    # Start services
    echo "🚀 Starting hotspot services..."
    
    # Start hostapd in background
    sudo hostapd /etc/hostapd/hostapd.conf -B &
    show_spinner $! "Starting hostapd"
    
    # Start dnsmasq
    sudo dnsmasq -C /etc/dnsmasq.d/gamehub.conf &
    show_spinner $! "Starting dnsmasq"
    
    # Verify services are running
    sleep 2
    if pgrep hostapd > /dev/null && pgrep dnsmasq > /dev/null; then
        echo "✅ Linux hotspot started successfully"
        
        # Enable IP forwarding
        echo "🔧 Enabling IP forwarding..."
        echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward > /dev/null
        
        return 0
    else
        echo "❌ Failed to start Linux hotspot services"
        echo "🔍 Troubleshooting tips:"
        echo "   • Check if WiFi interface '$WIFI_INTERFACE' exists"
        echo "   • Ensure no other network manager is controlling the interface"
        echo "   • Try: sudo systemctl stop NetworkManager (temporarily)"
        return 1
    fi
}

# Function to setup macOS hotspot
setup_macos_hotspot() {
    echo "🍎 Setting up macOS hotspot..."
    
    echo "📋 Manual macOS Internet Sharing setup:"
    echo "========================================"
    echo ""
    echo "1. Open System Preferences (or System Settings)"
    echo "2. Go to Sharing"
    echo "3. Select 'Internet Sharing' from the list"
    echo "4. Configure the following:"
    echo "   • Share your connection from: Wi-Fi (or Ethernet)"
    echo "   • To computers using: Wi-Fi"
    echo "5. Click 'Wi-Fi Options...' and set:"
    echo "   • Network Name: $HOTSPOT_SSID"
    echo "   • Channel: Automatic"
    echo "   • Security: WPA2 Personal"
    echo "   • Password: $HOTSPOT_PASSWORD"
    echo "6. Click OK, then check the 'Internet Sharing' checkbox"
    echo "7. Confirm when prompted"
    echo ""
    echo "💡 Alternative: Use terminal commands (experimental):"
    echo "sudo networksetup -createnetworkservice 'Game Hub' Wi-Fi"
    echo ""
    
    read -p "Press ENTER when Internet Sharing is configured and enabled..."
    
    # Try to detect if Internet Sharing is active
    if pgrep -f "InternetSharing" > /dev/null 2>&1; then
        echo "✅ macOS Internet Sharing appears to be active"
        return 0
    else
        echo "⚠️  Could not detect active Internet Sharing"
        echo "   The hotspot may still work if configured manually"
        return 0
    fi
}

# Function to setup Windows hotspot
setup_windows_hotspot() {
    echo "🪟 Setting up Windows hotspot..."
    
    if command -v netsh.exe &> /dev/null; then
        echo "🔧 Attempting automatic configuration..."
        
        # Configure hosted network
        netsh.exe wlan set hostednetwork mode=allow ssid="$HOTSPOT_SSID" key="$HOTSPOT_PASSWORD" &
        show_spinner $! "Configuring hosted network"
        
        # Start hosted network
        echo "🚀 Starting hosted network..."
        start_result=$(netsh.exe wlan start hostednetwork 2>&1)
        
        if [[ $start_result == *"started"* ]]; then
            echo "✅ Windows hotspot started successfully"
            return 0
        else
            echo "⚠️  Automatic setup may have failed"
            echo "Result: $start_result"
        fi
    fi
    
    echo ""
    echo "📋 Manual Windows Mobile Hotspot setup:"
    echo "======================================="
    echo ""
    echo "Method 1 - Settings App (Recommended):"
    echo "1. Open Settings (Windows + I)"
    echo "2. Go to Network & Internet"
    echo "3. Select 'Mobile hotspot' from the left menu"
    echo "4. Configure:"
    echo "   • Network name: $HOTSPOT_SSID"
    echo "   • Network password: $HOTSPOT_PASSWORD"
    echo "   • Share over: Wi-Fi"
    echo "5. Turn on 'Share my Internet connection with other devices'"
    echo ""
    echo "Method 2 - Command Line:"
    echo "1. Open Command Prompt as Administrator"
    echo "2. Run: netsh wlan set hostednetwork mode=allow ssid=\"$HOTSPOT_SSID\" key=\"$HOTSPOT_PASSWORD\""
    echo "3. Run: netsh wlan start hostednetwork"
    echo ""
    
    read -p "Press ENTER when Mobile Hotspot is configured and enabled..."
    
    echo "✅ Windows hotspot configuration completed"
    return 0
}

# Function to test hotspot connectivity
test_hotspot() {
    echo "🧪 Testing hotspot connectivity..."
    
    # Check if we can ping our own interface
    if ping -c 1 $HOTSPOT_IP > /dev/null 2>&1; then
        echo "✅ Hotspot IP ($HOTSPOT_IP) is reachable"
    else
        echo "⚠️  Could not reach hotspot IP ($HOTSPOT_IP)"
    fi
    
    # Check for listening processes on common ports
    if command -v netstat &> /dev/null; then
        echo "🔍 Checking for services..."
        if netstat -an | grep ":80\|:8000\|:53" > /dev/null; then
            echo "✅ Network services are running"
        else
            echo "💡 No web/DNS services detected (this is normal for hotspot-only setup)"
        fi
    fi
}

# Function to show hotspot status
show_hotspot_status() {
    echo ""
    echo "📡 ========== HOTSPOT STATUS =========="
    echo "🖥️  Operating System: $OS_TYPE"
    echo "📱 Hotspot SSID: $HOTSPOT_SSID"
    echo "🔑 Hotspot Password: $HOTSPOT_PASSWORD"
    echo "🌐 Hotspot IP: $HOTSPOT_IP"
    echo "🔧 Configuration Source: $HOTSPOT_SOURCE"
    echo ""
    
    case $OS_TYPE in
        "raspberry_pi"|"linux")
            if pgrep hostapd > /dev/null && pgrep dnsmasq > /dev/null; then
                echo "🟢 Status: ACTIVE (hostapd + dnsmasq running)"
            else
                echo "🔴 Status: INACTIVE (services not running)"
            fi
            ;;
        "macos")
            if pgrep -f "InternetSharing" > /dev/null 2>&1; then
                echo "🟢 Status: ACTIVE (Internet Sharing running)"
            else
                echo "🟡 Status: MANUAL SETUP REQUIRED"
            fi
            ;;
        "windows")
            echo "🟡 Status: MANUAL VERIFICATION REQUIRED"
            echo "   Check Settings → Network & Internet → Mobile hotspot"
            ;;
    esac
    
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Verify devices can see '$HOTSPOT_SSID' in WiFi networks"
    echo "   2. Test connection with password '$HOTSPOT_PASSWORD'"
    echo "   3. Run the main Game Hub with: ./start_game_hub.sh"
    echo ""
}

# Function to stop hotspot
stop_hotspot() {
    echo "🛑 Stopping hotspot services..."
    
    case $OS_TYPE in
        "raspberry_pi"|"linux")
            sudo pkill hostapd 2>/dev/null && echo "   ✅ Stopped hostapd"
            sudo pkill dnsmasq 2>/dev/null && echo "   ✅ Stopped dnsmasq"
            sudo ifconfig $WIFI_INTERFACE down 2>/dev/null && echo "   ✅ Interface down"
            ;;
        "macos")
            echo "   📋 Manually disable Internet Sharing in System Preferences"
            ;;
        "windows")
            netsh.exe wlan stop hostednetwork 2>/dev/null && echo "   ✅ Stopped hosted network"
            ;;
    esac
    
    echo "✅ Hotspot stop procedure completed"
}

# Main execution
echo ""

# Parse command line arguments
case "${1:-setup}" in
    "setup"|"start")
        detect_os
        
        if ! detect_hotspot_settings; then
            prompt_hotspot_settings
        fi
        
        echo ""
        echo "📡 Hotspot Configuration:"
        echo "   SSID: $HOTSPOT_SSID"
        echo "   Password: $HOTSPOT_PASSWORD"
        echo "   Source: $HOTSPOT_SOURCE"
        echo ""
        
        install_hotspot_dependencies
        
        case $OS_TYPE in
            "raspberry_pi"|"linux")
                setup_linux_hotspot
                ;;
            "macos")
                setup_macos_hotspot
                ;;
            "windows")
                setup_windows_hotspot
                ;;
            *)
                echo "❌ Hotspot setup not supported for $OS_TYPE"
                exit 1
                ;;
        esac
        
        test_hotspot
        show_hotspot_status
        ;;
        
    "stop")
        detect_os
        stop_hotspot
        ;;
        
    "status")
        detect_os
        detect_hotspot_settings
        show_hotspot_status
        ;;
        
    "help"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "   setup, start  - Configure and start hotspot (default)"
        echo "   stop          - Stop hotspot services"
        echo "   status        - Show current hotspot status"
        echo "   help          - Show this help message"
        echo ""
        echo "Examples:"
        echo "   $0              # Setup and start hotspot"
        echo "   $0 setup        # Same as above"
        echo "   $0 stop         # Stop hotspot"
        echo "   $0 status       # Check status"
        ;;
        
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac 