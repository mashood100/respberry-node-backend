#!/bin/bash

# Game Hub Dependencies Download Script
# Downloads all necessary files and dependencies before hotspot activation
# Raspberry Pi compatible - run this BEFORE starting the hotspot

set -e  # Exit on any error

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

# Function to check internet connectivity
check_internet() {
    print_status "Checking internet connectivity..."
    
    # Try multiple endpoints to ensure connectivity
    if ping -c 1 google.com >/dev/null 2>&1 || \
       ping -c 1 8.8.8.8 >/dev/null 2>&1 || \
       ping -c 1 1.1.1.1 >/dev/null 2>&1; then
        print_status "Internet connection verified"
        return 0
    else
        print_error "No internet connection detected"
        print_error "Please ensure you have internet access before running this script"
        return 1
    fi
}

# Function to detect if running on Raspberry Pi
detect_raspberry_pi() {
    print_status "Detecting Raspberry Pi environment..."
    
    if [ -f "/proc/cpuinfo" ] && grep -q "Raspberry Pi\|BCM2" /proc/cpuinfo 2>/dev/null; then
        print_status "Raspberry Pi detected"
        return 0
    else
        print_warning "This doesn't appear to be a Raspberry Pi"
        print_warning "Script will continue but some optimizations may not apply"
        return 1
    fi
}

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "Please don't run this script as root. We'll ask for sudo when needed."
        exit 1
    fi
}

# Function to update system packages
update_system_packages() {
    print_status "Updating system package lists..."
    
    # Update package lists
    sudo apt update -qq >/dev/null 2>&1 &
    show_spinner $! "Updating package repositories"
    
    print_status "System packages updated successfully"
}

# Function to install system dependencies
install_system_dependencies() {
    print_status "Installing system dependencies..."
    
    # Core packages needed for hotspot and game hub
    local packages=(
        "hostapd"           # WiFi hotspot access point
        "dnsmasq"           # DHCP and DNS server
        "iptables"          # Firewall and NAT
        "curl"              # Download tool
        "wget"              # Alternative download tool
        "git"               # Version control (in case we need to clone repos)
        "build-essential"   # Compilation tools for native modules
        "python3-pip"       # Python package manager (sometimes needed for native modules)
        "software-properties-common" # For adding repositories
    )
    
    for package in "${packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            print_status "Installing $package..."
            sudo apt install -y "$package" >/dev/null 2>&1 &
            show_spinner $! "Installing $package"
        else
            print_status "$package is already installed"
        fi
    done
    
    print_status "System dependencies installed successfully"
}

# Function to install Node.js with NodeSource repository
install_nodejs() {
    print_status "Checking Node.js installation..."
    
    # Check if Node.js is already installed and is version 16+
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//')
        MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d'.' -f1)
        
        if [ "$MAJOR_VERSION" -ge 16 ]; then
            print_status "Node.js $NODE_VERSION is already installed and compatible"
            return 0
        else
            print_warning "Node.js $NODE_VERSION is too old, upgrading to LTS version..."
        fi
    else
        print_status "Node.js not found, installing LTS version..."
    fi
    
    # Install Node.js LTS using NodeSource repository
    print_status "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - >/dev/null 2>&1 &
    show_spinner $! "Adding NodeSource repository"
    
    print_status "Installing Node.js LTS..."
    sudo apt-get install -y nodejs >/dev/null 2>&1 &
    show_spinner $! "Installing Node.js"
    
    # Verify installation
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        NODE_VERSION=$(node --version)
        NPM_VERSION=$(npm --version)
        print_status "Successfully installed Node.js $NODE_VERSION and npm $NPM_VERSION"
    else
        print_error "Node.js installation failed"
        return 1
    fi
}

# Function to install npm dependencies
install_npm_dependencies() {
    print_status "Installing npm dependencies..."
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        print_error "package.json not found in current directory"
        print_error "Please run this script from the nodejs-gamehub directory"
        return 1
    fi
    
    print_status "Found package.json, installing dependencies..."
    
    # Clear npm cache to prevent issues
    npm cache clean --force >/dev/null 2>&1 || true
    
    # Install dependencies with production flag for faster installation
    print_status "Installing npm packages (this may take several minutes)..."
    npm install --production >/dev/null 2>&1 &
    show_spinner $! "Installing npm packages"
    
    # Install development dependencies separately if needed
    if [ -f "package-lock.json" ] && grep -q '"devDependencies"' package.json; then
        print_status "Installing development dependencies..."
        npm install --only=dev >/dev/null 2>&1 &
        show_spinner $! "Installing dev dependencies"
    fi
    
    print_status "npm dependencies installed successfully"
}

# Function to download additional resources
download_additional_resources() {
    print_status "Downloading additional resources..."
    
    # Create necessary directories
    mkdir -p uploads static/qr-codes media
    
    # Download any additional resources that might be needed
    # This could include default images, fonts, or other assets
    
    # Set proper permissions
    chmod 755 uploads static/qr-codes media
    
    print_status "Additional resources prepared"
}

# Function to setup database
setup_database() {
    print_status "Setting up database..."
    
    # Check if database initialization script exists
    if [ -f "scripts/init-db.js" ]; then
        print_status "Running database initialization..."
        node scripts/init-db.js >/dev/null 2>&1 &
        show_spinner $! "Initializing database"
        print_status "Database initialized successfully"
    else
        print_status "No database initialization script found, using in-memory storage"
    fi
}

# Function to verify all dependencies
verify_dependencies() {
    print_status "Verifying all dependencies..."
    
    local errors=0
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        print_error "Node.js not found"
        ((errors++))
    else
        print_status "✅ Node.js: $(node --version)"
    fi
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        print_error "npm not found"
        ((errors++))
    else
        print_status "✅ npm: $(npm --version)"
    fi
    
    # Check system packages
    local required_packages=("hostapd" "dnsmasq" "iptables")
    for package in "${required_packages[@]}"; do
        if ! dpkg -l | grep -q "^ii  $package "; then
            print_error "$package not installed"
            ((errors++))
        else
            print_status "✅ $package: installed"
        fi
    done
    
    # Check npm dependencies
    if [ -f "package.json" ] && [ -d "node_modules" ]; then
        print_status "✅ npm dependencies: installed"
    else
        print_error "npm dependencies not properly installed"
        ((errors++))
    fi
    
    if [ $errors -eq 0 ]; then
        print_status "All dependencies verified successfully"
        return 0
    else
        print_error "$errors dependency verification errors found"
        return 1
    fi
}

# Function to display summary
display_summary() {
    print_header "DEPENDENCY DOWNLOAD COMPLETE"
    
    echo -e "${GREEN}📦 Downloaded Components:${NC}"
    echo "   • System packages (hostapd, dnsmasq, etc.)"
    echo "   • Node.js LTS and npm"
    echo "   • npm project dependencies"
    echo "   • Database initialization"
    echo "   • Additional resources and directories"
    echo ""
    
    echo -e "${GREEN}🎯 Ready for Next Steps:${NC}"
    echo "   1. ✅ Dependencies downloaded - READY"
    echo "   2. 🔄 Run hotspot setup script"
    echo "   3. 🔄 Run game hub startup script"
    echo ""
    
    echo -e "${GREEN}💡 Important Notes:${NC}"
    echo "   • All downloads completed while internet was available"
    echo "   • Hotspot mode will block internet access after activation"
    echo "   • All necessary files are now cached locally"
    echo ""
    
    if command -v node >/dev/null 2>&1; then
        echo -e "${GREEN}🟢 Node.js Ready:${NC} $(node --version)"
    fi
    
    if [ -f "package.json" ] && [ -d "node_modules" ]; then
        echo -e "${GREEN}📦 npm Dependencies:${NC} $(ls node_modules | wc -l) packages installed"
    fi
}

# Cleanup function
cleanup() {
    if [ "$1" != "success" ]; then
        print_status "Cleaning up due to error..."
        
        # Clean up any partial downloads
        if [ -d "node_modules.tmp" ]; then
            rm -rf node_modules.tmp
        fi
        
        print_status "Cleanup complete"
    fi
}

# Main function
main() {
    print_header "GAME HUB DEPENDENCIES DOWNLOAD"
    print_status "Preparing to download all necessary dependencies..."
    print_warning "This must be run BEFORE starting the hotspot!"
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Initial checks
    check_root
    detect_raspberry_pi
    check_internet
    
    # Update system
    update_system_packages
    
    # Install system dependencies
    install_system_dependencies
    
    # Install Node.js
    install_nodejs
    
    # Install npm dependencies
    install_npm_dependencies
    
    # Download additional resources
    download_additional_resources
    
    # Setup database
    setup_database
    
    # Verify everything is installed correctly
    if verify_dependencies; then
        display_summary
        print_status "Dependencies download completed successfully!"
        
        # Clean exit without cleanup
        trap - EXIT
        exit 0
    else
        print_error "Dependency verification failed"
        exit 1
    fi
}

# Parse command line arguments
case "${1:-download}" in
    "download"|"install"|"")
        main
        ;;
        
    "verify"|"check")
        print_header "DEPENDENCY VERIFICATION"
        verify_dependencies
        ;;
        
    "help"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "   download, install  - Download all dependencies (default)"
        echo "   verify, check      - Verify installed dependencies"
        echo "   help               - Show this help message"
        echo ""
        echo "This script must be run BEFORE starting the hotspot!"
        echo "It downloads all necessary files while internet access is available."
        ;;
        
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac 