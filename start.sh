#!/bin/bash

# StockBot Startup Script for macOS/Linux
# This script starts both backend and frontend servers

echo "🤖 Starting StockBot..."
echo "================================"

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the StockBot root directory"
    exit 1
fi

# Check for production flag
# Check for flags
USE_PROD=false
DEPLOY_MODE=false

for arg in "$@"; do
    if [ "$arg" == "--prod" ]; then
        USE_PROD=true
    fi
    if [ "$arg" == "--deploy" ]; then
        DEPLOY_MODE=true
        USE_PROD=true # Deploy implies prod
    fi
done

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command_exists python3; then
    echo "❌ Python 3 is not installed. Please install Python 3.9 or higher."
    exit 1
fi

if ! command_exists node; then
    echo "❌ Node.js is not installed. Please install Node.js 16 or higher."
    exit 1
fi

if ! command_exists npm; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

if ! command_exists cloudflared; then
    echo "⚠️  cloudflared is not installed. Cloudflare tunnel will not start."
    HAS_CLOUDFLARED=false
else
    HAS_CLOUDFLARED=true
fi

echo "✅ Prerequisites check passed"

# Setup backend
echo ""
echo "🐍 Setting up backend..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit backend/.env and add your OpenAI API key!"
    echo "   OPENAI_API_KEY=your_key_here"
fi

cd ..

# Setup frontend
echo ""
echo "⚛️  Setting up frontend..."
cd frontend

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Build for production if deploying
if [ "$DEPLOY_MODE" = true ]; then
    echo "🏗️  Building frontend for deployment..."
    npm run build
fi

cd ..

# Start servers
echo ""
echo "🚀 Starting servers..."
echo "Backend will start on: http://localhost:8000"
echo "Frontend will start on: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "================================"

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    
    # Kill background jobs
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        # The reloader spawns child processes, so we need to kill the whole group or children
        # First try killing children of the backend PID (the reloader)
        pkill -P $BACKEND_PID 2>/dev/null
        kill $BACKEND_PID 2>/dev/null
    fi
    
    if [ -n "$FRONTEND_PID" ]; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    if [ -n "$CLOUDFLARED_PID" ]; then
        echo "Stopping cloudflared (PID: $CLOUDFLARED_PID)..."
        kill $CLOUDFLARED_PID 2>/dev/null
    fi
    # Also ensure any other cloudflared processes are killed (like shutdown.sh does)
    pkill -f "cloudflared" 2>/dev/null
    
    # Fallback: Kill by port to ensure nothing is left holding the port
    echo "Ensuring ports are freed..."
    lsof -ti:8000 | xargs kill -9 2>/dev/null
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start backend in background
echo "Starting backend server..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend in background
# BROWSER=none prevents npm start from opening the browser automatically
echo "Starting frontend server..."
cd frontend
# Check for production build
# Check for production build
if [ "$USE_PROD" = true ]; then
    if [ ! -d "build" ]; then
        echo "⚠️  --prod flag used but no build found. Building now..."
        npm run build
    fi
    echo "📦 Serving production build..."
    npx serve -s build -l 3000 &
else
    echo "👨‍💻 Starting development server..."
    BROWSER=none npm start &
fi
FRONTEND_PID=$!
cd ..

# Start cloudflared tunnel
# Start cloudflared tunnel ONLY if deploy mode is active
if [ "$HAS_CLOUDFLARED" = true ] && [ "$DEPLOY_MODE" = true ]; then
    echo "☁️  Starting cloudflared tunnel..."
    # Log output to file for debugging
    cloudflared tunnel run stockbot > cloudflared.log 2>&1 &
    CLOUDFLARED_PID=$!
    echo "   Tunnel started with PID: $CLOUDFLARED_PID"
    echo "   Logs are being written to: cloudflared.log"
    
    # Wait a bit for backend/tunnel to be ready then open URL
    (
        sleep 5
        # Check if tunnel is still running
        if kill -0 $CLOUDFLARED_PID 2>/dev/null; then
             echo "✅ Tunnel is running. Opening https://stockbot.drew-ratliff.com"
             open "https://stockbot.drew-ratliff.com"
        else
             echo "❌ Tunnel failed to start. Check cloudflared.log for details."
             open "http://localhost:3000"
        fi
    ) &
else
    # Fallback to localhost if no tunnel or not deploying
    echo "✅ Application started locally."
    (sleep 5 && open "http://localhost:3000") &
fi

# Wait for all processes
wait