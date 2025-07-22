#!/bin/bash

# Game Hub Master Setup Script
# Orchestrates the complete setup process for Raspberry Pi Game Hub
# Runs: download_dependencies.sh -> start_hotspot.sh -> start_game_hub.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPENDENCIES_SCRIPT="download_dependencies.sh"
HOTSPOT_SCRIPT="start_hotspot.sh"
GAME_SCRIPT="start_game_hub.sh"

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

print_step() {
    echo -e "${PURPLE}[STEP $1/3]${NC} $2"
}

print_success() {
    echo -e "${CYAN}[SUCCESS]${NC} $1"
}

# Function to show progress with dots
show_progress() {
    local pid=$1
    local message=$2
    echo -n "$message"
    while [ "$(ps a | awk '{print $1}' | grep $pid)" ]; do
        echo -n "."
        sleep 0.5
    done
    echo ""
}

# Function to check if script exists
check_script_exists() {
    local script_name="$1"
    local script_path="$SCRIPT_DIR/$script_name"
    
    if [ -f "$script_path" ]; then
        print_status "Found: $script_name"
        return 0
    else
        print_error "Script not found: $script_path"
        return 1
    fi
}

# Function to check and set execute permissions
check_and_set_permissions() {
    local script_name="$1"
    local script_path="$SCRIPT_DIR/$script_name"
    
    if [ ! -x "$script_path" ]; then
        print_warning "$script_name is not executable, setting permissions..."
        chmod +x "$script_path"
        if [ -x "$script_path" ]; then
            print_success "Execute permission set for $script_name"
        else
            print_error "Failed to set execute permission for $script_name"
            return 1
        fi
    else
        print_status "$script_name has correct permissions"
    fi
    
    return 0
}

# Function to validate all scripts before starting
validate_scripts() {
    print_status "Validating all scripts..."
    
    local errors=0
    local scripts=("$DEPENDENCIES_SCRIPT" "$HOTSPOT_SCRIPT" "$GAME_SCRIPT")
    
    for script in "${scripts[@]}"; do
        if ! check_script_exists "$script"; then
            ((errors++))
        elif ! check_and_set_permissions "$script"; then
            ((errors++))
        fi
    done
    
    if [ $errors -eq 0 ]; then
        print_success "All scripts validated successfully"
        return 0
    else
        print_error "$errors script validation errors found"
        return 1
    fi
}

# Function to check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "Please don't run this script as root."
        print_error "The individual scripts will ask for sudo when needed."
        exit 1
    fi
}

# Function to check if running on Raspberry Pi
check_raspberry_pi() {
    print_status "Checking environment..."
    
    if [ -f "/proc/cpuinfo" ] && grep -q "Raspberry Pi\|BCM2" /proc/cpuinfo 2>/dev/null; then
        print_success "Running on Raspberry Pi - environment verified"
        return 0
    else
        print_warning "This doesn't appear to be a Raspberry Pi"
        print_warning "Some features may not work as expected"
        
        # Ask user if they want to continue on non-Pi systems
        echo ""
        echo "Do you want to continue anyway? (y/N)"
        read -t 10 -r response || response="n"
        
        if [[ $response =~ ^[Yy]$ ]]; then
            print_status "Continuing on non-Raspberry Pi system..."
            return 0
        else
            print_error "Setup aborted by user"
            exit 1
        fi
    fi
}

# Function to run a script with error handling
run_script() {
    local step_num="$1"
    local script_name="$2"
    local description="$3"
    local script_path="$SCRIPT_DIR/$script_name"
    
    print_step "$step_num" "$description"
    print_status "Executing: $script_name"
    
    # Run the script and capture output
    echo ""
    echo "--- START $script_name OUTPUT ---"
    
    if bash "$script_path"; then
        echo "--- END $script_name OUTPUT ---"
        echo ""
        print_success "Step $step_num completed successfully: $description"
        return 0
    else
        local exit_code=$?
        echo "--- END $script_name OUTPUT ---"
        echo ""
        print_error "Step $step_num failed with exit code $exit_code: $description"
        return $exit_code
    fi
}

# Function to handle script failures
handle_failure() {
    local failed_step="$1"
    local script_name="$2"
    
    print_error "Setup failed at step $failed_step ($script_name)"
    
    case $failed_step in
        1)
            print_error "Dependencies download failed"
            echo ""
            echo "Possible solutions:"
            echo "• Check your internet connection"
            echo "• Run 'sudo apt update' manually"
            echo "• Try running '$DEPENDENCIES_SCRIPT' separately"
            ;;
        2)
            print_error "Hotspot setup failed"
            echo ""
            echo "Possible solutions:"
            echo "• Check if WiFi adapter is connected"
            echo "• Ensure no other network managers are running"
            echo "• Try running '$HOTSPOT_SCRIPT' separately with different parameters"
            ;;
        3)
            print_error "Game hub startup failed"
            echo ""
            echo "Possible solutions:"
            echo "• Check if Node.js dependencies were installed correctly"
            echo "• Verify that ports 8000 is available"
            echo "• Try running '$GAME_SCRIPT' separately"
            ;;
    esac
    
    echo ""
    print_status "You can run individual scripts manually to troubleshoot:"
    echo "  ./$DEPENDENCIES_SCRIPT"
    echo "  ./$HOTSPOT_SCRIPT"
    echo "  ./$GAME_SCRIPT"
}

# Function to display startup information
display_startup_info() {
    print_header "GAME HUB MASTER SETUP"
    echo ""
    echo -e "${CYAN}🎮 Raspberry Pi Game Hub Setup${NC}"
    echo "This script will automatically:"
    echo ""
    echo -e "${GREEN}Step 1:${NC} Download all dependencies (while internet is available)"
    echo -e "${GREEN}Step 2:${NC} Setup WiFi hotspot (will disconnect from internet)"
    echo -e "${GREEN}Step 3:${NC} Start the game hub server"
    echo ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo "• Make sure you have a stable internet connection"
    echo "• The WiFi hotspot will disconnect you from the internet"
    echo "• All dependencies must be downloaded before hotspot activation"
    echo "• The process will run automatically with no manual input required"
    echo ""
    echo -e "${CYAN}📍 Current directory:${NC} $SCRIPT_DIR"
    echo ""
    
    # Show detected scripts
    echo -e "${CYAN}📋 Scripts to execute:${NC}"
    echo "  1. $DEPENDENCIES_SCRIPT"
    echo "  2. $HOTSPOT_SCRIPT"
    echo "  3. $GAME_SCRIPT"
    echo ""
    
    # Give user a moment to read and option to cancel
    echo "Starting in 5 seconds... (Press Ctrl+C to cancel)"
    for i in {5..1}; do
        echo -ne "\r${YELLOW}Starting in $i seconds...${NC}"
        sleep 1
    done
    echo -ne "\r${GREEN}Starting now!${NC}          \n"
    echo ""
}

# Function to display completion summary
display_completion_summary() {
    print_header "🎉 GAME HUB SETUP COMPLETE! 🎉"
    echo ""
    echo -e "${GREEN}✅ All steps completed successfully:${NC}"
    echo "   1. ✅ Dependencies downloaded and installed"
    echo "   2. ✅ WiFi hotspot configured and started"
    echo "   3. ✅ Game hub server is running"
    echo ""
    echo -e "${CYAN}📡 Your Game Hub is now ready!${NC}"
    echo ""
    echo -e "${GREEN}📱 Connection Information:${NC}"
    
    # Try to extract hotspot info from the hotspot script configuration
    local hotspot_ssid="GameHub-Direct"
    local hotspot_password="gamehub123"
    local hotspot_ip="192.168.4.1"
    
    # Try to read actual configuration
    if [ -f "/etc/hostapd/hostapd.conf" ]; then
        local detected_ssid=$(grep "^ssid=" /etc/hostapd/hostapd.conf 2>/dev/null | cut -d'=' -f2)
        local detected_password=$(grep "^wpa_passphrase=" /etc/hostapd/hostapd.conf 2>/dev/null | cut -d'=' -f2)
        
        if [ -n "$detected_ssid" ]; then
            hotspot_ssid="$detected_ssid"
        fi
        if [ -n "$detected_password" ]; then
            hotspot_password="$detected_password"
        fi
    fi
    
    echo "   WiFi Network: $hotspot_ssid"
    echo "   Password: $hotspot_password"
    echo "   Server IP: $hotspot_ip"
    echo ""
    echo -e "${GREEN}🌐 Access URLs:${NC}"
    echo "   Main Display: http://$hotspot_ip:8000/"
    echo "   Mobile View:  http://$hotspot_ip:8000/mobile/"
    echo "   Admin Panel:  http://$hotspot_ip:8000/admin-panel/"
    echo ""
    echo -e "${GREEN}📋 Next Steps:${NC}"
    echo "   1. Connect your mobile device to WiFi: '$hotspot_ssid'"
    echo "   2. Enter password: '$hotspot_password'"
    echo "   3. Open a web browser and go to the URLs above"
    echo "   4. Start creating and managing your game content!"
    echo ""
    echo -e "${YELLOW}💡 Management Commands:${NC}"
    echo "   Stop hotspot: sudo systemctl stop gamehub-hotspot"
    echo "   Start hotspot: sudo systemctl start gamehub-hotspot"
    echo "   Check status: sudo systemctl status gamehub-hotspot"
    echo ""
    echo -e "${CYAN}🎮 Happy Gaming!${NC}"
}

# Cleanup function
cleanup() {
    local exit_code=$?
    
    if [ $exit_code -ne 0 ]; then
        echo ""
        print_error "Setup interrupted or failed"
        
        # If we get here due to an error, show some helpful info
        if [ -f "/tmp/gamehub_setup.log" ]; then
            echo ""
            echo "Check the setup log for details:"
            echo "tail -20 /tmp/gamehub_setup.log"
        fi
    fi
    
    # Clean up any temporary files
    rm -f /tmp/gamehub_setup.lock
}

# Main execution function
main() {
    # Set up logging
    exec 1> >(tee -a /tmp/gamehub_setup.log)
    exec 2> >(tee -a /tmp/gamehub_setup.log >&2)
    
    # Create lock file to prevent multiple instances
    if [ -f "/tmp/gamehub_setup.lock" ]; then
        print_error "Another instance of the setup script is already running"
        print_error "If this is incorrect, remove /tmp/gamehub_setup.lock and try again"
        exit 1
    fi
    touch /tmp/gamehub_setup.lock
    
    # Set up cleanup trap
    trap cleanup EXIT INT TERM
    
    # Display startup information
    display_startup_info
    
    # Initial validation
    check_root
    check_raspberry_pi
    validate_scripts
    
    # Execute the three main steps
    local overall_success=true
    
    # Step 1: Download Dependencies
    if ! run_script 1 "$DEPENDENCIES_SCRIPT" "Downloading all dependencies"; then
        handle_failure 1 "$DEPENDENCIES_SCRIPT"
        overall_success=false
    fi
    
    # Step 2: Setup Hotspot (only if step 1 succeeded)
    if [ "$overall_success" = true ]; then
        if ! run_script 2 "$HOTSPOT_SCRIPT" "Setting up WiFi hotspot"; then
            handle_failure 2 "$HOTSPOT_SCRIPT"
            overall_success=false
        fi
    fi
    
    # Step 3: Start Game Hub (only if previous steps succeeded)
    if [ "$overall_success" = true ]; then
        print_step 3 "Starting Game Hub server"
        print_status "Executing: $GAME_SCRIPT"
        print_warning "The game server will run continuously. Press Ctrl+C to stop."
        
        echo ""
        echo "--- GAME HUB SERVER STARTING ---"
        
        # For the game script, we want it to run continuously
        # So we don't use run_script which would wait for completion
        bash "$SCRIPT_DIR/$GAME_SCRIPT"
        
        # If we get here, the game script exited (which is expected when user stops it)
        echo ""
        echo "--- GAME HUB SERVER STOPPED ---"
        print_status "Game Hub server has been stopped"
    fi
    
    # Show completion summary if everything succeeded
    if [ "$overall_success" = true ]; then
        display_completion_summary
    else
        print_error "Setup completed with errors. Please check the output above."
        exit 1
    fi
}

# Parse command line arguments
case "${1:-run}" in
    "run"|"start"|"")
        main
        ;;
        
    "validate"|"check")
        print_header "SCRIPT VALIDATION"
        check_root
        validate_scripts
        print_success "All scripts are valid and ready to run"
        ;;
        
    "permissions"|"chmod")
        print_header "SETTING SCRIPT PERMISSIONS"
        check_and_set_permissions "$DEPENDENCIES_SCRIPT"
        check_and_set_permissions "$HOTSPOT_SCRIPT"
        check_and_set_permissions "$GAME_SCRIPT"
        print_success "All permissions set correctly"
        ;;
        
    "help"|"--help")
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "   run, start         - Run the complete setup process (default)"
        echo "   validate, check    - Validate all scripts without running them"
        echo "   permissions, chmod - Set execute permissions on all scripts"
        echo "   help               - Show this help message"
        echo ""
        echo "Master Setup Process:"
        echo "   1. Downloads all dependencies (while internet is available)"
        echo "   2. Sets up WiFi hotspot (disconnects from internet)"
        echo "   3. Starts the game hub server (runs continuously)"
        echo ""
        echo "Required Scripts:"
        echo "   • $DEPENDENCIES_SCRIPT"
        echo "   • $HOTSPOT_SCRIPT"
        echo "   • $GAME_SCRIPT"
        ;;
        
    *)
        print_error "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac 