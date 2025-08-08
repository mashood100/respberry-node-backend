# 🎮 Game Hub One-Click Launcher

This launcher provides a simple, game-like experience for starting and stopping your Raspberry Pi Game Hub. No more dealing with terminal commands or manual script execution!

## 🚀 Quick Start

### First Time Setup

1. Run the installer:

   ```bash
   ./install_launcher.sh
   ```

2. This will create desktop shortcuts and make everything ready to use.

### Launch Game Hub

Choose any of these methods:

#### 🖱️ **One-Click Desktop Launch** (Recommended)

- **macOS**: Double-click `Game Hub.app` on your Desktop
- **Linux/Raspberry Pi**: Double-click `Game Hub.desktop` on your Desktop

#### 🖥️ **Command Line Launch**

```bash
./launch_game_hub.sh
```

#### 🐍 **Direct Python Launch**

```bash
python3 game_hub_launcher.py
```

## 🎯 Features

### ✨ What the Launcher Does

- **Automated Setup**: Runs all required scripts automatically
- **No Terminal Required**: Beautiful GUI interface
- **Real-time Output**: See progress and logs in real-time
- **One-Click Stop**: Cleanly shuts down all processes
- **Validation**: Check if your setup is ready before starting
- **Connection Info**: Shows WiFi credentials and access URLs

### 🔄 Automatic Process

When you click "Start Game Hub", the launcher automatically:

1. **Downloads Dependencies** - Gets all required packages while internet is available
2. **Sets Up WiFi Hotspot** - Creates the game network (disconnects from internet)
3. **Starts Game Server** - Launches the Node.js server and web interface

### 🛑 Clean Shutdown

- Click "Stop Game Hub" or close the window
- All processes are cleanly terminated
- WiFi hotspot is properly stopped
- System returns to normal state

## 🎮 Using the Game Hub

Once started, the launcher will show connection information:

### 📡 WiFi Connection

- **Network**: GameHub-Direct
- **Password**: gamehub123

### 🌐 Access URLs

- **Main Display**: http://192.168.4.1:8000/
- **Mobile View**: http://192.168.4.1:8000/mobile/
- **Admin Panel**: http://192.168.4.1:8000/admin-panel/

## 🔧 Troubleshooting

### Common Issues

#### ❌ "Python3 not found"

```bash
# Ubuntu/Debian/Raspberry Pi OS
sudo apt update
sudo apt install python3

# macOS (with Homebrew)
brew install python3
```

#### ❌ "tkinter not available"

```bash
# Ubuntu/Debian/Raspberry Pi OS
sudo apt install python3-tk
```

#### ❌ "Script not found"

Make sure you're running the launcher from the correct directory:

```bash
cd /path/to/respberry-node-backend
./launch_game_hub.sh
```

### Validation

Use the "Validate Setup" button to check if all required files are present:

- master_setup.sh
- download_dependencies.sh
- start_hotspot.sh
- start_game_hub.sh
- package.json
- server.js

## 📂 File Structure

```
respberry-node-backend/
├── game_hub_launcher.py      # Main GUI launcher
├── install_launcher.sh       # Setup installer
├── launch_game_hub.sh        # Simple command-line launcher
├── master_setup.sh           # Main setup orchestrator
├── download_dependencies.sh  # Dependency downloader
├── start_hotspot.sh          # WiFi hotspot setup
├── start_game_hub.sh         # Game server starter
└── ...                       # Other game files
```

## 🎯 Design Goals

This launcher was designed to make your Game Hub feel like a real game:

- **One-Click Launch**: Just like starting any other application
- **No Terminal**: Clean, user-friendly interface
- **Visual Feedback**: See what's happening in real-time
- **Clean Exit**: Close the window to stop everything
- **Self-Contained**: All automation built-in

## 🆘 Need Help?

1. Use the "Validate Setup" button to check your configuration
2. Check the console output for detailed error messages
3. Ensure all required scripts are in the same directory
4. Make sure you have proper permissions to run the scripts

---

**Enjoy your one-click Game Hub experience! 🎮**
