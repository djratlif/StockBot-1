# StockBot Troubleshooting Guide

## Common Issues and Solutions

### Frontend Issues

#### Error: "Module not found: Error: Can't resolve './App'"

This error typically occurs when dependencies haven't been installed or there are TypeScript configuration issues.

**Solution:**

1. **Install Dependencies First:**
   ```bash
   cd frontend
   npm install
   ```

2. **Clear npm cache if needed:**
   ```bash
   npm cache clean --force
   ```

3. **Delete node_modules and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

4. **Restart the development server:**
   ```bash
   npm start
   ```

#### TypeScript Errors

If you see TypeScript compilation errors, try:

1. **Check tsconfig.json exists** (should be created automatically)
2. **Install missing type definitions:**
   ```bash
   npm install --save-dev @types/react @types/react-dom @types/node
   ```

#### Module Resolution Issues

If imports are not resolving:

1. **Restart your IDE/editor**
2. **Clear TypeScript cache:**
   ```bash
   npx tsc --build --clean
   ```

### Backend Issues

#### Python Virtual Environment

Make sure you're using the virtual environment:

```bash
cd backend

# Create virtual environment if not exists
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### OpenAI API Key Issues

1. **Check .env file exists:**
   ```bash
   ls backend/.env
   ```

2. **Verify API key format:**
   ```env
   OPENAI_API_KEY=sk-...your-key-here
   ```

3. **Test API key:**
   ```python
   import openai
   import os
   from dotenv import load_dotenv
   
   load_dotenv()
   openai.api_key = os.getenv("OPENAI_API_KEY")
   
   # Test connection
   response = openai.ChatCompletion.create(
       model="gpt-4",
       messages=[{"role": "user", "content": "Hello"}],
       max_tokens=5
   )
   print("API key works!")
   ```

#### Database Issues

If you get database errors:

1. **Delete existing database:**
   ```bash
   rm backend/stockbot.db
   ```

2. **Restart the backend** - it will recreate the database automatically

#### Port Already in Use

If port 8000 is busy:

```bash
# Find process using port 8000
lsof -i :8000

# Kill the process (replace PID with actual process ID)
kill -9 PID

# Or use a different port
uvicorn app.main:app --reload --port 8001
```

### Installation Issues

#### Node.js Version

Make sure you have Node.js 16 or higher:
```bash
node --version
npm --version
```

#### Python Version

Make sure you have Python 3.9 or higher:
```bash
python --version
# or
python3 --version
```

### Step-by-Step Fresh Installation

If you're having multiple issues, try a complete fresh installation:

1. **Clone/Download the project**
2. **Backend Setup:**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   pip install -r requirements.txt
   cp .env.example .env
   # Edit .env with your OpenAI API key
   ```

3. **Frontend Setup:**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Start Backend:**
   ```bash
   cd ../backend
   source venv/bin/activate  # if not already activated
   uvicorn app.main:app --reload
   ```

5. **Start Frontend (new terminal):**
   ```bash
   cd frontend
   npm start
   ```

### Verification Steps

1. **Backend running:** Visit http://localhost:8000/docs
2. **Frontend running:** Visit http://localhost:3000
3. **API connection:** Check browser console for errors

### Getting Help

If you're still having issues:

1. **Check the browser console** for JavaScript errors
2. **Check the terminal** for Python errors
3. **Verify all environment variables** are set correctly
4. **Make sure both servers are running** on different ports
5. **Check firewall/antivirus** isn't blocking the ports

### Development Tips

- **Use two terminals:** One for backend, one for frontend
- **Check logs regularly:** Both browser console and terminal output
- **Restart servers** after making configuration changes
- **Clear browser cache** if you see old/cached content