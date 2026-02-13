#!/bin/bash

# StockBot Restart Script
# This script stops and then starts all StockBot services

echo "🔄 Restarting StockBot..."
echo "================================"

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the StockBot root directory"
    exit 1
fi

# Make sure shutdown script is executable
chmod +x shutdown.sh

# Run shutdown script
echo "🛑 Shutting down existing processes..."
./shutdown.sh

# Wait a moment for processes to fully stop
echo "⏳ Waiting for processes to stop..."
sleep 3

# Make sure start script is executable
chmod +x start.sh

# Run start script
echo ""
echo "🚀 Starting StockBot..."
./start.sh