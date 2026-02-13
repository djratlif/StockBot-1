#!/bin/bash

# StockBot Shutdown Script
# This script stops all StockBot processes

echo "🛑 Shutting down StockBot..."
echo "================================"

# Function to kill processes by name
kill_process() {
    local process_name=$1
    local pids=$(pgrep -f "$process_name")
    
    if [ -n "$pids" ]; then
        echo "🔍 Found $process_name processes: $pids"
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

# Kill cloudflared tunnel if running
echo "☁️  Stopping cloudflared tunnel..."
kill_process "cloudflared tunnel run stockbot"

# Kill any remaining node processes related to the project
echo "🧹 Cleaning up remaining processes..."
pkill -f "StockBot-1" 2>/dev/null || true

echo ""
echo "✅ StockBot shutdown complete!"
echo "================================"