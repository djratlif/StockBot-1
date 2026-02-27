from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class TradeActionEnum(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

class RiskToleranceEnum(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class AllocationTypeEnum(str, Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED_AMOUNT = "FIXED_AMOUNT"

# User Authentication Schemas
class UserBase(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None

class UserCreate(UserBase):
    google_id: str

class UserResponse(UserBase):
    id: int
    google_id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class GoogleTokenData(BaseModel):
    token: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Portfolio Schemas
class PortfolioBase(BaseModel):
    cash_balance: float
    total_value: float

class PortfolioResponse(PortfolioBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Holdings Schemas
class HoldingBase(BaseModel):
    symbol: str = Field(..., max_length=10)
    quantity: int
    average_cost: float
    current_price: float
    ai_provider: Optional[str] = "OPENAI"

class HoldingResponse(HoldingBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Trade Schemas
class TradeBase(BaseModel):
    symbol: str = Field(..., max_length=10)
    action: TradeActionEnum
    quantity: int
    price: float
    total_amount: float
    ai_reasoning: Optional[str] = None
    ai_provider: Optional[str] = "OPENAI"

class TradeCreate(BaseModel):
    symbol: str = Field(..., max_length=10)
    action: TradeActionEnum
    quantity: int
    ai_provider: Optional[str] = "OPENAI"

class TradeResponse(TradeBase):
    id: int
    executed_at: datetime
    
    class Config:
        from_attributes = True

class StrategyProfileEnum(str, Enum):
    BALANCED = "BALANCED"
    AGGRESSIVE_DAY_TRADER = "AGGRESSIVE_DAY_TRADER"
    CONSERVATIVE_VALUE = "CONSERVATIVE_VALUE"
    MOMENTUM_SCALPER = "MOMENTUM_SCALPER"

# Bot Configuration Schemas
class BotConfigBase(BaseModel):
    max_daily_trades: int = Field(default=5, ge=1, le=50)
    max_position_size: float = Field(default=0.20, ge=0.01, le=1.0)
    
    openai_api_key: Optional[str] = None
    openai_active: bool = True
    openai_allocation: float = Field(default=1000.0, ge=0.0)
    
    gemini_api_key: Optional[str] = None
    gemini_active: bool = False
    gemini_allocation: float = Field(default=0.0, ge=0.0)
    
    anthropic_api_key: Optional[str] = None
    anthropic_active: bool = False
    anthropic_allocation: float = Field(default=0.0, ge=0.0)
    
    risk_tolerance: RiskToleranceEnum = RiskToleranceEnum.MEDIUM
    strategy_profile: StrategyProfileEnum = StrategyProfileEnum.BALANCED
    trading_hours_start: str = Field(default="09:30", pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    trading_hours_end: str = Field(default="16:00", pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    is_active: bool = False
    stop_loss_percentage: float = Field(default=-0.10, ge=-1.0, le=0.0)
    take_profit_percentage: float = Field(default=0.15, ge=0.0, le=5.0)
    min_cash_reserve: float = Field(default=5.00, ge=0.0)
    portfolio_allocation: float = Field(default=1.0, ge=0.01, le=1.0)
    portfolio_allocation_type: AllocationTypeEnum = AllocationTypeEnum.PERCENTAGE
    portfolio_allocation_amount: float = Field(default=2000.0, ge=0.0)

class BotConfigUpdate(BaseModel):
    max_daily_trades: Optional[int] = Field(None, ge=1, le=50)
    max_position_size: Optional[float] = Field(None, ge=0.01, le=1.0)
    
    openai_api_key: Optional[str] = None
    openai_active: Optional[bool] = None
    openai_allocation: Optional[float] = Field(None, ge=0.0)
    
    gemini_api_key: Optional[str] = None
    gemini_active: Optional[bool] = None
    gemini_allocation: Optional[float] = Field(None, ge=0.0)
    
    anthropic_api_key: Optional[str] = None
    anthropic_active: Optional[bool] = None
    anthropic_allocation: Optional[float] = Field(None, ge=0.0)
    
    risk_tolerance: Optional[RiskToleranceEnum] = None
    strategy_profile: Optional[StrategyProfileEnum] = None
    trading_hours_start: Optional[str] = Field(None, pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    trading_hours_end: Optional[str] = Field(None, pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$")
    is_active: Optional[bool] = None
    stop_loss_percentage: Optional[float] = Field(None, ge=-1.0, le=0.0)
    take_profit_percentage: Optional[float] = Field(None, ge=0.0, le=5.0)
    min_cash_reserve: Optional[float] = Field(None, ge=0.0)
    portfolio_allocation: Optional[float] = Field(None, ge=0.01, le=1.0)
    portfolio_allocation_type: Optional[AllocationTypeEnum] = None
    portfolio_allocation_amount: Optional[float] = Field(None, ge=0.0)

class BotConfigResponse(BotConfigBase):
    id: int
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Market Data Schemas
class MarketDataBase(BaseModel):
    symbol: str = Field(..., max_length=10)
    price: float
    volume: Optional[int] = None
    change_percent: Optional[float] = None

class MarketDataResponse(MarketDataBase):
    id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True

# Stock Info Schema
class StockInfo(BaseModel):
    symbol: str
    current_price: float
    change_percent: float
    volume: int
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    week_52_high: Optional[float] = None
    week_52_low: Optional[float] = None

# Trading Decision Schema
class TradingDecision(BaseModel):
    action: TradeActionEnum
    symbol: str
    quantity: int
    confidence: int = Field(..., ge=1, le=10)
    reasoning: str
    current_price: float
    ai_provider: Optional[str] = "OPENAI"

# Portfolio Summary Schema
class PortfolioSummary(BaseModel):
    cash_balance: float
    total_value: float
    holdings_value: float
    total_invested: float
    total_return: float
    return_percentage: float
    holdings_count: int
    daily_change: Optional[float] = 0.0
    daily_change_percent: Optional[float] = 0.0

# Trading Statistics Schema
class TradingStats(BaseModel):
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    total_profit_loss: float
    average_trade_return: float
    best_trade: Optional[float] = None
    worst_trade: Optional[float] = None
    best_open_position: Optional[float] = None
    worst_open_position: Optional[float] = None
    best_open_symbol: Optional[str] = None
    worst_open_symbol: Optional[str] = None

# API Response Schemas
class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    details: Optional[str] = None

# Bot Status Schema
class BotStatus(BaseModel):
    is_active: bool
    is_trading_hours: bool
    trades_today: int
    trades_bought_today: Optional[int] = 0
    trades_sold_today: Optional[int] = 0
    max_daily_trades: int
    cash_available: float
    portfolio_value: float
    last_trade_time: Optional[datetime] = None
    continuous_trading: Optional[bool] = False
    trading_interval_minutes: Optional[int] = 5
    is_analyzing: Optional[bool] = False
    is_fetching: Optional[bool] = False

# Trading Interval Configuration Schema
class TradingIntervalConfig(BaseModel):
    interval_minutes: int = Field(..., ge=1, le=60, description="Trading interval in minutes (1-60)")