# Raspberry Pi Game Hub - Complete Setup Scripts

This directory now contains a complete automated setup system for your Raspberry Pi Game Hub. The setup has been designed to handle the challenge where internet access is lost once the hotspot is activated.

## 📋 Script Overview

You now have **4 scripts** total:

### 1. **download_dependencies.sh** _(NEW)_

- Downloads all necessary dependencies while internet is available
- Installs Node.js, system packages, and npm dependencies
- Must be run BEFORE the hotspot is activated
- Compatible with Raspberry Pi environment

### 2. **start_hotspot.sh** _(EXISTING)_

- Sets up the WiFi hotspot for direct device connections
- Disconnects from internet once activated
- Creates network: `GameHub-Direct` (password: `gamehub123`)

### 3. **start_game_hub.sh** _(EXISTING)_

- Starts the Node.js game server
- Handles QR code generation and game management
- Runs continuously until stopped

### 4. **master_setup.sh** _(NEW)_

- **MAIN SCRIPT** - Orchestrates everything automatically
- Runs all three scripts in the correct order
- Handles permissions and error checking
- Requires no manual input

## 🚀 Quick Start (Recommended)

**Just run the master script - it handles everything:**

```bash
# Navigate to the project directory
cd nodejs-gamehub

# Make the master script executable (if needed)
chmod +x master_setup.sh

# Run the complete setup
./master_setup.sh
```

That's it! The master script will:

1. ✅ Check and set permissions on all scripts automatically
2. ✅ Download all dependencies (while internet is available)
3. ✅ Setup the WiFi hotspot (internet will be lost after this)
4. ✅ Start the game server (runs continuously)

## 📝 Manual Setup (Alternative)

If you prefer to run scripts individually:

```bash
# 1. First, make all scripts executable
chmod +x *.sh

# 2. Download dependencies (MUST be first, requires internet)
./download_dependencies.sh

# 3. Setup hotspot (internet will be lost after this)
./start_hotspot.sh

# 4. Start the game (runs continuously)
./start_game_hub.sh
```

## ⚠️ Important Notes

### Internet Connection

- **CRITICAL**: Run `download_dependencies.sh` FIRST while you have internet
- Once the hotspot starts, internet access will be lost
- All downloads must complete before hotspot activation

### Permissions

- The master script automatically handles permissions
- If running manually: `chmod +x *.sh` before starting

### Raspberry Pi Compatibility

- All scripts are optimized for Raspberry Pi OS
- They will detect and adapt to the Pi environment
- Non-Pi systems will show warnings but can still work

## 🔧 Script Commands

### Master Setup Script

```bash
./master_setup.sh                # Run complete setup (default)
./master_setup.sh run            # Same as above
./master_setup.sh validate       # Check all scripts without running
./master_setup.sh permissions    # Set execute permissions only
./master_setup.sh help           # Show help
```

### Dependencies Script

```bash
./download_dependencies.sh       # Download all dependencies (default)
./download_dependencies.sh verify # Verify what's installed
./download_dependencies.sh help  # Show help
```

### Hotspot Script

```bash
./start_hotspot.sh               # Setup and start hotspot (default)
./start_hotspot.sh stop          # Stop hotspot
./start_hotspot.sh status        # Check hotspot status
./start_hotspot.sh restart       # Restart hotspot
./start_hotspot.sh help          # Show help
```

## 📱 Connection Information

After successful setup:

**WiFi Network:** `GameHub-Direct`  
**Password:** `gamehub123`  
**Server IP:** `192.168.4.1`

**Access URLs:**

- Main Display: http://192.168.4.1:8000/
- Mobile View: http://192.168.4.1:8000/mobile/
- Admin Panel: http://192.168.4.1:8000/admin-panel/

## 🛠️ Troubleshooting

### Setup Fails at Dependencies

```bash
# Check internet connection
ping google.com

# Run dependencies script separately
./download_dependencies.sh

# Check what's installed
./download_dependencies.sh verify
```

### Hotspot Setup Fails

```bash
# Check WiFi adapter
ip link show

# Check for conflicting services
sudo systemctl status NetworkManager
sudo systemctl status wpa_supplicant

# Run hotspot script with different options
./start_hotspot.sh restart
```

### Game Server Fails to Start

```bash
# Check Node.js installation
node --version
npm --version

# Check if dependencies are installed
ls node_modules/

# Check port availability
sudo netstat -tlnp | grep :8000
```

### Permission Issues

```bash
# Fix all permissions at once
chmod +x *.sh

# Or use the master script
./master_setup.sh permissions
```

## 📊 What Gets Downloaded

The dependencies script downloads:

**System Packages:**

- `hostapd` - WiFi hotspot software
- `dnsmasq` - DHCP and DNS server
- `iptables` - Network configuration
- `curl`, `wget` - Download tools
- `git` - Version control
- `build-essential` - Compilation tools
- `python3-pip` - Python packages (for native modules)

**Node.js Environment:**

- Node.js LTS (version 16+)
- npm package manager
- All packages from `package.json`

**Additional Resources:**

- Database initialization (if applicable)
- Required directories (`uploads`, `static/qr-codes`, `media`)
- Proper file permissions

## 🎮 After Setup

Once everything is running:

1. **Connect mobile devices** to WiFi: `GameHub-Direct`
2. **Enter password:** `gamehub123`
3. **Open browser** and go to: `http://192.168.4.1:8000/mobile/`
4. **Use admin panel** to create and manage game content
5. **QR codes** will be generated automatically for easy mobile access

## 🔄 Management Commands

```bash
# Stop/start hotspot
sudo systemctl stop gamehub-hotspot
sudo systemctl start gamehub-hotspot

# Check hotspot status
sudo systemctl status gamehub-hotspot

# View logs
sudo journalctl -u gamehub-hotspot
tail -f /tmp/gamehub_setup.log
```

## 💡 Tips

- **Test first**: Run `./master_setup.sh validate` to check everything before starting
- **Stable internet**: Ensure good internet connection before running dependencies download
- **Screen/tmux**: Consider running in screen/tmux for long-running processes
- **Backups**: The scripts create backups of system configurations automatically

---

## 🏁 Summary

**For most users, just run:**

```bash
chmod +x master_setup.sh
./master_setup.sh
```

The master script handles everything automatically and provides clear feedback throughout the process. Once complete, your Raspberry Pi will be a fully functional Game Hub with WiFi hotspot capabilities!
