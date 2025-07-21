#!/bin/bash

# Raspberry Pi Game Hub - Hotspot Configuration Checker (Node.js Version)
# Detects and displays existing hotspot configurations
# Does NOT configure hotspot - use your existing hotspot setup script for that

echo "📡 Game Hub Hotspot Configuration Checker"
echo "=========================================="

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

# Function to check if hotspot is configured
check_hotspot_configured() {
    echo "🔍 Checking if hotspot is properly configured..."
    
    case $OS_TYPE in
        "raspberry_pi"|"linux")
            if command -v hostapd &> /dev/null && command -v dnsmasq &> /dev/null; then
                echo "✅ hostapd and dnsmasq are installed"
                if [ -f "/etc/hostapd/hostapd.conf" ]; then
                    echo "✅ hostapd configuration exists"
                else
                    echo "⚠️  hostapd configuration missing"
                fi
            else
                echo "⚠️  hostapd or dnsmasq not installed"
            fi
            ;;
        "macos")
            echo "💡 Use System Preferences → Sharing → Internet Sharing to configure"
            ;;
        "windows")
            echo "💡 Use Settings → Network & Internet → Mobile hotspot to configure"
            ;;
    esac
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
    echo "📋 Configuration Notes:"
    echo "   • SSID: '$HOTSPOT_SSID' will be used for QR codes"
    echo "   • Password: '$HOTSPOT_PASSWORD' will be used for QR codes"
    echo "   • Use your existing hotspot setup script to configure the actual hotspot"
    echo "   • Run the main Game Hub with: ./start_game_hub.sh"
    echo ""
}

# Main execution
echo ""

# Parse command line arguments
case "${1:-check}" in
    "check"|"detect"|"")
        detect_os
        
        if ! detect_hotspot_settings; then
            prompt_hotspot_settings
        fi
        
        echo ""
        echo "📡 Detected Hotspot Configuration:"
        echo "   SSID: $HOTSPOT_SSID"
        echo "   Password: $HOTSPOT_PASSWORD"
        echo "   Source: $HOTSPOT_SOURCE"
        echo ""
        
        check_hotspot_configured
        show_hotspot_status
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
        echo "   check, detect - Detect and display hotspot configuration (default)"
        echo "   status        - Show current hotspot status"
        echo "   help          - Show this help message"
        echo ""
        echo "Examples:"
        echo "   $0              # Detect hotspot configuration"
        echo "   $0 check        # Same as above"
        echo "   $0 status       # Check status"
        echo ""
        echo "Note: This script only DETECTS existing configurations."
        echo "Use your separate hotspot setup script to actually configure the hotspot."
        ;;
        
    *)
        echo "❌ Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac 