#!/bin/bash

# StockBot Startup Script with Visible Logs
# This script starts both backend and frontend servers with logs visible in the terminal

echo "🤖 Starting StockBot with visible logs..."
echo "================================"

# Check if we're in the right directory
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ Error: Please run this script from the StockBot root directory"
    exit 1
fi

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

cd ..

# Create log directory
mkdir -p logs

# Start servers with logging
echo ""
echo "🚀 Starting servers with visible logs..."
echo "Backend will start on: http://localhost:8000"
echo "Frontend will start on: http://localhost:3000"
echo ""
echo "📋 Logs will be displayed below. Press Ctrl+C to stop both servers"
echo "================================"

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start backend with logging
echo "🐍 Starting backend server..."
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level info 2>&1 | while IFS= read -r line; do
    echo "[BACKEND] $line"
done &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 3

# Start frontend with logging
echo "⚛️  Starting frontend server..."
cd frontend
BROWSER=none npm start 2>&1 | while IFS= read -r line; do
    echo "[FRONTEND] $line"
done &
FRONTEND_PID=$!
cd ..

echo ""
echo "✅ Both servers are starting up..."
echo "🌐 Frontend: http://localhost:3000"
echo "🔗 Backend API: http://localhost:8000"
echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "💡 Tip: You can also run 'cloudflared tunnel run stockbot' in another terminal for external access"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID