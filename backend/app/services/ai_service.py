from openai import OpenAI
from typing import Dict, List, Optional
import logging
import json
import re
from datetime import datetime
from app.config import settings
from app.models.schemas import TradingDecision, StockInfo, TradeActionEnum, RiskToleranceEnum
from app.services.stock_service import stock_service

logger = logging.getLogger(__name__)

class AITradingService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.openai_api_key)
        self.model = "gpt-4"
        
    async def analyze_stock_for_trading(self,
                                symbol: str,
                                portfolio_cash: float,
                                current_holdings: Dict,
                                portfolio_value: float,
                                risk_tolerance: RiskToleranceEnum,
                                max_position_size: float,
                                db_session=None) -> Optional[TradingDecision]:
        """
        Analyze a stock and make a trading decision using AI
        """
        try:
            # Get current stock information
            stock_info = await stock_service.get_stock_info(symbol, db_session)
            if not stock_info:
                logger.error(f"Could not fetch stock info for {symbol}")
                
                # Log to database for debug page
                if db_session:
                    try:
                        from app.models.models import TradingLog
                        error_log = TradingLog(
                            level="ERROR",
                            message=f"AI analysis failed: Could not fetch stock info for {symbol}",
                            symbol=symbol,
                            trade_id=None
                        )
                        db_session.add(error_log)
                        db_session.commit()
                    except Exception as db_error:
                        logger.error(f"Failed to log AI error to database: {db_error}")
                
                return None
            
            # Get historical data for context
            historical_data = await stock_service.get_historical_data(symbol, period="1mo")
            if historical_data is None:
                logger.error(f"Could not fetch historical data for {symbol}")
                return None
            
            # Calculate available cash for this position
            max_investment = portfolio_value * max_position_size
            available_cash = min(portfolio_cash, max_investment)
            
            # Build the prompt for AI analysis
            prompt = self._build_analysis_prompt(
                stock_info=stock_info,
                portfolio_cash=portfolio_cash,
                current_holdings=current_holdings,
                portfolio_value=portfolio_value,
                risk_tolerance=risk_tolerance,
                max_position_size=max_position_size,
                available_cash=available_cash,
                historical_data=historical_data
            )
            
            # Get AI recommendation
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are an expert stock trader with deep knowledge of market analysis, technical indicators, and risk management."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.3  # Lower temperature for more consistent analysis
            )
            
            ai_response = response.choices[0].message.content
            
            # Parse the AI response
            logger.info(f"AI Response for {symbol}: {ai_response[:200]}...")  # Log first 200 chars
            decision = self._parse_ai_response(ai_response, stock_info, available_cash)
            
            if decision:
                logger.info(f"AI Decision for {symbol}: {decision.action} {decision.quantity} shares (Confidence: {decision.confidence}/10)")
            else:
                logger.warning(f"No valid trading decision parsed for {symbol} from AI response")
            
            return decision
            
        except Exception as e:
            logger.error(f"Error in AI analysis for {symbol}: {str(e)}")
            return None
    
    def _build_analysis_prompt(self, 
                             stock_info: StockInfo,
                             portfolio_cash: float,
                             current_holdings: Dict,
                             portfolio_value: float,
                             risk_tolerance: RiskToleranceEnum,
                             max_position_size: float,
                             available_cash: float,
                             historical_data) -> str:
        """Build the prompt for AI analysis"""
        
        # Calculate some basic technical indicators from Alpha Vantage data format
        try:
            # Alpha Vantage returns data as dict with dates as keys
            # Convert to lists for analysis
            dates = sorted(historical_data.keys())[-10:]  # Last 10 days
            recent_prices = [float(historical_data[date]['4. close']) for date in dates]
            recent_volumes = [int(historical_data[date]['5. volume']) for date in dates]
            volume_avg = sum(recent_volumes) / len(recent_volumes) if recent_volumes else 0
            price_trend = "UPWARD" if recent_prices[-1] > recent_prices[0] else "DOWNWARD"
        except Exception as e:
            logger.warning(f"Error processing historical data for {stock_info.symbol}: {e}")
            # Fallback values
            recent_prices = [stock_info.current_price]
            volume_avg = stock_info.volume or 0
            price_trend = "NEUTRAL"
        
        current_position = current_holdings.get(stock_info.symbol, {})
        current_shares = current_position.get('quantity', 0)
        current_avg_cost = current_position.get('average_cost', 0)
        
        prompt = f"""
Analyze {stock_info.symbol} for a trading decision. You are managing a portfolio with virtual money for learning purposes.

CURRENT PORTFOLIO STATUS:
- Total Portfolio Value: ${portfolio_value:.2f}
- Available Cash: ${portfolio_cash:.2f}
- Risk Tolerance: {risk_tolerance.value}
- Max Position Size: {max_position_size*100:.1f}% of portfolio
- Available for this trade: ${available_cash:.2f}

CURRENT POSITION IN {stock_info.symbol}:
- Shares Owned: {current_shares}
- Average Cost: ${current_avg_cost:.2f}
- Current Value: ${current_shares * stock_info.current_price:.2f}

STOCK ANALYSIS FOR {stock_info.symbol}:
- Current Price: ${stock_info.current_price:.2f}
- Daily Change: {stock_info.change_percent:.2f}%
- Volume: {"{:,}".format(stock_info.volume) if stock_info.volume else "N/A"}
- Average Volume (10-day): {volume_avg:,.0f}
- Market Cap: {"${:,}".format(stock_info.market_cap) if stock_info.market_cap else "N/A"}
- P/E Ratio: {"{:.2f}".format(stock_info.pe_ratio) if stock_info.pe_ratio else "N/A"}
- 52-Week High: {"${:.2f}".format(stock_info.week_52_high) if stock_info.week_52_high else "N/A"}
- 52-Week Low: {"${:.2f}".format(stock_info.week_52_low) if stock_info.week_52_low else "N/A"}
- Recent Price Trend: {price_trend}

TRADING CONSTRAINTS:
- This is virtual money for learning - take reasonable risks
- Maximum investment in this stock: ${available_cash:.2f}
- Consider portfolio diversification
- Factor in the risk tolerance level

DECISION REQUIRED:
Based on this analysis, should I BUY, SELL, or HOLD {stock_info.symbol}?

If BUY: Calculate how many shares to buy with available cash
If SELL: Consider selling all or partial position
If HOLD: No action needed

Provide your response in this EXACT format:
ACTION: [BUY/SELL/HOLD]
QUANTITY: [number of shares, 0 for HOLD]
CONFIDENCE: [1-10 scale]
REASONING: [2-3 sentences explaining your decision]

Consider:
1. Technical analysis (price trends, volume)
2. Risk management (position sizing, diversification)
3. Market conditions and volatility
4. The educational nature of this virtual trading
"""
        
        return prompt
    
    def _parse_ai_response(self, response: str, stock_info: StockInfo, available_cash: float) -> Optional[TradingDecision]:
        """Parse the AI response into a TradingDecision object"""
        try:
            logger.info(f"Parsing AI response for {stock_info.symbol}:")
            logger.info(f"Full AI Response: {response}")
            
            # Extract action
            action_match = re.search(r'ACTION:\s*(BUY|SELL|HOLD)', response, re.IGNORECASE)
            if not action_match:
                logger.error(f"Could not parse ACTION from AI response for {stock_info.symbol}")
                logger.error(f"Looking for pattern 'ACTION: BUY/SELL/HOLD' in: {response[:500]}...")
                return None
            
            action = action_match.group(1).upper()
            logger.info(f"Parsed ACTION: {action}")
            
            if action == "HOLD":
                logger.info(f"AI recommends HOLD for {stock_info.symbol} - no trading decision needed")
                return None  # No trading decision needed
            
            # Extract quantity
            quantity_match = re.search(r'QUANTITY:\s*(\d+)', response)
            if not quantity_match:
                logger.error(f"Could not parse QUANTITY from AI response for {stock_info.symbol}")
                logger.error(f"Looking for pattern 'QUANTITY: [number]' in: {response[:500]}...")
                return None
            
            quantity = int(quantity_match.group(1))
            logger.info(f"Parsed QUANTITY: {quantity}")
            
            if quantity <= 0:
                logger.warning(f"Invalid quantity {quantity} for {stock_info.symbol}")
                return None
            
            # Extract confidence
            confidence_match = re.search(r'CONFIDENCE:\s*(\d+)', response)
            confidence = int(confidence_match.group(1)) if confidence_match else 5
            confidence = max(1, min(10, confidence))  # Ensure it's between 1-10
            logger.info(f"Parsed CONFIDENCE: {confidence}")
            
            # Extract reasoning
            reasoning_match = re.search(r'REASONING:\s*(.+?)(?:\n|$)', response, re.DOTALL)
            reasoning = reasoning_match.group(1).strip() if reasoning_match else "AI analysis completed"
            logger.info(f"Parsed REASONING: {reasoning[:100]}...")
            
            # Validate the decision
            if action == "BUY":
                max_shares = int(available_cash / stock_info.current_price)
                if quantity > max_shares:
                    original_quantity = quantity
                    quantity = max_shares
                    reasoning += f" (Adjusted quantity from {original_quantity} to {quantity} shares based on available cash)"
                    logger.info(f"Adjusted BUY quantity from {original_quantity} to {quantity} for {stock_info.symbol}")
            
            if quantity <= 0:
                logger.warning(f"Final quantity is 0 or negative for {stock_info.symbol}")
                return None
            
            decision = TradingDecision(
                action=TradeActionEnum(action),
                symbol=stock_info.symbol,
                quantity=quantity,
                confidence=confidence,
                reasoning=reasoning,
                current_price=stock_info.current_price
            )
            
            logger.info(f"Successfully created trading decision for {stock_info.symbol}: {action} {quantity} shares (confidence: {confidence})")
            return decision
            
        except Exception as e:
            logger.error(f"Error parsing AI response for {stock_info.symbol}: {str(e)}")
            logger.error(f"Full AI Response was: {response}")
            return None
    
    def get_market_sentiment(self, symbols: List[str]) -> Dict[str, str]:
        """Get overall market sentiment for a list of symbols"""
        try:
            if not symbols:
                return {}
            
            # Build a prompt for market sentiment analysis
            symbols_str = ", ".join(symbols)
            prompt = f"""
Analyze the current market sentiment for these stocks: {symbols_str}

For each stock, provide a brief sentiment analysis (BULLISH, BEARISH, or NEUTRAL) based on:
1. Recent price movements
2. Market conditions
3. General market trends

Format your response as:
SYMBOL: SENTIMENT - Brief reason

Keep each analysis to one line.
"""
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a market analyst providing quick sentiment analysis."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.5
            )
            
            # Parse the response
            sentiment_data = {}
            lines = response.choices[0].message.content.split('\n')
            
            for line in lines:
                if ':' in line:
                    parts = line.split(':', 1)
                    if len(parts) == 2:
                        symbol = parts[0].strip()
                        sentiment = parts[1].strip()
                        sentiment_data[symbol] = sentiment
            
            return sentiment_data
            
        except Exception as e:
            logger.error(f"Error getting market sentiment: {str(e)}")
            return {}
    
    def validate_trading_decision(self, decision: TradingDecision, 
                                portfolio_cash: float, 
                                current_holdings: Dict) -> bool:
        """Validate if a trading decision is feasible"""
        try:
            if decision.action == TradeActionEnum.BUY:
                required_cash = decision.quantity * decision.current_price
                return required_cash <= portfolio_cash
            
            elif decision.action == TradeActionEnum.SELL:
                current_position = current_holdings.get(decision.symbol, {})
                current_shares = current_position.get('quantity', 0)
                return decision.quantity <= current_shares
            
            return True
            
        except Exception as e:
            logger.error(f"Error validating trading decision: {str(e)}")
            return False

# Global instance
ai_service = AITradingService()