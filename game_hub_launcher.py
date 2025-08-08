#!/usr/bin/env python3
"""
Game Hub Launcher - One-Click Start/Stop Solution
A simple GUI application that automatically handles the complete game hub startup process.
"""

import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import subprocess
import threading
import queue
import os
import sys
import signal
import platform
from pathlib import Path
import time
import json

class GameHubLauncher:
    def __init__(self, root):
        self.root = root
        self.root.title("🎮 Raspberry Pi Game Hub")
        self.root.geometry("800x600")
        self.root.resizable(True, True)
        
        # Application state
        self.is_running = False
        self.current_process = None
        self.output_queue = queue.Queue()
        self.script_dir = Path(__file__).parent.absolute()
        
        # Setup GUI
        self.setup_gui()
        
        # Start output processor
        self.process_output()
        
        # Handle window close
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
    def setup_gui(self):
        """Setup the main GUI components"""
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(2, weight=1)
        
        # Header
        header_frame = ttk.Frame(main_frame)
        header_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        header_frame.columnconfigure(1, weight=1)
        
        # Game hub icon/title
        title_label = tk.Label(header_frame, text="🎮 Raspberry Pi Game Hub", 
                              font=("Arial", 20, "bold"), fg="#2E8B57")
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 5))
        
        subtitle_label = tk.Label(header_frame, text="One-click launcher for your game server", 
                                 font=("Arial", 12), fg="#666666")
        subtitle_label.grid(row=1, column=0, columnspan=2, pady=(0, 10))
        
        # Status indicator
        self.status_label = tk.Label(header_frame, text="● Ready to start", 
                                    font=("Arial", 12, "bold"), fg="#666666")
        self.status_label.grid(row=2, column=0, sticky=tk.W)
        
        # Control buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))
        button_frame.columnconfigure(0, weight=1)
        button_frame.columnconfigure(1, weight=1)
        button_frame.columnconfigure(2, weight=1)
        
        self.start_button = tk.Button(button_frame, text="🚀 Start Game Hub", 
                                     command=self.start_game_hub, bg="#28a745", fg="white",
                                     font=("Arial", 12, "bold"), height=2, relief=tk.RAISED)
        self.start_button.grid(row=0, column=0, padx=(0, 5), sticky=(tk.W, tk.E))
        
        self.stop_button = tk.Button(button_frame, text="⏹️ Stop Game Hub", 
                                    command=self.stop_game_hub, bg="#dc3545", fg="white",
                                    font=("Arial", 12, "bold"), height=2, relief=tk.RAISED, state=tk.DISABLED)
        self.stop_button.grid(row=0, column=1, padx=5, sticky=(tk.W, tk.E))
        
        self.validate_button = tk.Button(button_frame, text="🔍 Validate Setup", 
                                        command=self.validate_setup, bg="#17a2b8", fg="white",
                                        font=("Arial", 12, "bold"), height=2, relief=tk.RAISED)
        self.validate_button.grid(row=0, column=2, padx=(5, 0), sticky=(tk.W, tk.E))
        
        # Progress bar
        self.progress_var = tk.StringVar()
        self.progress_var.set("Waiting to start...")
        
        progress_frame = ttk.Frame(main_frame)
        progress_frame.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(0, 5))
        progress_frame.columnconfigure(0, weight=1)
        
        progress_label = tk.Label(progress_frame, textvariable=self.progress_var, 
                                 font=("Arial", 10), fg="#555555")
        progress_label.grid(row=0, column=0, sticky=tk.W)
        
        self.progress_bar = ttk.Progressbar(progress_frame, mode='indeterminate')
        self.progress_bar.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(5, 0))
        
        # Output console
        console_frame = ttk.LabelFrame(main_frame, text="Console Output", padding="5")
        console_frame.grid(row=3, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(10, 0))
        console_frame.columnconfigure(0, weight=1)
        console_frame.rowconfigure(0, weight=1)
        
        self.output_text = scrolledtext.ScrolledText(console_frame, height=15, 
                                                    font=("Consolas", 9), bg="#1e1e1e", fg="#00ff00")
        self.output_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Connection info frame (initially hidden)
        self.info_frame = ttk.LabelFrame(main_frame, text="🌐 Connection Information", padding="10")
        
        # Initial message
        self.log_message("🎮 Game Hub Launcher initialized")
        self.log_message(f"📁 Working directory: {self.script_dir}")
        self.log_message("💡 Click 'Start Game Hub' to begin the automatic setup process")
        
    def log_message(self, message, level="INFO"):
        """Add a message to the console output"""
        timestamp = time.strftime("%H:%M:%S")
        colors = {
            "INFO": "#00ff00",
            "WARNING": "#ffff00", 
            "ERROR": "#ff0000",
            "SUCCESS": "#00ffff"
        }
        
        color = colors.get(level, "#00ff00")
        formatted_message = f"[{timestamp}] {message}\n"
        
        # Add to queue for thread-safe update
        self.output_queue.put(("log", formatted_message, color))
        
    def process_output(self):
        """Process output queue in main thread"""
        try:
            while True:
                action, data, *args = self.output_queue.get_nowait()
                
                if action == "log":
                    message, color = data, args[0]
                    self.output_text.configure(state=tk.NORMAL)
                    self.output_text.insert(tk.END, message)
                    self.output_text.configure(state=tk.DISABLED)
                    self.output_text.see(tk.END)
                    
                elif action == "status":
                    status_text, status_color = data, args[0]
                    self.status_label.configure(text=status_text, fg=status_color)
                    
                elif action == "progress":
                    progress_text = data
                    self.progress_var.set(progress_text)
                    
                elif action == "show_info":
                    self.show_connection_info(data)
                    
        except queue.Empty:
            pass
        
        # Schedule next check
        self.root.after(100, self.process_output)
        
    def start_game_hub(self):
        """Start the game hub in a separate thread"""
        if self.is_running:
            return
            
        self.is_running = True
        self.start_button.configure(state=tk.DISABLED)
        self.stop_button.configure(state=tk.NORMAL)
        self.validate_button.configure(state=tk.DISABLED)
        
        # Clear console
        self.output_text.configure(state=tk.NORMAL)
        self.output_text.delete(1.0, tk.END)
        self.output_text.configure(state=tk.DISABLED)
        
        # Start progress bar
        self.progress_bar.start()
        
        # Update status
        self.output_queue.put(("status", "● Starting...", "#ff8c00"))
        self.output_queue.put(("progress", "Initializing game hub startup..."))
        
        # Start in separate thread
        thread = threading.Thread(target=self._run_game_hub, daemon=True)
        thread.start()
        
    def _run_game_hub(self):
        """Run the game hub setup process (runs in background thread)"""
        try:
            master_script = self.script_dir / "master_setup.sh"
            
            if not master_script.exists():
                self.log_message(f"❌ Master setup script not found: {master_script}", "ERROR")
                self._reset_ui()
                return
                
            self.log_message("🚀 Starting Game Hub master setup process...", "INFO")
            self.log_message(f"📁 Script location: {master_script}", "INFO")
            self.output_queue.put(("progress", "Running master setup script..."))
            
            # Make script executable
            os.chmod(master_script, 0o755)
            
            # Also make other scripts executable
            required_scripts = ["download_dependencies.sh", "start_hotspot.sh", "start_game_hub.sh"]
            for script_name in required_scripts:
                script_path = self.script_dir / script_name
                if script_path.exists():
                    os.chmod(script_path, 0o755)
                    self.log_message(f"✅ Made executable: {script_name}", "INFO")
                else:
                    self.log_message(f"⚠️ Script not found: {script_name}", "WARNING")
            
            # Run the master setup script
            self.log_message(f"🔧 Executing command: /bin/bash {master_script}", "INFO")
            self.log_message(f"📂 Working directory: {self.script_dir}", "INFO")
            
            self.current_process = subprocess.Popen(
                ["/bin/bash", str(master_script)],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
                bufsize=1,
                cwd=self.script_dir,
                env=os.environ.copy()
            )
            
            # Check if process started successfully
            if self.current_process.poll() is not None:
                self.log_message(f"❌ Process failed to start, exit code: {self.current_process.poll()}", "ERROR")
                self._reset_ui()
                return
                
            self.log_message("✅ Process started successfully", "SUCCESS")
            
            # Update status
            self.output_queue.put(("status", "● Running", "#28a745"))
            
            # Stream output
            for line in iter(self.current_process.stdout.readline, ''):
                if not self.is_running:  # Check if we should stop
                    break
                    
                # Clean and format line
                clean_line = line.strip()
                if clean_line:
                    # Parse different types of output
                    if "ERROR" in clean_line.upper():
                        self.log_message(clean_line, "ERROR")
                    elif "WARNING" in clean_line.upper():
                        self.log_message(clean_line, "WARNING") 
                    elif "SUCCESS" in clean_line.upper() or "✅" in clean_line:
                        self.log_message(clean_line, "SUCCESS")
                    else:
                        self.log_message(clean_line, "INFO")
                        
                    # Update progress based on output
                    if "STEP 1" in clean_line:
                        self.output_queue.put(("progress", "Step 1/3: Downloading dependencies..."))
                    elif "STEP 2" in clean_line:
                        self.output_queue.put(("progress", "Step 2/3: Setting up WiFi hotspot..."))
                    elif "STEP 3" in clean_line:
                        self.output_queue.put(("progress", "Step 3/3: Starting game server..."))
                    elif "GAME HUB SETUP COMPLETE" in clean_line:
                        self.output_queue.put(("progress", "✅ Setup complete! Game hub is running..."))
                        self.output_queue.put(("status", "● Running", "#28a745"))
                        
                        # Show connection info
                        connection_info = self._extract_connection_info()
                        self.output_queue.put(("show_info", connection_info))
            
            # Wait for process to complete
            return_code = self.current_process.wait()
            
            if return_code == 0:
                self.log_message("✅ Game Hub started successfully!", "SUCCESS")
                self.output_queue.put(("status", "● Running", "#28a745"))
            else:
                self.log_message(f"❌ Game Hub setup failed with return code: {return_code}", "ERROR")
                self.output_queue.put(("status", "● Failed", "#dc3545"))
                self._reset_ui()
                
        except subprocess.SubprocessError as e:
            self.log_message(f"❌ Subprocess error: {str(e)}", "ERROR")
            self.output_queue.put(("status", "● Subprocess Error", "#dc3545"))
            self._reset_ui()
        except FileNotFoundError as e:
            self.log_message(f"❌ File not found: {str(e)}", "ERROR")
            self.log_message("💡 Make sure all scripts are in the correct directory", "WARNING")
            self.output_queue.put(("status", "● File Not Found", "#dc3545"))
            self._reset_ui()
        except PermissionError as e:
            self.log_message(f"❌ Permission error: {str(e)}", "ERROR")
            self.log_message("💡 Try running: chmod +x *.sh", "WARNING")
            self.output_queue.put(("status", "● Permission Error", "#dc3545"))
            self._reset_ui()
        except Exception as e:
            self.log_message(f"❌ Unexpected error: {str(e)}", "ERROR")
            self.log_message(f"🔍 Error type: {type(e).__name__}", "ERROR")
            import traceback
            self.log_message(f"📋 Traceback: {traceback.format_exc()}", "ERROR")
            self.output_queue.put(("status", "● Error", "#dc3545"))
            self._reset_ui()
            
    def stop_game_hub(self):
        """Stop the game hub"""
        if not self.is_running:
            return
            
        self.log_message("🛑 Stopping Game Hub...", "WARNING")
        self.output_queue.put(("progress", "Stopping game hub..."))
        
        try:
            if self.current_process and self.current_process.poll() is None:
                # Send SIGTERM first
                self.current_process.terminate()
                
                # Wait a bit for graceful shutdown
                try:
                    self.current_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    # Force kill if it doesn't stop gracefully
                    self.current_process.kill()
                    self.current_process.wait()
                    
            self.log_message("✅ Game Hub stopped", "SUCCESS")
            
        except Exception as e:
            self.log_message(f"❌ Error stopping Game Hub: {str(e)}", "ERROR")
            
        finally:
            self._reset_ui()
            
    def validate_setup(self):
        """Validate the setup without running it"""
        self.validate_button.configure(state=tk.DISABLED)
        self.log_message("🔍 Validating setup...", "INFO")
        
        def _validate():
            try:
                # Check for required scripts
                required_scripts = [
                    "master_setup.sh",
                    "download_dependencies.sh", 
                    "start_hotspot.sh",
                    "start_game_hub.sh"
                ]
                
                missing_scripts = []
                for script in required_scripts:
                    script_path = self.script_dir / script
                    if not script_path.exists():
                        missing_scripts.append(script)
                        self.log_message(f"❌ Missing: {script}", "ERROR")
                    else:
                        self.log_message(f"✅ Found: {script}", "SUCCESS")
                        
                # Check package.json
                package_json = self.script_dir / "package.json"
                if package_json.exists():
                    self.log_message("✅ Found: package.json", "SUCCESS")
                else:
                    self.log_message("❌ Missing: package.json", "ERROR")
                    missing_scripts.append("package.json")
                    
                # Check server.js
                server_js = self.script_dir / "server.js"
                if server_js.exists():
                    self.log_message("✅ Found: server.js", "SUCCESS")
                else:
                    self.log_message("❌ Missing: server.js", "ERROR")
                    missing_scripts.append("server.js")
                    
                if not missing_scripts:
                    self.log_message("🎉 All required files found! Setup is ready.", "SUCCESS")
                    self.log_message("✅ You can now click 'Start Game Hub'", "SUCCESS")
                else:
                    self.log_message(f"⚠️ Missing {len(missing_scripts)} required files", "WARNING")
                    self.log_message("📋 Missing files:", "ERROR")
                    for script in missing_scripts:
                        self.log_message(f"   • {script}", "ERROR")
                        
                # Check permissions
                self.log_message("🔍 Checking script permissions...", "INFO")
                for script in ["master_setup.sh", "download_dependencies.sh", "start_hotspot.sh", "start_game_hub.sh"]:
                    script_path = self.script_dir / script
                    if script_path.exists():
                        if os.access(script_path, os.X_OK):
                            self.log_message(f"✅ {script} is executable", "SUCCESS")
                        else:
                            self.log_message(f"⚠️ {script} is not executable", "WARNING")
                            
                # Check working directory
                self.log_message(f"📂 Working directory: {self.script_dir}", "INFO")
                self.log_message(f"📂 Directory exists: {self.script_dir.exists()}", "INFO")
                    
            except Exception as e:
                self.log_message(f"❌ Validation error: {str(e)}", "ERROR")
            finally:
                self.validate_button.configure(state=tk.NORMAL)
                
        thread = threading.Thread(target=_validate, daemon=True)
        thread.start()
        
    def _extract_connection_info(self):
        """Extract connection information for display"""
        # Default connection info
        return {
            "ssid": "GameHub-Direct",
            "password": "gamehub123", 
            "ip": "192.168.4.1",
            "port": "8000"
        }
        
    def show_connection_info(self, info):
        """Show connection information panel"""
        # Position the info frame
        self.info_frame.grid(row=4, column=0, sticky=(tk.W, tk.E), pady=(10, 0))
        
        # Clear existing content
        for widget in self.info_frame.winfo_children():
            widget.destroy()
            
        # Create info content
        tk.Label(self.info_frame, text="📡 WiFi Network:", font=("Arial", 10, "bold")).grid(row=0, column=0, sticky=tk.W, padx=(0, 10))
        tk.Label(self.info_frame, text=info["ssid"], font=("Arial", 10)).grid(row=0, column=1, sticky=tk.W)
        
        tk.Label(self.info_frame, text="🔑 Password:", font=("Arial", 10, "bold")).grid(row=1, column=0, sticky=tk.W, padx=(0, 10))
        tk.Label(self.info_frame, text=info["password"], font=("Arial", 10)).grid(row=1, column=1, sticky=tk.W)
        
        tk.Label(self.info_frame, text="🌐 Access URLs:", font=("Arial", 10, "bold")).grid(row=2, column=0, sticky=tk.W, columnspan=2, pady=(10, 5))
        
        urls = [
            f"Main Display: http://{info['ip']}:{info['port']}/",
            f"Mobile View: http://{info['ip']}:{info['port']}/mobile/",
            f"Admin Panel: http://{info['ip']}:{info['port']}/admin-panel/"
        ]
        
        for i, url in enumerate(urls):
            tk.Label(self.info_frame, text=url, font=("Arial", 9), fg="#0066cc").grid(row=3+i, column=0, sticky=tk.W, columnspan=2)
            
    def _reset_ui(self):
        """Reset UI to initial state"""
        self.is_running = False
        self.current_process = None
        
        self.start_button.configure(state=tk.NORMAL)
        self.stop_button.configure(state=tk.DISABLED)
        self.validate_button.configure(state=tk.NORMAL)
        
        self.progress_bar.stop()
        self.output_queue.put(("status", "● Ready", "#666666"))
        self.output_queue.put(("progress", "Ready to start..."))
        
        # Hide connection info
        self.info_frame.grid_remove()
        
    def on_closing(self):
        """Handle window closing"""
        if self.is_running:
            if messagebox.askokcancel("Quit", "Game Hub is running. Stop it before closing?"):
                self.stop_game_hub()
                # Give it a moment to stop
                self.root.after(1000, self.root.destroy)
            else:
                return
        else:
            self.root.destroy()

def main():
    """Main application entry point"""
    # Create the main window
    root = tk.Tk()
    
    # Set application icon (if available)
    try:
        # You can add an icon file here
        # root.iconbitmap("game_hub_icon.ico")
        pass
    except:
        pass
        
    # Create and run the application
    app = GameHubLauncher(root)
    
    try:
        root.mainloop()
    except KeyboardInterrupt:
        print("\nApplication interrupted by user")
        if app.is_running:
            app.stop_game_hub()

if __name__ == "__main__":
    main()