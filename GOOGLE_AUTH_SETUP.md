# Google Authentication Setup Guide

This guide will help you set up Google OAuth authentication for your StockBot application.

## Prerequisites

- Google Cloud Console account
- StockBot application running locally

## Step 1: Google Cloud Console Setup

### 1.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `StockBot` (or your preferred name)
4. Click "Create"

### 1.2 Enable Google+ API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google+ API" 
3. Click on it and press "Enable"

### 1.3 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in required fields:
     - App name: `StockBot`
     - User support email: Your email
     - Developer contact information: Your email
   - Add scopes: `email`, `profile`, `openid`
   - Add test users (your email address)

4. Create OAuth client ID:
   - Application type: "Web application"
   - Name: `StockBot Web Client`
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `http://127.0.0.1:3000`
   - Authorized redirect URIs:
     - `http://localhost:3000`
     - `http://127.0.0.1:3000`

5. Copy the **Client ID** and **Client Secret**

## Step 2: Configure Environment Variables

### 2.1 Backend Configuration

Edit `backend/.env` file:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Google OAuth (Required for authentication)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# Database
DATABASE_URL=sqlite:///./stockbot.db

# Security
SECRET_KEY=your_secret_key_for_jwt_tokens_change_this_in_production

# Bot Configuration
INITIAL_BALANCE=20.00
DEFAULT_MAX_DAILY_TRADES=5
DEFAULT_RISK_TOLERANCE=MEDIUM

# Trading Hours (EST)
TRADING_START_HOUR=9
TRADING_START_MINUTE=30
TRADING_END_HOUR=16
TRADING_END_MINUTE=0

# Environment
ENVIRONMENT=development
DEBUG=true
```

### 2.2 Frontend Configuration

Edit `frontend/.env` file:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_ENVIRONMENT=development
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id_here
```

**Important:** Use the same Google Client ID in both backend and frontend.

## Step 3: Start the Application

### 3.1 Start Backend

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3.2 Start Frontend

```bash
cd frontend
npm start
```

## Step 4: Test Authentication

1. Open your browser to `http://localhost:3000`
2. You should see the Google Sign-In screen
3. Click "Sign in with Google"
4. Complete the Google OAuth flow
5. You should be redirected to the StockBot dashboard

## Step 5: Verify Authentication

### 5.1 Check API Endpoints

You can test the authentication endpoints:

- **Login**: `POST http://localhost:8000/api/auth/google`
- **User Info**: `GET http://localhost:8000/api/auth/me`
- **Verify Token**: `GET http://localhost:8000/api/auth/verify`

### 5.2 Check Database

After successful login, check that user data was created:

```bash
cd backend
sqlite3 stockbot.db
.tables
SELECT * FROM users;
SELECT * FROM portfolio;
SELECT * FROM bot_config;
```

## Troubleshooting

### Common Issues

1. **"Invalid Google token" error**
   - Verify Google Client ID matches in both frontend and backend
   - Check that OAuth consent screen is properly configured
   - Ensure test users are added if using external user type

2. **CORS errors**
   - Verify `allowed_origins` in backend config includes frontend URL
   - Check that both frontend and backend are running on correct ports

3. **"Google Sign-In not properly configured" error**
   - Verify `REACT_APP_GOOGLE_CLIENT_ID` is set in frontend `.env`
   - Check browser console for JavaScript errors

4. **Database errors**
   - Ensure SQLite database file has write permissions
   - Check that all database tables are created properly

### Debug Steps

1. Check browser developer console for errors
2. Check backend logs for authentication errors
3. Verify environment variables are loaded correctly
4. Test API endpoints directly with tools like Postman

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique secret keys in production
- Consider using PostgreSQL for production deployments
- Implement rate limiting for authentication endpoints
- Use HTTPS in production

## Production Deployment

For production deployment:

1. Update authorized origins in Google Cloud Console
2. Use environment variables instead of `.env` files
3. Use a production database (PostgreSQL recommended)
4. Enable HTTPS
5. Set `ENVIRONMENT=production` and `DEBUG=false`

## API Documentation

Once running, visit `http://localhost:8000/docs` for interactive API documentation.

---

**Next Steps:**
- Configure your Google Cloud Console project
- Set up environment variables
- Test the authentication flow
- Start building your trading bot features!