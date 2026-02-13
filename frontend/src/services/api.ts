import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface Portfolio {
  id: number;
  cash_balance: number;
  total_value: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioSummary {
  cash_balance: number;
  total_value: number;
  total_invested: number;
  total_return: number;
  return_percentage: number;
  holdings_count: number;
}

export interface Holding {
  id: number;
  symbol: string;
  quantity: number;
  average_cost: number;
  current_price: number;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total_amount: number;
  ai_reasoning: string | null;
  executed_at: string;
}

export interface BotConfig {
  id: number;
  max_daily_trades: number;
  max_position_size: number;
  risk_tolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  trading_hours_start: string;
  trading_hours_end: string;
  is_active: boolean;
  stop_loss_percentage: number;
  take_profit_percentage: number;
  min_cash_reserve: number;
  updated_at: string;
}

export interface BotStatus {
  is_active: boolean;
  is_trading_hours: boolean;
  trades_today: number;
  max_daily_trades: number;
  cash_available: number;
  portfolio_value: number;
  last_trade_time: string | null;
}

export interface StockInfo {
  symbol: string;
  current_price: number;
  change_percent: number;
  volume: number;
  market_cap: number | null;
  pe_ratio: number | null;
  week_52_high: number | null;
  week_52_low: number | null;
}

export interface TradingStats {
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_profit_loss: number;
  average_trade_return: number;
  best_trade: number | null;
  worst_trade: number | null;
}

export interface APIResponse {
  success: boolean;
  message: string;
  data?: any;
}

// Portfolio API
export const portfolioAPI = {
  getPortfolio: (): Promise<Portfolio> =>
    api.get('/api/portfolio/').then(res => res.data),
  
  getPortfolioSummary: (): Promise<PortfolioSummary> =>
    api.get('/api/portfolio/summary').then(res => res.data),
  
  getHoldings: (): Promise<Holding[]> =>
    api.get('/api/portfolio/holdings').then(res => res.data),
  
  getTradingStats: (): Promise<TradingStats> =>
    api.get('/api/portfolio/stats').then(res => res.data),
  
  initializePortfolio: (): Promise<APIResponse> =>
    api.post('/api/portfolio/initialize').then(res => res.data),
};

// Stocks API
export const stocksAPI = {
  getStockInfo: (symbol: string): Promise<StockInfo> =>
    api.get(`/api/stocks/${symbol}`).then(res => res.data),
  
  getStockPrice: (symbol: string): Promise<{ symbol: string; price: number; timestamp: string }> =>
    api.get(`/api/stocks/${symbol}/price`).then(res => res.data),
  
  getStockHistory: (symbol: string, period: string = '1mo'): Promise<any> =>
    api.get(`/api/stocks/${symbol}/history?period=${period}`).then(res => res.data),
  
  getTrendingStocks: (): Promise<{ trending_symbols: string[]; stocks_info: StockInfo[] }> =>
    api.get('/api/stocks/market/trending').then(res => res.data),
  
  getMarketStatus: (): Promise<any> =>
    api.get('/api/stocks/market/status').then(res => res.data),
  
  validateSymbol: (symbol: string): Promise<APIResponse> =>
    api.post(`/api/stocks/validate/${symbol}`).then(res => res.data),
};

// Bot API
export const botAPI = {
  getBotConfig: (): Promise<BotConfig> =>
    api.get('/api/bot/config').then(res => res.data),
  
  updateBotConfig: (config: Partial<BotConfig>): Promise<BotConfig> =>
    api.put('/api/bot/config', config).then(res => res.data),
  
  getBotStatus: (): Promise<BotStatus> =>
    api.get('/api/bot/status').then(res => res.data),
  
  startBot: (): Promise<APIResponse> =>
    api.post('/api/bot/start').then(res => res.data),
  
  stopBot: (): Promise<APIResponse> =>
    api.post('/api/bot/stop').then(res => res.data),
  
  analyzeStock: (symbol: string): Promise<APIResponse> =>
    api.post(`/api/bot/analyze/${symbol}`).then(res => res.data),
  
  executeAITrade: (symbol: string): Promise<APIResponse> =>
    api.post(`/api/bot/execute-trade/${symbol}`).then(res => res.data),
  
  getMarketSentiment: (): Promise<APIResponse> =>
    api.get('/api/bot/market-sentiment').then(res => res.data),
};

// Trades API
export const tradesAPI = {
  getTradingHistory: (limit: number = 50, offset: number = 0): Promise<Trade[]> =>
    api.get(`/api/trades/?limit=${limit}&offset=${offset}`).then(res => res.data),
  
  getTodaysTrades: (): Promise<Trade[]> =>
    api.get('/api/trades/today').then(res => res.data),
  
  getTodaysTradeCount: (): Promise<{ trades_today: number; date: string }> =>
    api.get('/api/trades/count/today').then(res => res.data),
  
  getTradesBySymbol: (symbol: string, limit: number = 50): Promise<Trade[]> =>
    api.get(`/api/trades/by-symbol/${symbol}?limit=${limit}`).then(res => res.data),
  
  getTradeById: (tradeId: number): Promise<Trade> =>
    api.get(`/api/trades/${tradeId}`).then(res => res.data),
  
  getTradeSummary: (): Promise<TradingStats> =>
    api.get('/api/trades/stats/summary').then(res => res.data),
  
  getDailyPerformance: (): Promise<any> =>
    api.get('/api/trades/performance/daily').then(res => res.data),
};

// Logs API
export const logsAPI = {
  getActivityLogs: (limit: number = 20, hours: number = 24): Promise<any> =>
    api.get(`/api/logs/activity?limit=${limit}&hours=${hours}`).then(res => res.data),
  
  addActivityLog: (level: string, message: string, symbol?: string, trade_id?: number): Promise<APIResponse> =>
    api.post('/api/logs/activity', { level, message, symbol, trade_id }).then(res => res.data),
  
  clearActivityLogs: (days: number = 7): Promise<APIResponse> =>
    api.delete(`/api/logs/activity?days=${days}`).then(res => res.data),
  
  getDebugInfo: (limit: number = 50): Promise<any> =>
    api.get(`/api/logs/debug?limit=${limit}`).then(res => res.data),
  
  getSystemStatus: (): Promise<any> =>
    api.get('/api/logs/system-status').then(res => res.data),
};

// Error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default api;