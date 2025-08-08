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

# Function to fix RF-kill issues
fix_rfkill_issues() {
    print_status "Checking and fixing RF-kill issues..."
    
    # Install rfkill if not present
    if ! command -v rfkill &> /dev/null; then
        print_status "Installing rfkill utility..."
        sudo apt install -y rfkill >/dev/null 2>&1
    fi
    
    # Check RF-kill status
    local wifi_blocked_soft=$(rfkill list wifi 2>/dev/null | grep -c "Soft blocked: yes" || echo "0")
    local wifi_blocked_hard=$(rfkill list wifi 2>/dev/null | grep -c "Hard blocked: yes" || echo "0")
    
    if [ "$wifi_blocked_soft" -gt 0 ]; then
        print_warning "WiFi is software blocked by RF-kill, unblocking..."
        sudo rfkill unblock wifi
        sudo rfkill unblock wlan
        sudo rfkill unblock all
        sleep 2
    fi
    
    if [ "$wifi_blocked_hard" -gt 0 ]; then
        print_error "WiFi is hardware blocked by RF-kill!"
        print_error "Please check for physical WiFi switch or hardware issue"
        exit 1
    fi
    
    # Load WiFi drivers if needed
    print_status "Loading WiFi drivers..."
    sudo modprobe brcmfmac 2>/dev/null || true
    sudo modprobe brcmutil 2>/dev/null || true
    sudo modprobe cfg80211 2>/dev/null || true
    
    # Wait for drivers to initialize
    sleep 2
    
    print_status "RF-kill issues resolved"
}

# Enhanced function to detect WiFi interface
detect_wifi_interface() {
    print_status "Detecting WiFi interface..."
    
    local interfaces=()
    
    # Method 1: Use iw to find wireless interfaces
    if command -v iw &> /dev/null; then
        while IFS= read -r line; do
            if [[ $line =~ Interface[[:space:]]+([^[:space:]]+) ]]; then
                local iface="${BASH_REMATCH[1]}"
                interfaces+=("$iface")
                print_status "Found wireless interface: $iface"
            fi
        done < <(iw dev 2>/dev/null || true)
    fi
    
    # Method 2: Check /sys/class/net for wireless interfaces
    for iface in /sys/class/net/*/wireless; do
        if [ -d "$iface" ]; then
            local iface_name=$(basename $(dirname "$iface"))
            if [[ ! " ${interfaces[@]} " =~ " ${iface_name} " ]]; then
                interfaces+=("$iface_name")
                print_status "Found wireless interface: $iface_name"
            fi
        fi
    done
    
    # Method 3: Check common interface names
    local common_names=("wlan0" "wlan1" "wlp2s0" "wlp3s0")
    for name in "${common_names[@]}"; do
        if ip link show "$name" &>/dev/null; then
            if [[ ! " ${interfaces[@]} " =~ " ${name} " ]]; then
                interfaces+=("$name")
                print_status "Found wireless interface: $name"
            fi
        fi
    done
    
    if [ ${#interfaces[@]} -eq 0 ]; then
        print_error "No WiFi interface found after RF-kill fixes!"
        print_error "Please ensure WiFi hardware is properly connected and supported"
        print_error "Try: sudo rfkill list all"
        exit 1
    fi
    
    # Select preferred interface (prioritize wlan0, then wlan1, then others)
    for pref in "wlan0" "wlan1"; do
        if [[ " ${interfaces[@]} " =~ " ${pref} " ]]; then
            WIFI_INTERFACE="$pref"
            break
        fi
    done
    
    if [ -z "$WIFI_INTERFACE" ]; then
        WIFI_INTERFACE="${interfaces[0]}"
    fi
    
    print_status "Selected WiFi interface: $WIFI_INTERFACE"
    
    # Test if interface supports AP mode
    if command -v iw &> /dev/null; then
        local phy=$(iw "$WIFI_INTERFACE" info 2>/dev/null | grep wiphy | awk '{print $2}' || echo "")
        if [ -n "$phy" ]; then
            if iw phy "$phy" info 2>/dev/null | grep -A 20 "Supported interface modes" | grep -q "AP"; then
                print_status "✅ Interface supports AP (Access Point) mode"
            else
                print_warning "⚠️ Interface may not support AP mode - hotspot may fail"
            fi
        fi
    fi
}

# Function to validate and resolve conflicts before setup
validate_and_resolve_conflicts() {
    print_status "Validating system for potential conflicts..."
    
    # Check if the target IP is already in use
    if ip addr show | grep -q "$HOTSPOT_IP"; then
        local conflict_interface=$(ip addr show | grep -B2 "$HOTSPOT_IP" | grep -E '^[0-9]+:' | awk -F: '{print $2}' | tr -d ' ')
        print_warning "IP $HOTSPOT_IP is already in use by interface: $conflict_interface"
        
        if [ "$conflict_interface" != "$WIFI_INTERFACE" ]; then
            print_status "Removing IP from conflicting interface..."
            sudo ip addr del "$HOTSPOT_IP/24" dev "$conflict_interface" 2>/dev/null || true
        fi
    fi
    
    # Check for existing dnsmasq or other DNS services
    if pgrep dnsmasq > /dev/null; then
        print_warning "Existing dnsmasq process found, stopping it..."
        sudo pkill -f dnsmasq 2>/dev/null || true
        sleep 1
    fi
    
    # Check for services using port 53
    local port53_users=$(sudo lsof -ti :53 2>/dev/null | wc -l)
    if [ "$port53_users" -gt 0 ]; then
        print_warning "Found $port53_users process(es) using port 53"
        print_status "Clearing port 53 conflicts..."
        sudo fuser -k 53/tcp 2>/dev/null || true
        sudo fuser -k 53/udp 2>/dev/null || true
        sleep 2
    fi
    
    # Check for existing hostapd processes
    if pgrep hostapd > /dev/null; then
        print_warning "Existing hostapd process found, stopping it..."
        sudo pkill -f hostapd 2>/dev/null || true
        sleep 1
    fi
    
    print_status "Conflict validation completed"
}

# Function to check and install dependencies
install_dependencies() {
    print_status "Checking and installing dependencies..."
    
    # Update package list
    sudo apt update >/dev/null 2>&1 &
    show_spinner $! "Updating package list"
    
    # Install required packages with wireless tools
    packages=("hostapd" "dnsmasq" "iptables" "rfkill" "wireless-tools" "iw" "firmware-brcm80211" "psmisc")
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            print_status "Installing $package..."
            sudo apt install -y "$package" >/dev/null 2>&1 &
            show_spinner $! "Installing $package"
        else
            print_status "$package is already installed"
        fi
    done
    
    # Ensure WiFi is unblocked after installing rfkill
    print_status "Ensuring WiFi is unblocked..."
    sudo rfkill unblock all 2>/dev/null || true
}

# Enhanced function to stop conflicting services
stop_conflicting_services() {
    print_status "Stopping conflicting services..."
    
    # Stop existing hostapd and dnsmasq processes first
    sudo pkill -f hostapd >/dev/null 2>&1 || true
    sudo pkill -f dnsmasq >/dev/null 2>&1 || true
    
    # Wait for processes to fully terminate
    sleep 2
    
    # Force kill any remaining dnsmasq processes
    sudo pkill -9 -f dnsmasq >/dev/null 2>&1 || true
    
    # Check for processes using port 53 and kill them
    print_status "Checking for processes using DNS port 53..."
    local dns_pids=$(sudo lsof -ti :53 2>/dev/null || true)
    if [ -n "$dns_pids" ]; then
        print_warning "Found processes using port 53, terminating them..."
        echo "$dns_pids" | xargs -r sudo kill -9 2>/dev/null || true
        sleep 1
    fi
    
    # Check for processes using the hotspot IP address
    print_status "Checking for processes using IP $HOTSPOT_IP..."
    local ip_pids=$(sudo lsof -ti @$HOTSPOT_IP 2>/dev/null || true)
    if [ -n "$ip_pids" ]; then
        print_warning "Found processes using IP $HOTSPOT_IP, terminating them..."
        echo "$ip_pids" | xargs -r sudo kill -9 2>/dev/null || true
        sleep 1
    fi
    
    # Handle wpa_supplicant more carefully
    if pgrep wpa_supplicant >/dev/null; then
        print_warning "Stopping wpa_supplicant (this will disconnect from current WiFi)"
        sudo systemctl stop wpa_supplicant 2>/dev/null || true
        sudo pkill wpa_supplicant 2>/dev/null || true
        sleep 2
    fi
    
    # Stop NetworkManager if it's managing our interface
    if systemctl is-active --quiet NetworkManager 2>/dev/null; then
        if command -v nmcli &> /dev/null && nmcli device show "$WIFI_INTERFACE" &>/dev/null; then
            print_warning "Setting NetworkManager to ignore $WIFI_INTERFACE"
            sudo nmcli device set "$WIFI_INTERFACE" managed false 2>/dev/null || true
        fi
    fi
    
    # Stop systemd-resolved if it conflicts with dnsmasq
    if systemctl is-active --quiet systemd-resolved; then
        if command -v ss &> /dev/null && ss -tlnp 2>/dev/null | grep -q ":53.*systemd-resolved"; then
            print_warning "Stopping systemd-resolved to avoid DNS conflicts"
            sudo systemctl stop systemd-resolved
        fi
    fi
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

# Enhanced function to configure network interface
configure_network() {
    print_status "Configuring network interface..."
    
    # Check if IP is already in use by another interface
    local existing_interface=$(ip route | grep "$HOTSPOT_IP" | awk '{print $3}' | head -1 2>/dev/null || true)
    if [ -n "$existing_interface" ] && [ "$existing_interface" != "$WIFI_INTERFACE" ]; then
        print_warning "IP $HOTSPOT_IP is already assigned to interface $existing_interface, removing..."
        sudo ip addr del "$HOTSPOT_IP/24" dev "$existing_interface" 2>/dev/null || true
    fi
    
    # Bring down the interface first
    sudo ip link set "$WIFI_INTERFACE" down 2>/dev/null || true
    sleep 1
    
    # Remove any existing IP addresses from our interface
    sudo ip addr flush dev "$WIFI_INTERFACE" 2>/dev/null || true
    
    # Remove any existing routes for our IP range
    sudo ip route del 192.168.4.0/24 2>/dev/null || true
    
    # Configure the interface with static IP
    if sudo ip addr add "$HOTSPOT_IP/24" dev "$WIFI_INTERFACE"; then
        print_status "IP address $HOTSPOT_IP assigned to $WIFI_INTERFACE"
    else
        print_error "Failed to assign IP address to $WIFI_INTERFACE"
        # Try to diagnose the issue
        print_error "Checking for IP conflicts..."
        ip addr show | grep -E "(192\.168\.4\.|$HOTSPOT_IP)" || true
        exit 1
    fi
    
    # Bring up the interface
    if sudo ip link set "$WIFI_INTERFACE" up; then
        sleep 2
        # Verify configuration
        if ip addr show "$WIFI_INTERFACE" | grep -q "$HOTSPOT_IP"; then
            print_status "✅ Network interface configured successfully: $HOTSPOT_IP"
        else
            print_error "❌ Failed to verify network interface configuration"
            exit 1
        fi
    else
        print_error "Failed to bring up interface $WIFI_INTERFACE"
        exit 1
    fi
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

# Enhanced function to start hotspot services
start_hotspot_services() {
    print_status "Starting hotspot services..."
    
    # Start hostapd with better error handling
    print_status "Starting hostapd..."
    if sudo hostapd /etc/hostapd/hostapd.conf -B; then
        sleep 3  # Give hostapd more time to start
        if pgrep hostapd > /dev/null; then
            print_status "✅ hostapd started successfully"
        else
            print_error "❌ hostapd failed to start properly"
            print_error "Check logs with: sudo journalctl -u hostapd -n 10"
            return 1
        fi
    else
        print_error "❌ Failed to start hostapd"
        print_error "Try running: sudo hostapd /etc/hostapd/hostapd.conf -dd"
        return 1
    fi
    
    # Start dnsmasq with better error handling
    print_status "Starting dnsmasq..."
    
    # First test the configuration
    if ! sudo dnsmasq --test -C /etc/dnsmasq.conf >/dev/null 2>&1; then
        print_error "❌ dnsmasq configuration test failed"
        print_error "Check configuration with: sudo dnsmasq --test -C /etc/dnsmasq.conf"
        return 1
    fi
    
    # Try to start dnsmasq and capture any errors
    local dnsmasq_output=$(sudo dnsmasq -C /etc/dnsmasq.conf 2>&1)
    local dnsmasq_exit_code=$?
    
    if [ $dnsmasq_exit_code -eq 0 ]; then
        sleep 2
        if pgrep dnsmasq > /dev/null; then
            print_status "✅ dnsmasq started successfully"
        else
            print_error "❌ dnsmasq failed to start properly"
            return 1
        fi
    else
        print_error "❌ Failed to start dnsmasq"
        
        # Check for specific "address already in use" error
        if echo "$dnsmasq_output" | grep -q "address already in use"; then
            print_warning "Address conflict detected, attempting to resolve..."
            
            # Kill any remaining processes using port 53
            sudo fuser -k 53/tcp 2>/dev/null || true
            sudo fuser -k 53/udp 2>/dev/null || true
            sleep 2
            
            # Try starting dnsmasq again
            print_status "Retrying dnsmasq startup..."
            if sudo dnsmasq -C /etc/dnsmasq.conf; then
                sleep 2
                if pgrep dnsmasq > /dev/null; then
                    print_status "✅ dnsmasq started successfully on retry"
                else
                    print_error "❌ dnsmasq failed to start on retry"
                    return 1
                fi
            else
                print_error "❌ dnsmasq failed to start even after clearing port conflicts"
                echo "Error output: $dnsmasq_output"
                return 1
            fi
        else
            print_error "Error output: $dnsmasq_output"
            print_error "Check configuration with: sudo dnsmasq --test -C /etc/dnsmasq.conf"
            return 1
        fi
    fi
    
    # Final verification
    if pgrep hostapd > /dev/null && pgrep dnsmasq > /dev/null; then
        print_status "✅ All hotspot services are running"
        return 0
    else
        print_error "❌ One or more hotspot services failed to start"
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
    
    echo -e "${YELLOW}🐛 Troubleshooting Tips:${NC}"
    echo "   • If hotspot doesn't appear: Check 'sudo journalctl -u hostapd -n 10'"
    echo "   • If devices can't connect: Verify WiFi adapter supports AP mode"
    echo "   • If DNS doesn't work: Check 'sudo journalctl -u dnsmasq -n 10'"
    echo "   • If RF-kill errors: Run 'sudo rfkill unblock all'"
    echo "   • Interface issues: Check 'ip addr show $WIFI_INTERFACE'"
    echo "   • For full diagnosis: Check system logs with 'dmesg | tail -20'"
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

# Function to check if hotspot is already running
check_hotspot_running() {
    print_status "Checking if hotspot is already running..."
    
    local hotspot_running=false
    local services_found=""
    
    # Check if hostapd is running
    if pgrep hostapd > /dev/null; then
        hotspot_running=true
        services_found="hostapd "
        print_warning "Found running hostapd process"
    fi
    
    # Check if dnsmasq is running
    if pgrep dnsmasq > /dev/null; then
        hotspot_running=true
        services_found="${services_found}dnsmasq "
        print_warning "Found running dnsmasq process"
    fi
    
    # Check if systemd service is active
    if systemctl is-active --quiet gamehub-hotspot 2>/dev/null; then
        hotspot_running=true
        services_found="${services_found}systemd-service "
        print_warning "Found active gamehub-hotspot systemd service"
    fi
    
    # Check if interface is already configured with hotspot IP
    if ip addr show 2>/dev/null | grep -q "$HOTSPOT_IP"; then
        hotspot_running=true
        services_found="${services_found}interface-configured "
        print_warning "Found interface already configured with hotspot IP $HOTSPOT_IP"
    fi
    
    if [ "$hotspot_running" = true ]; then
        print_warning "Hotspot appears to be running (services: $services_found)"
        print_status "Stopping existing hotspot before restarting..."
        
        # Stop the existing hotspot
        stop_hotspot
        
        # Give services time to fully shutdown
        sleep 3
        
        # Verify everything is stopped
        local still_running=""
        if pgrep hostapd > /dev/null; then
            still_running="${still_running}hostapd "
        fi
        if pgrep dnsmasq > /dev/null; then
            still_running="${still_running}dnsmasq "
        fi
        
        if [ -n "$still_running" ]; then
            print_warning "Some services still running ($still_running), force stopping..."
            sudo pkill -9 -f hostapd >/dev/null 2>&1 || true
            sudo pkill -9 -f dnsmasq >/dev/null 2>&1 || true
            sleep 2
        fi
        
        print_status "✅ Existing hotspot stopped successfully"
    else
        print_status "✅ No existing hotspot detected, proceeding with fresh setup"
    fi
}

# Main setup function
setup_hotspot() {
    print_header "GAME HUB HOTSPOT SETUP"
    
    # Check if hotspot is already running and stop it if needed
    check_hotspot_running
    
    # Initial checks
    check_root
    check_raspberry_pi
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Fix RF-kill issues first
    fix_rfkill_issues
    
    # Detect WiFi interface
    detect_wifi_interface
    
    # Validate and resolve conflicts early
    validate_and_resolve_conflicts
    
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