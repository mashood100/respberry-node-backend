#!/bin/bash

# Raspberry Pi Game Hub - Hotspot Setup Script (Node.js Version)
# Based on working setup_raspberry_pi_hotspot.sh
# Creates a standalone WiFi hotspot for direct device connections

set -e  # Exit on any error

# Configuration
HOTSPOT_SSID="GameHub-Direct"
HOTSPOT_PASSWORD="gamehub123"
HOTSPOT_IP="192.168.4.1"
DHCP_START="192.168.4.2"
DHCP_END="192.168.4.20"
WIFI_INTERFACE="wlan0"
CHANNEL="7"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

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

# Function to check if running on Raspberry Pi
check_raspberry_pi() {
    if [ ! -f "/proc/cpuinfo" ]; then
        print_error "This script is designed for Raspberry Pi OS"
        exit 1
    fi
    
    if ! grep -q "Raspberry Pi" /proc/cpuinfo; then
        print_warning "This doesn't appear to be a Raspberry Pi. Continue anyway? (y/N)"
        read -r response
        if [[ ! $response =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "Please don't run this script as root. We'll ask for sudo when needed."
        exit 1
    fi
}

# Function to detect WiFi interface
detect_wifi_interface() {
    print_status "Detecting WiFi interface..."
    
    # Try to find wlan interface
    if ip link show wlan0 >/dev/null 2>&1; then
        WIFI_INTERFACE="wlan0"
    elif ip link show wlan1 >/dev/null 2>&1; then
        WIFI_INTERFACE="wlan1"
    else
        # Find any wireless interface
        WIFI_INTERFACE=$(iw dev | grep Interface | awk '{print $2}' | head -1)
        if [ -z "$WIFI_INTERFACE" ]; then
            print_error "No WiFi interface found. Please ensure WiFi is enabled."
            exit 1
        fi
    fi
    
    print_status "Using WiFi interface: $WIFI_INTERFACE"
}

# Function to check and install dependencies
install_dependencies() {
    print_status "Checking and installing dependencies..."
    
    # Update package list
    sudo apt update >/dev/null 2>&1 &
    show_spinner $! "Updating package list"
    
    # Install required packages
    packages=("hostapd" "dnsmasq" "iptables")
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            print_status "Installing $package..."
            sudo apt install -y "$package" >/dev/null 2>&1 &
            show_spinner $! "Installing $package"
        else
            print_status "$package is already installed"
        fi
    done
}

# Function to stop conflicting services
stop_conflicting_services() {
    print_status "Stopping conflicting services..."
    
    # Stop wpa_supplicant if running
    if systemctl is-active --quiet wpa_supplicant; then
        sudo systemctl stop wpa_supplicant
        print_status "Stopped wpa_supplicant"
    fi
    
    # Stop NetworkManager if running
    if systemctl is-active --quiet NetworkManager; then
        sudo systemctl stop NetworkManager
        print_status "Stopped NetworkManager"
    fi
    
    # Stop existing hostapd and dnsmasq
    sudo pkill -f hostapd >/dev/null 2>&1 || true
    sudo pkill -f dnsmasq >/dev/null 2>&1 || true
}

# Function to configure hostapd
configure_hostapd() {
    print_status "Configuring hostapd..."
    
    # Create hostapd configuration directory if it doesn't exist
    sudo mkdir -p /etc/hostapd
    
    # Create hostapd configuration
    sudo tee /etc/hostapd/hostapd.conf > /dev/null << EOF
# WiFi Hotspot Configuration for Game Hub Node.js
interface=$WIFI_INTERFACE
driver=nl80211

# WiFi settings
ssid=$HOTSPOT_SSID
hw_mode=g
channel=$CHANNEL
wmm_enabled=0
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0

# Security settings
wpa=2
wpa_passphrase=$HOTSPOT_PASSWORD
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP

# Additional settings for better compatibility
country_code=US
ieee80211d=1
ieee80211h=1
EOF

    # Configure hostapd to use our config file
    sudo sed -i 's/#DAEMON_CONF=""/DAEMON_CONF="\/etc\/hostapd\/hostapd.conf"/' /etc/default/hostapd
    
    print_status "hostapd configuration created"
}

# Function to configure dnsmasq
configure_dnsmasq() {
    print_status "Configuring dnsmasq..."
    
    # Backup original dnsmasq config
    if [ -f /etc/dnsmasq.conf ]; then
        sudo cp /etc/dnsmasq.conf /etc/dnsmasq.conf.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Create dnsmasq configuration
    sudo tee /etc/dnsmasq.conf > /dev/null << EOF
# DHCP and DNS configuration for Game Hub hotspot
interface=$WIFI_INTERFACE
bind-interfaces

# DHCP settings
dhcp-range=$DHCP_START,$DHCP_END,255.255.255.0,24h
dhcp-option=3,$HOTSPOT_IP
dhcp-option=6,$HOTSPOT_IP

# DNS settings
domain-needed
bogus-priv
no-resolv
no-poll

# Local domain for Game Hub
domain=gamehub.local
address=/gamehub.local/$HOTSPOT_IP
address=/#/$HOTSPOT_IP

# Logging
log-queries
log-facility=/var/log/dnsmasq.log
EOF

    print_status "dnsmasq configuration created"
}

# Function to configure network interface
configure_network() {
    print_status "Configuring network interface..."
    
    # Bring down the interface
    sudo ip link set $WIFI_INTERFACE down
    
    # Configure the interface
    sudo ip addr add $HOTSPOT_IP/24 dev $WIFI_INTERFACE
    
    # Bring up the interface
    sudo ip link set $WIFI_INTERFACE up
    
    print_status "Network interface configured"
}

# Function to configure IP forwarding
configure_ip_forwarding() {
    print_status "Configuring IP forwarding..."
    
    # Enable IP forwarding
    echo 1 | sudo tee /proc/sys/net/ipv4/ip_forward > /dev/null
    
    # Make it persistent
    if ! grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf; then
        echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf > /dev/null
    fi
    
    print_status "IP forwarding enabled"
}

# Function to start hotspot services
start_hotspot_services() {
    print_status "Starting hotspot services..."
    
    # Start hostapd
    sudo hostapd /etc/hostapd/hostapd.conf -B &
    show_spinner $! "Starting hostapd"
    
    # Start dnsmasq
    sudo dnsmasq -C /etc/dnsmasq.conf &
    show_spinner $! "Starting dnsmasq"
    
    # Wait a moment for services to start
    sleep 2
    
    # Check if services are running
    if pgrep hostapd > /dev/null && pgrep dnsmasq > /dev/null; then
        print_status "Hotspot services started successfully"
        return 0
    else
        print_error "Failed to start hotspot services"
        return 1
    fi
}

# Function to create systemd service for auto-start
create_autostart_service() {
    print_status "Creating autostart service for Game Hub hotspot..."
    
    # Create service file
    sudo tee /etc/systemd/system/gamehub-hotspot.service > /dev/null << EOF
[Unit]
Description=Game Hub Raspberry Pi Hotspot
After=network.target

[Service]
Type=forking
ExecStart=/usr/sbin/hostapd /etc/hostapd/hostapd.conf
ExecStartPost=/usr/sbin/dnsmasq -C /etc/dnsmasq.conf
ExecStop=/usr/bin/pkill hostapd
ExecStop=/usr/bin/pkill dnsmasq
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    # Enable the service
    sudo systemctl daemon-reload
    sudo systemctl enable gamehub-hotspot.service
    
    print_status "Autostart service created and enabled"
}

# Function to display connection information
display_connection_info() {
    print_header "GAME HUB HOTSPOT SETUP COMPLETE"
    
    echo -e "${GREEN}📡 Hotspot Information:${NC}"
    echo "   SSID: $HOTSPOT_SSID"
    echo "   Password: $HOTSPOT_PASSWORD"
    echo "   IP Address: $HOTSPOT_IP"
    echo "   DHCP Range: $DHCP_START - $DHCP_END"
    echo ""
    
    echo -e "${GREEN}📱 Connection Instructions:${NC}"
    echo "   1. On your mobile device, go to WiFi settings"
    echo "   2. Look for network: '$HOTSPOT_SSID'"
    echo "   3. Enter password: '$HOTSPOT_PASSWORD'"
    echo "   4. Connect to the network"
    echo ""
    
    echo -e "${GREEN}🔧 Management Commands:${NC}"
    echo "   Stop hotspot: sudo systemctl stop gamehub-hotspot"
    echo "   Start hotspot: sudo systemctl start gamehub-hotspot"
    echo "   Check status: sudo systemctl status gamehub-hotspot"
    echo "   View logs: sudo journalctl -u gamehub-hotspot"
    echo ""
    
    echo -e "${GREEN}🌐 Game Hub Access URLs:${NC}"
    echo "   Pi Display: http://$HOTSPOT_IP:8000/"
    echo "   Mobile View: http://$HOTSPOT_IP:8000/mobile/"
    echo "   Admin Panel: http://$HOTSPOT_IP:8000/admin-panel/"
    echo "   QR codes will be generated with these URLs"
    echo ""
    
    echo -e "${GREEN}🚀 Next Steps:${NC}"
    echo "   1. The hotspot will start automatically on boot"
    echo "   2. Run './start_game_hub.sh' to start the Node.js server"
    echo "   3. Access the admin panel to create content"
    echo ""
}

# Function to cleanup on exit
cleanup() {
    if [ "$1" != "success" ]; then
        print_status "Cleaning up due to error..."
        
        # Stop services
        sudo pkill -f hostapd >/dev/null 2>&1 || true
        sudo pkill -f dnsmasq >/dev/null 2>&1 || true
        
        # Restore network interface
        sudo ip link set $WIFI_INTERFACE down 2>/dev/null || true
        
        print_status "Cleanup complete"
    fi
}

# Function to test hotspot
test_hotspot() {
    print_status "Testing hotspot functionality..."
    
    # Check if hostapd is running
    if ! pgrep hostapd > /dev/null; then
        print_error "hostapd is not running"
        return 1
    fi
    
    # Check if dnsmasq is running
    if ! pgrep dnsmasq > /dev/null; then
        print_error "dnsmasq is not running"
        return 1
    fi
    
    # Check interface configuration
    if ! ip addr show $WIFI_INTERFACE | grep -q $HOTSPOT_IP; then
        print_error "Interface $WIFI_INTERFACE is not configured with $HOTSPOT_IP"
        return 1
    fi
    
    print_status "Hotspot test passed successfully"
    return 0
}

# Function to stop hotspot
stop_hotspot() {
    print_status "Stopping Game Hub hotspot..."
    
    # Stop systemd service if it exists
    if systemctl is-active --quiet gamehub-hotspot 2>/dev/null; then
        sudo systemctl stop gamehub-hotspot
        print_status "Stopped gamehub-hotspot service"
    fi
    
    # Stop processes
    sudo pkill -f hostapd >/dev/null 2>&1 && print_status "Stopped hostapd"
    sudo pkill -f dnsmasq >/dev/null 2>&1 && print_status "Stopped dnsmasq"
    
    # Bring down interface
    sudo ip link set $WIFI_INTERFACE down 2>/dev/null && print_status "Interface $WIFI_INTERFACE down"
    
    print_status "Hotspot stopped successfully"
}

# Function to show status
show_status() {
    print_header "GAME HUB HOTSPOT STATUS"
    
    echo -e "${GREEN}📡 Configuration:${NC}"
    echo "   SSID: $HOTSPOT_SSID"
    echo "   Password: $HOTSPOT_PASSWORD"
    echo "   IP: $HOTSPOT_IP"
    echo "   Interface: $WIFI_INTERFACE"
    echo ""
    
    echo -e "${GREEN}🔧 Service Status:${NC}"
    
    # Check systemd service
    if systemctl is-active --quiet gamehub-hotspot 2>/dev/null; then
        echo "   Systemd Service: ✅ ACTIVE"
    else
        echo "   Systemd Service: ❌ INACTIVE"
    fi
    
    # Check processes
    if pgrep hostapd > /dev/null; then
        echo "   hostapd: ✅ RUNNING"
    else
        echo "   hostapd: ❌ NOT RUNNING"
    fi
    
    if pgrep dnsmasq > /dev/null; then
        echo "   dnsmasq: ✅ RUNNING"
    else
        echo "   dnsmasq: ❌ NOT RUNNING"
    fi
    
    # Check interface
    if ip addr show $WIFI_INTERFACE | grep -q $HOTSPOT_IP 2>/dev/null; then
        echo "   Interface: ✅ CONFIGURED ($WIFI_INTERFACE)"
    else
        echo "   Interface: ❌ NOT CONFIGURED"
    fi
    echo ""
}

# Main setup function
setup_hotspot() {
    print_header "GAME HUB HOTSPOT SETUP"
    
    # Initial checks
    check_root
    check_raspberry_pi
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Detect WiFi interface
    detect_wifi_interface
    
    # Install dependencies
    install_dependencies
    
    # Stop conflicting services
    stop_conflicting_services
    
    # Configure services
    configure_hostapd
    configure_dnsmasq
    configure_network
    configure_ip_forwarding
    
    # Start services
    if start_hotspot_services; then
        # Test the setup
        if test_hotspot; then
            # Create autostart service
            create_autostart_service
            
            # Display connection information
            display_connection_info
            
            print_status "Game Hub hotspot setup completed successfully!"
            
            # Clean exit without cleanup
            trap - EXIT
            exit 0
        else
            print_error "Hotspot test failed"
            exit 1
        fi
    else
        print_error "Failed to start hotspot services"
        exit 1
    fi
}

# Parse command line arguments
case "${1:-setup}" in
    "setup"|"start"|"")
        setup_hotspot
        ;;
        
    "stop")
        stop_hotspot
        ;;
        
    "status")
        show_status
        ;;
        
    "restart")
        stop_hotspot
        sleep 2
        setup_hotspot
        ;;
        
    "help"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "   setup, start  - Setup and start Game Hub hotspot (default)"
        echo "   stop          - Stop hotspot services"
        echo "   status        - Show current hotspot status"
        echo "   restart       - Stop and restart hotspot"
        echo "   help          - Show this help message"
        echo ""
        echo "Examples:"
        echo "   $0              # Setup and start hotspot"
        echo "   $0 setup        # Same as above"
        echo "   $0 stop         # Stop hotspot"
        echo "   $0 status       # Check status"
        echo "   $0 restart      # Restart hotspot"
        ;;
        
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac 