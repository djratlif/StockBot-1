# API Keys Setup Guide

## Required API Keys

### 1. OpenAI API Key (Required)

The StockBot uses OpenAI's GPT models for AI-powered trading decisions and market analysis.

#### How to Get OpenAI API Key:

1. **Create OpenAI Account**
   - Go to [https://platform.openai.com](https://platform.openai.com)
   - Sign up for an account or log in if you already have one

2. **Navigate to API Keys**
   - Click on your profile in the top-right corner
   - Select "View API keys" or go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)

3. **Create New API Key**
   - Click "Create new secret key"
   - Give it a descriptive name like "StockBot Trading"
   - Copy the key immediately (you won't be able to see it again)

4. **Add Billing Information**
   - Go to [https://platform.openai.com/account/billing](https://platform.openai.com/account/billing)
   - Add a payment method
   - Set up usage limits to control costs (recommended: $10-20/month for testing)

#### Cost Estimation:
- GPT-4 API calls: ~$0.03 per 1K tokens
- Expected daily usage: 10-50 API calls
- Estimated monthly cost: $5-15 for moderate usage

### 2. Alpha Vantage API Key (Recommended)

The StockBot now uses Alpha Vantage as the primary stock data source with smart caching to avoid rate limits. Yahoo Finance is used as a fallback.

#### How to Get Alpha Vantage API Key:

1. **Create Alpha Vantage Account**
   - Go to [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
   - Click "Get your free API key today"
   - Fill out the form with your information

2. **Get Your API Key**
   - After registration, you'll receive your API key immediately
   - Copy the key (it looks like: `ABCD1234EFGH5678`)

3. **Free Tier Limits**
   - **25 API calls per day** (resets at midnight EST)
   - **12 second delay** between calls (automatically handled by our caching system)
   - Perfect for testing and light usage

4. **Paid Tier Options** (if you need more calls)
   - **120 calls/minute**: $49.99/month
   - **360 calls/minute**: $149.99/month
   - **600 calls/minute**: $249.99/month
   - **1200 calls/minute**: $499.99/month

#### Why Alpha Vantage?
- **Reliable**: No rate limiting issues like Yahoo Finance
- **Comprehensive**: Real-time and historical data
- **Smart Caching**: Our implementation caches data to minimize API calls
- **Fallback Support**: Yahoo Finance used when Alpha Vantage is unavailable

### 3. Other Stock Data APIs (Alternative Options)

#### Yahoo Finance (Free - Fallback)
- **Current Status**: Used as fallback when Alpha Vantage is unavailable
- **Issues**: Rate limiting, potential blocking
- **Advantage**: Completely free

#### Polygon.io (Alternative)
- **Free Tier**: 5 API calls per minute
- **Paid Plans**: Starting at $29/month
- **Setup**: [https://polygon.io/](https://polygon.io/)

## Environment Variables Setup

### Backend (.env file)

Create a `.env` file in the backend directory with the following variables:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Recommended - Stock Data API (Primary)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here

# Optional - Alternative Stock Data APIs
POLYGON_API_KEY=your_polygon_key_here

# Database
DATABASE_URL=sqlite:///./stockbot.db

# Security
SECRET_KEY=your_secret_key_for_jwt_tokens

# Bot Configuration
INITIAL_BALANCE=20.00
DEFAULT_MAX_DAILY_TRADES=5
DEFAULT_RISK_TOLERANCE=MEDIUM

# Trading Hours (EST)
TRADING_START_HOUR=9
TRADING_START_MINUTE=30
TRADING_END_HOUR=16
TRADING_END_MINUTE=0
```

### Frontend (.env file)

Create a `.env` file in the frontend directory:

```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_ENVIRONMENT=development
```

## Security Best Practices

### 1. Environment Variables
- Never commit `.env` files to version control
- Add `.env` to your `.gitignore` file
- Use different keys for development and production

### 2. API Key Protection
- Store keys in environment variables only
- Use key rotation regularly (monthly recommended)
- Monitor API usage for unusual activity
- Set up usage alerts and limits

### 3. Production Deployment
- Use secure secret management (AWS Secrets Manager, Azure Key Vault, etc.)
- Enable HTTPS for all API communications
- Implement rate limiting to prevent abuse
- Use API key restrictions when available

## Testing Your Setup

### 1. OpenAI API Test
```python
import openai
import os

openai.api_key = os.getenv("OPENAI_API_KEY")

try:
    response = openai.ChatCompletion.create(
        model="gpt-4",
        messages=[{"role": "user", "content": "Hello, this is a test."}],
        max_tokens=10
    )
    print("OpenAI API: ✅ Working")
except Exception as e:
    print(f"OpenAI API: ❌ Error - {e}")
```

### 2. Alpha Vantage API Test
```python
import requests
import os

api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
if not api_key:
    print("Alpha Vantage API: ⚠️  API key not set, using demo key")
    api_key = "demo"

try:
    url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey={api_key}"
    response = requests.get(url)
    data = response.json()
    
    if "Global Quote" in data:
        price = data["Global Quote"]["05. price"]
        print(f"Alpha Vantage API: ✅ Working - AAPL price: ${price}")
    elif "Note" in data:
        print("Alpha Vantage API: ⚠️  Rate limit reached")
    else:
        print(f"Alpha Vantage API: ❌ Error - {data}")
except Exception as e:
    print(f"Alpha Vantage API: ❌ Error - {e}")
```

### 3. Yahoo Finance Test (Fallback)
```python
import yfinance as yf

try:
    stock = yf.Ticker("AAPL")
    info = stock.info
    print(f"Yahoo Finance: ✅ Working - AAPL price: ${info.get('currentPrice', 'N/A')}")
except Exception as e:
    print(f"Yahoo Finance: ❌ Error - {e}")
```

## Troubleshooting

### Common Issues

1. **OpenAI API Key Invalid**
   - Verify the key is copied correctly (no extra spaces)
   - Check if billing is set up on your OpenAI account
   - Ensure you have sufficient credits

2. **Alpha Vantage Rate Limiting**
   - Free tier: 25 calls per day (resets at midnight EST)
   - Our system automatically handles the 12-second delay between calls
   - Check the Debug page to see your daily usage
   - Consider upgrading to paid tier if you need more calls

3. **Alpha Vantage API Issues**
   - Verify the API key is copied correctly
   - Check if you've exceeded your daily limit (25 calls)
   - The system will automatically fall back to Yahoo Finance if Alpha Vantage fails

4. **Yahoo Finance Blocking (Fallback)**
   - This is why we implemented Alpha Vantage as primary
   - Yahoo Finance is used only when Alpha Vantage is unavailable
   - Rate limiting and blocking are common with Yahoo Finance

### Environment Setup Verification

Run this script to verify all your environment variables are set correctly:

```python
import os

required_vars = [
    "OPENAI_API_KEY",
    "DATABASE_URL",
    "SECRET_KEY",
    "INITIAL_BALANCE"
]

optional_vars = [
    "ALPHA_VANTAGE_API_KEY",
    "POLYGON_API_KEY"
]

print("=== Required Environment Variables ===")
for var in required_vars:
    value = os.getenv(var)
    if value:
        print(f"✅ {var}: Set (length: {len(value)})")
    else:
        print(f"❌ {var}: Not set")

print("\n=== Optional Environment Variables ===")
for var in optional_vars:
    value = os.getenv(var)
    if value:
        print(f"✅ {var}: Set (length: {len(value)})")
    else:
        print(f"⚠️  {var}: Not set (using free alternatives)")
```

## Next Steps

1. **Set up your OpenAI API key first** (required for AI functionality)
2. **Get your free Alpha Vantage API key** (recommended for reliable stock data)
3. **Test both API connections** using the provided test scripts
4. **Monitor your API usage** through the Debug page in the web interface
5. **Consider upgrading Alpha Vantage** if you need more than 25 calls per day
6. **Monitor your costs** regularly, especially OpenAI usage

## Support

If you encounter issues:
- Check the troubleshooting section above
- Verify your environment variables are set correctly
- Test API connections individually
- Review API documentation for any changes
- Check your account billing and usage limits