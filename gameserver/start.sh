#!/bin/bash
# ====================================
#  Vaste Game Server - Linux/Mac Launcher
# ====================================

echo ""
echo " ===================================="
echo "  VASTE GAME SERVER"
echo " ===================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install Node.js from https://nodejs.org/"
    echo ""
    exit 1
fi

# Display Node.js version
NODE_VERSION=$(node --version)
echo "[INFO] Node.js version: $NODE_VERSION"

# Check if npm dependencies are installed
if [ ! -d "vaste/node_modules" ]; then
    echo "[WARN] Dependencies not found!"
    echo "[INFO] Installing dependencies..."
    cd vaste
    npm install
    cd ..
    echo ""
fi

# Start the server
echo "[INFO] Starting Vaste Game Server..."
echo "[INFO] Press Ctrl+C to stop the server"
echo ""

cd vaste
node server.js

# If server crashes, show error code
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Server crashed with error code $?"
    echo ""
    exit 1
fi
