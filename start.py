# start.py
# A simple Python script to automate the build and run process for Neon Asteroids.
# 1. Runs the 'npm run build-mutators' command.
# 2. Starts a local HTTP server on port 8000.
# 3. Opens a web browser to the game's main page.

import subprocess
import http.server
import socketserver
import webbrowser
import threading
import time
import os

# --- Configuration ---
PORT = 8000
HOST = "localhost"
URL = f"http://{HOST}:{PORT}/"
NPM_COMMAND = "npm"
BUILD_SCRIPT_NAME = "build-mutators"

def run_build_script():
    """Runs the npm build command and checks for errors."""
    print("--- Running Mutator Build Script ---")
    try:
        # Use shell=True for compatibility, especially on Windows
        result = subprocess.run([NPM_COMMAND, "run", BUILD_SCRIPT_NAME], check=True, shell=True)
        print("--- Build successful! ---")
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n--- ERROR: Build script failed with exit code {e.returncode} ---")
        print("Please fix the build errors before trying again.")
        return False
    except FileNotFoundError:
        print(f"\n--- ERROR: Command '{NPM_COMMAND}' not found. ---")
        print("Please make sure Node.js and npm are installed and in your system's PATH.")
        return False

def start_server():
    """Starts the HTTP server in a separate thread."""
    # The TCPServer can sometimes hold onto the port for a short time after closing.
    # allow_reuse_address=True helps prevent "address already in use" errors on quick restarts.
    socketserver.TCPServer.allow_reuse_address = True
    
    handler = http.server.SimpleHTTPRequestHandler
    httpd = socketserver.TCPServer((HOST, PORT), handler)
    
    # Start the server in a daemon thread.
    # This means the thread will automatically close when the main script exits.
    server_thread = threading.Thread(target=httpd.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    print(f"\n--- Server is running at {URL} ---")
    print("--- Press Ctrl+C to stop the server. ---")
    
def open_browser():
    """Waits a moment for the server to be ready, then opens the browser."""
    print("--- Opening web browser... ---")
    try:
        webbrowser.open(URL)
    except Exception as e:
        print(f"Could not automatically open browser: {e}")
        print(f"Please manually navigate to {URL}")

if __name__ == "__main__":
    # Change the working directory to the script's location
    # This ensures the server serves files from the correct project root
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    if run_build_script():
        start_server()
        # Wait a fraction of a second for the server to initialize before opening the browser
        time.sleep(0.5)
        open_browser()
        
        # Keep the main script alive to listen for Ctrl+C
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n--- Server stopped. Goodbye! ---")