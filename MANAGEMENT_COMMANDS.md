# StockBot Management Commands

This document describes the available management scripts for controlling the StockBot application.

## Quick Start

Use the main management script for easy control:

```bash
./manage.sh [command]
```

## Available Commands

### 🚀 Starting the Application

#### Background Mode (Original)
```bash
./start.sh
# or
./manage.sh start
```
- Starts both backend and frontend in background
- Minimal console output
- Good for production-like usage

#### With Visible Logs
```bash
./start-with-logs.sh
# or
./manage.sh start-logs
```
- Starts both backend and frontend with real-time logs
- All log messages are prefixed with [BACKEND] or [FRONTEND]
- Perfect for development and debugging
- Press Ctrl+C to stop both servers

### 🛑 Stopping the Application

```bash
./shutdown.sh
# or
./manage.sh stop
```
- Gracefully stops all StockBot processes
- Kills backend (uvicorn), frontend (npm/react-scripts), and cloudflared tunnel
- Uses SIGTERM first, then SIGKILL if needed

### 🔄 Restarting the Application

```bash
./restart.sh
# or
./manage.sh restart
```
- Runs shutdown script followed by start script
- Ensures clean restart of all services

### 📊 Checking Status

```bash
./manage.sh status
```
- Shows which processes are currently running
- Displays process IDs (PIDs)
- Shows service URLs

### 📋 Viewing Logs

```bash
./manage.sh logs
```
- Shows information about log files
- Lists currently running processes

### ❓ Help

```bash
./manage.sh help
# or
./manage.sh
```
- Shows usage information and available commands

## Service URLs

When running, the services are available at:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs
- **Cloudflared Tunnel**: External URL (if running)

## Log Visibility

### Background Mode (`start.sh`)
- Minimal output to console
- Logs are handled by the individual services
- Good for production deployment

### Foreground Mode (`start-with-logs.sh`)
- Real-time log streaming to console
- All backend logs prefixed with `[BACKEND]`
- All frontend logs prefixed with `[FRONTEND]`
- Perfect for development and troubleshooting

### Example Log Output
```
[BACKEND] INFO:     Started server process [12345]
[BACKEND] INFO:     Waiting for application startup.
[BACKEND] INFO:     Application startup complete.
[BACKEND] INFO:     Uvicorn running on http://0.0.0.0:8000
[FRONTEND] webpack compiled with 1 warning
[FRONTEND] Local:            http://localhost:3000
[BACKEND] INFO:     127.0.0.1:52125 - "GET /api/portfolio/summary HTTP/1.1" 200 OK
[BACKEND] 2026-02-13 13:02:47,167 - app.services.stock_service - INFO - Successfully fetched AAPL price
```

## Process Management

The scripts handle the following processes:

1. **Backend**: Python uvicorn server running FastAPI
2. **Frontend**: Node.js development server (react-scripts)
3. **Cloudflared**: Tunnel service for external access (if running)

## Troubleshooting

### If processes don't stop properly:
```bash
# Force kill all related processes
pkill -f "uvicorn app.main:app"
pkill -f "react-scripts start"
pkill -f "cloudflared tunnel run stockbot"
```

### If ports are in use:
```bash
# Check what's using port 8000 (backend)
lsof -i :8000

# Check what's using port 3000 (frontend)
lsof -i :3000
```

### If you need to see what's running:
```bash
./manage.sh status
# or
ps aux | grep -E "(uvicorn|react-scripts|cloudflared)"
```

## Development Workflow

### For active development:
1. `./manage.sh start-logs` - Start with visible logs
2. Make your changes
3. Watch logs for errors/info
4. Ctrl+C to stop when done

### For testing/production:
1. `./manage.sh start` - Start in background
2. `./manage.sh status` - Check everything is running
3. `./manage.sh stop` - Stop when done

### For quick restarts:
1. `./manage.sh restart` - One command restart