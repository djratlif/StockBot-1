@echo off
REM StockBot Startup Script for Windows
REM This script starts both backend and frontend servers

echo 🤖 Starting StockBot...
echo ================================

REM Check if we're in the right directory
if not exist "backend" (
    echo ❌ Error: Please run this script from the StockBot root directory
    pause
    exit /b 1
)
if not exist "frontend" (
    echo ❌ Error: Please run this script from the StockBot root directory
    pause
    exit /b 1
)

REM Check prerequisites
echo 🔍 Checking prerequisites...

python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.9 or higher.
    pause
    exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 16 or higher.
    pause
    exit /b 1
)

npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed. Please install npm.
    pause
    exit /b 1
)

echo ✅ Prerequisites check passed

REM Setup backend
echo.
echo 🐍 Setting up backend...
cd backend

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

REM Check if .env exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found. Copying from .env.example...
    copy .env.example .env
    echo 📝 Please edit backend\.env and add your OpenAI API key!
    echo    OPENAI_API_KEY=your_key_here
)

cd ..

REM Setup frontend
echo.
echo ⚛️  Setting up frontend...
cd frontend

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing Node.js dependencies...
    npm install
)

cd ..

REM Start servers
echo.
echo 🚀 Starting servers...
echo Backend will start on: http://localhost:8000
echo Frontend will start on: http://localhost:3000
echo.
echo Press Ctrl+C to stop both servers
echo ================================

REM Start backend in new window
echo Starting backend server...
start "StockBot Backend" cmd /k "cd backend && venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in new window
echo Starting frontend server...
start "StockBot Frontend" cmd /k "cd frontend && npm start"

echo.
echo ✅ Both servers are starting in separate windows
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend API: http://localhost:8000
echo 📚 API Docs: http://localhost:8000/docs
echo.
echo Close the terminal windows to stop the servers
pause