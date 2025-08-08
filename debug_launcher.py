#!/usr/bin/env python3
"""
Debug version of Game Hub Launcher
This version provides extra verbose output to help diagnose issues
"""

import subprocess
import os
from pathlib import Path

def main():
    print("🔍 DEBUG MODE: Game Hub Launcher")
    print("="*50)
    
    # Get current directory
    script_dir = Path(__file__).parent.absolute()
    print(f"📁 Working directory: {script_dir}")
    print(f"📁 Directory exists: {script_dir.exists()}")
    
    # Check Python version
    import sys
    print(f"🐍 Python version: {sys.version}")
    
    # Check required files
    required_files = [
        "master_setup.sh",
        "download_dependencies.sh", 
        "start_hotspot.sh",
        "start_game_hub.sh",
        "package.json",
        "server.js"
    ]
    
    print("\n🔍 Checking required files:")
    missing_files = []
    for file_name in required_files:
        file_path = script_dir / file_name
        exists = file_path.exists()
        executable = os.access(file_path, os.X_OK) if exists else False
        
        status = "✅" if exists else "❌"
        exec_status = "🔧" if executable else "🔒" if exists else "❌"
        
        print(f"   {status} {file_name} (executable: {exec_status})")
        
        if not exists:
            missing_files.append(file_name)
    
    if missing_files:
        print(f"\n❌ Missing files: {missing_files}")
        return
    
    # Try to run master_setup.sh validate
    print("\n🧪 Testing master_setup.sh execution:")
    master_script = script_dir / "master_setup.sh"
    
    try:
        print(f"🔧 Command: bash {master_script} validate")
        print(f"📂 Working dir: {script_dir}")
        
        result = subprocess.run(
            ["bash", str(master_script), "validate"],
            cwd=script_dir,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        print(f"🔄 Return code: {result.returncode}")
        print(f"📤 STDOUT:\n{result.stdout}")
        if result.stderr:
            print(f"📤 STDERR:\n{result.stderr}")
            
        if result.returncode == 0:
            print("✅ Script validation successful!")
        else:
            print("❌ Script validation failed!")
            
    except subprocess.TimeoutExpired:
        print("⏰ Script execution timed out")
    except Exception as e:
        print(f"❌ Error executing script: {e}")
        import traceback
        print(f"📋 Traceback:\n{traceback.format_exc()}")
    
    # Test tkinter
    print("\n🖥️ Testing GUI components:")
    try:
        import tkinter as tk
        print("✅ tkinter import successful")
        
        # Try to create a simple window (but don't show it)
        root = tk.Tk()
        root.withdraw()  # Hide the window
        print("✅ tkinter window creation successful")
        root.destroy()
        
    except Exception as e:
        print(f"❌ tkinter error: {e}")
    
    print("\n" + "="*50)
    print("🔍 Debug complete!")
    print("\nIf all checks passed, the launcher should work.")
    print("If you see errors above, that's what needs to be fixed.")

if __name__ == "__main__":
    main()