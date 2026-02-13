#!/bin/bash

# StockBot Management Script
# Simple interface for managing StockBot services

echo "🤖 StockBot Management"
echo "======================"

# Function to show usage
show_usage() {
    echo "Usage: ./manage.sh [command]"
    echo ""
    echo "Available commands:"
    echo "  start         - Start StockBot (background mode)"
    echo "  start-logs    - Start StockBot with visible logs"
    echo "  stop          - Stop all StockBot processes"
    echo "  restart       - Restart StockBot"
    echo "  status        - Show running processes"
    echo "  logs          - Show recent logs"
    echo "  help          - Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./manage.sh start"
    echo "  ./manage.sh start-logs"
    echo "  ./manage.sh stop"
    echo "  ./manage.sh restart"
}

# Function to show status
show_status() {
    echo "📊 StockBot Process Status:"
    echo "=========================="
    
    # Check backend
    backend_pid=$(pgrep -f "uvicorn app.main:app")
    if [ -n "$backend_pid" ]; then
        echo "🐍 Backend: ✅ Running (PID: $backend_pid)"
        echo "   URL: http://localhost:8000"
    else
        echo "🐍 Backend: ❌ Not running"
    fi
    
    # Check frontend
    frontend_pid=$(pgrep -f "react-scripts start")
    if [ -n "$frontend_pid" ]; then
        echo "⚛️  Frontend: ✅ Running (PID: $frontend_pid)"
        echo "   URL: http://localhost:3000"
    else
        echo "⚛️  Frontend: ❌ Not running"
    fi
    
    # Check cloudflared
    tunnel_pid=$(pgrep -f "cloudflared tunnel run stockbot")
    if [ -n "$tunnel_pid" ]; then
        echo "☁️  Cloudflared: ✅ Running (PID: $tunnel_pid)"
    else
        echo "☁️  Cloudflared: ❌ Not running"
    fi
}

# Function to show logs
show_logs() {
    echo "📋 Recent StockBot Logs:"
    echo "======================="
    
    if [ -d "logs" ]; then
        echo "📁 Log files found:"
        ls -la logs/ 2>/dev/null || echo "No log files found"
    else
        echo "📁 No logs directory found"
    fi
    
    echo ""
    echo "🔍 Current running processes:"
    ps aux | grep -E "(uvicorn|react-scripts|cloudflared)" | grep -v grep || echo "No StockBot processes found"
}

# Main script logic
case "${1:-help}" in
    "start")
        echo "🚀 Starting StockBot in background mode..."
        ./start.sh
        ;;
    "start-logs")
        echo "🚀 Starting StockBot with visible logs..."
        ./start-with-logs.sh
        ;;
    "stop")
        echo "🛑 Stopping StockBot..."
        ./shutdown.sh
        ;;
    "restart")
        echo "🔄 Restarting StockBot..."
        ./restart.sh
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "help"|"-h"|"--help")
        show_usage
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo ""
        show_usage
        exit 1
        ;;
esac