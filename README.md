# 🤖 StockBot - AI-Powered Trading Bot
# Credit to Drew Ratliff

An intelligent stock trading bot that uses OpenAI GPT-4 for predictive analytics and automated trading decisions with virtual money. Built with Python FastAPI backend and React TypeScript frontend.

## 🎯 Features

- **AI-Powered Trading**: Uses OpenAI GPT-4 for intelligent stock analysis and trading decisions
- **Virtual Money Trading**: Start with $20 virtual money for safe learning and testing
- **Real-time Portfolio Tracking**: Monitor your portfolio value, holdings, and performance
- **Configurable Parameters**: Adjust risk tolerance, daily trade limits, position sizing, and more
- **Comprehensive Dashboard**: Beautiful web interface with charts and analytics
- **Risk Management**: Built-in stop-loss, take-profit, and position size limits
- **Trading History**: Complete audit trail of all trades with AI reasoning
- **Market Data Integration**: Real-time stock data from Yahoo Finance API
- **Future-Ready**: Architecture prepared for real money trading integration

## 🏗️ Architecture

- **Backend**: Python FastAPI with SQLAlchemy ORM
- **Frontend**: React 18 with TypeScript and Material-UI
- **Database**: SQLite (development) / PostgreSQL (production)
- **AI**: OpenAI GPT-4 API for trading decisions
- **Stock Data**: Yahoo Finance API (yfinance)
- **Scheduling**: APScheduler for automated trading cycles

## 📋 Prerequisites

- Python 3.9 or higher
- Node.js 16 or higher
- OpenAI API key (required)
- Git
- Google Cloud Console account (for Google Auth)

## 🚀 Quick Start

### Option 1: Easy Startup (Recommended)

**For macOS/Linux:**
```bash
git clone <your-repo-url>
cd StockBot
./manage.sh start
```

**For Windows:**
```bash
git clone <your-repo-url>
cd StockBot
manage.bat start
```

The startup script will:
- ✅ Check all prerequisites (Python, Node.js)
- ✅ Set up virtual environments automatically
- ✅ Install all dependencies
- ✅ Create `.env` file from template
- ✅ Start both backend and frontend servers
- ✅ Open the correct URLs for you

### Option 2: Manual Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd StockBot
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env
```

### 3. Configure Environment Variables

**⚠️ SECURITY WARNING: Never commit your `.env` file to GitHub! Your API keys should remain private.**

Edit `backend/.env` with your settings:

```env
# Required - Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=your_openai_api_key_here

# Database
DATABASE_URL=sqlite:///./stockbot.db

# Security (change in production)
SECRET_KEY=your_secret_key_change_this_in_production

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

### 4. Frontend Setup

```bash
# Open new terminal and navigate to frontend
cd frontend

# Install dependencies
npm install

# Create environment file
echo "REACT_APP_API_BASE_URL=http://localhost:8000" > .env
echo "REACT_APP_ENVIRONMENT=development" >> .env
```

### 5. Start the Application

**Terminal 1 - Backend:**
```bash
cd backend
# Make sure virtual environment is activated
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

### 6. Access the Application

- **Frontend Dashboard**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## 🔑 Getting OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Sign up or log in to your account
3. Navigate to API Keys section
4. Create a new secret key
5. Copy the key and add it to your `.env` file
6. Add billing information and set usage limits

**Cost Estimation**: ~$5-15/month for moderate usage

## 🔐 Google Authentication Setup

To enable Google Sign-In for your application:

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project named `StockBot`
3. Enable "Google+ API" in "APIs & Services" -> "Library"
4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" -> "Credentials"
   - Create OAuth client ID -> Web application
   - Add authorized origins: `http://localhost:3000`
   - Add authorized redirect URIs: `http://localhost:3000`
   - Copy **Client ID** and **Client Secret**

### 2. Configure Environment Variables

**Backend (`backend/.env`):**
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

**Frontend (`frontend/.env`):**
```env
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
```

## 🛠️ Management Commands

Use the `manage.sh` script for easy control:

```bash
./manage.sh [command]
```

### Available Commands

- **start**: Start backend and frontend in background (production mode)
- **start-logs**: Start with visible logs (development mode)
- **stop**: Gracefully stop all services
- **restart**: Restart all services
- **status**: Check running processes
- **logs**: View log information

## 📊 Using the Application

### Dashboard
- View portfolio value and performance
- Monitor bot status and trading activity
- Start/stop the trading bot
- Quick access to all features

### Portfolio
- See current holdings and their performance
- Track cash balance and total returns
- Monitor individual stock positions

### Trading
- Analyze stocks using AI
- View trading history with AI reasoning
- Execute manual trades
- Monitor recent trading activity

### Configuration
- Adjust bot parameters (risk tolerance, daily limits)
- Set trading hours and position sizing
- Configure stop-loss and take-profit levels
- Enable/disable automated trading

## 🛡️ Safety Features

- **Virtual Money Only**: No real money at risk during learning
- **Position Limits**: Maximum 20% of portfolio per stock (configurable)
- **Daily Trade Limits**: Prevent overtrading (default: 5 trades/day)
- **Stop Loss**: Automatic sell at -10% loss (configurable)
- **Take Profit**: Automatic sell at +15% gain (configurable)
- **Cash Reserve**: Always maintain minimum cash balance
- **Market Hours**: Only trade during market hours
- **AI Validation**: All trades validated before execution

## 🔧 Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| Initial Balance | $20.00 | Starting virtual money |
| Max Daily Trades | 5 | Maximum trades per day |
| Max Position Size | 20% | Maximum % of portfolio per stock |
| Risk Tolerance | MEDIUM | LOW/MEDIUM/HIGH trading style |
| Stop Loss | -10% | Automatic sell trigger |
| Take Profit | +15% | Automatic sell trigger |
| Min Cash Reserve | $5.00 | Always keep available |
| Trading Hours | 9:30-16:00 EST | Active trading window |

## 📈 AI Trading Logic

The bot uses OpenAI GPT-4 to analyze:

1. **Current Stock Data**: Price, volume, market cap, P/E ratio
2. **Historical Trends**: Recent price movements and patterns
3. **Portfolio Context**: Current holdings and available cash
4. **Risk Assessment**: Position sizing and diversification
5. **Market Conditions**: Trading hours and market status

Each trade includes:
- **Action**: BUY/SELL/HOLD recommendation
- **Quantity**: Number of shares to trade
- **Confidence**: 1-10 scale rating
- **Reasoning**: Detailed explanation of the decision

## 🔄 Automated Trading

When the bot is active, it will:

1. **Monitor Market Hours**: Only trade during 9:30 AM - 4:00 PM EST
2. **Analyze Trending Stocks**: Focus on popular and liquid stocks
3. **Make Trading Decisions**: Use AI to evaluate opportunities
4. **Execute Trades**: Buy/sell based on AI recommendations
5. **Update Portfolio**: Track all positions and performance
6. **Log Activities**: Record all decisions and reasoning

## 📁 Project Structure

```
StockBot/
├── backend/
│   ├── app/
│   │   ├── models/          # Database models and schemas
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utility functions
│   │   ├── config.py        # Configuration settings
│   │   └── main.py          # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── .env.example         # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   └── App.tsx          # Main application
│   ├── package.json         # Node dependencies
│   └── .env                 # Environment variables
├── plans/                   # Architecture documentation
└── README.md               # This file
```

## ❓ Troubleshooting

### Common Issues

1. **"Module not found: Error: Can't resolve './App'"**
   - Run `npm install` in frontend directory
   - Clear npm cache: `npm cache clean --force`
   - Delete `node_modules` and reinstall

2. **TypeScript Errors**
   - Ensure `tsconfig.json` exists
   - Install types: `npm install --save-dev @types/react @types/react-dom @types/node`

3. **Backend Python Errors**
   - Ensure virtual environment is activated
   - Reinstall requirements: `pip install -r requirements.txt`
   - Check python version (3.9+)

4. **OpenAI API Key Issues**
   - Verify `.env` file exists in `backend/`
   - check API key format begins with `sk-...`

5. **Clashing Ports**
   - Check if port 8000 or 3000 is in use: `lsof -i :8000`
   - Kill process: `kill -9 <PID>`

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🚀 Production Deployment

### Backend (Railway/Heroku/DigitalOcean)
1. Set environment variables in your hosting platform
2. Change `DATABASE_URL` to PostgreSQL
3. Set `ENVIRONMENT=production`
4. Deploy using your platform's deployment method

### Frontend (Vercel/Netlify)
1. Build the frontend: `npm run build`
2. Deploy the `build` folder
3. Set `REACT_APP_API_BASE_URL` to your backend URL

## 🔮 Future Enhancements

- **Real Money Integration**: Connect to brokers like Alpaca, Interactive Brokers
- **Advanced Analytics**: More sophisticated trading indicators
- **Machine Learning**: Train custom models on historical data
- **Social Trading**: Share strategies and performance
- **Mobile App**: React Native mobile application
- **Backtesting**: Test strategies on historical data
- **Multi-Asset**: Support for crypto, forex, and options

## ⚠️ Disclaimers

- **Educational Purpose**: This bot is for learning and experimentation
- **No Financial Advice**: Not intended as investment advice
- **Virtual Money Only**: Start with virtual money before considering real money
- **Market Risks**: All trading involves risk of loss
- **API Costs**: OpenAI API usage incurs costs
- **No Guarantees**: Past performance doesn't guarantee future results

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

- **Documentation**: Check the `/plans` directory for detailed architecture
- **API Reference**: Visit http://localhost:8000/docs when running
- **Issues**: Create GitHub issues for bugs or feature requests
- **Discussions**: Use GitHub discussions for questions

---

**Happy Trading! 🚀📈**

Remember: This is a learning tool. Always understand the risks before trading with real money.
