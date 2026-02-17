#!/bin/bash

# StockBot Shutdown Script
# This script stops all StockBot processes

echo "🛑 Shutting down StockBot..."
echo "================================"

# Function to kill processes by name
kill_process() {
    local process_name=$1
    local pids=$(pgrep -f "$process_name")
    
    # First try SIGTERM
    if [ -n "$pids" ]; then
        echo "🔍 Found $process_name processes: $pids"
        # Try to kill children first (important for uvicorn reloader)
        for pid in $pids; do
            pkill -P $pid 2>/dev/null
        done
        
        echo "$pids" | xargs kill -TERM 2>/dev/null
        sleep 2
        
        # Force kill if still running
        local remaining_pids=$(pgrep -f "$process_name")
        if [ -n "$remaining_pids" ]; then
            echo "⚡ Force killing remaining $process_name processes: $remaining_pids"
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null
        fi
        echo "✅ Stopped $process_name"
    else
        echo "ℹ️  No $process_name processes found"
    fi
}

# Kill backend processes
echo "🐍 Stopping backend server..."
kill_process "uvicorn app.main:app"

# Kill frontend processes
echo "⚛️  Stopping frontend server..."
kill_process "npm start"
kill_process "react-scripts start"
kill_process "serve"

# Kill cloudflared tunnel if running
echo "☁️  Stopping cloudflared tunnel..."
kill_process "cloudflared"

# Kill any remaining node processes related to the project
echo "🧹 Cleaning up remaining processes..."
pkill -f "StockBot-1" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true

# Final safety check - kill by port
echo "🔌 Ensuring ports are released..."
lsof -ti:8000 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null

echo ""
echo "✅ StockBot shutdown complete!"
echo "================================"