import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Slider,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  PlayArrow,
  Stop,
  AccountBalance,
  ShowChart,
  Warning,
} from '@mui/icons-material';
import { portfolioAPI, botAPI, tradesAPI } from '../services/api';
import type { PortfolioSummary, BotStatus, TradingStats, BotConfig } from '../services/api';
import ActivityFeed from '../components/ActivityFeed';
import AnimatedPrice from '../components/AnimatedPrice';

const Dashboard: React.FC = () => {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [tradingStats, setTradingStats] = useState<TradingStats | null>(null);
  const [botConfig, setBotConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchDashboardData = async (showLoader = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      setError(null);

      const [portfolio, bot, stats, configData] = await Promise.all([
        portfolioAPI.getPortfolioSummary().catch(() => null),
        botAPI.getBotStatus().catch(() => null),
        tradesAPI.getTradeSummary().catch(() => null),
        botAPI.getBotConfig().catch(() => null),
      ]);

      setPortfolioSummary(portfolio);
      setBotStatus(bot);
      setTradingStats(stats);
      setBotConfig(configData);
      setLastUpdated(new Date());

      if (showLoader) {
        setLoading(false);
      }
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const handleBotToggle = async () => {
    if (!botStatus || toggling) return;

    setToggling(true);
    try {
      if (botStatus.is_active) {
        await botAPI.stopBot();
      } else {
        await botAPI.startBot();
      }
      // Refresh bot status
      const updatedStatus = await botAPI.getBotStatus();
      setBotStatus(updatedStatus);
    } catch (err) {
      setError('Failed to toggle bot status');
      console.error('Bot toggle error:', err);
    } finally {
      setToggling(false);
    }
  };

  useEffect(() => {
    // Initial fetch shows full-page loader
    fetchDashboardData(true);
    // Refresh data every 15 seconds silently
    const interval = setInterval(() => fetchDashboardData(false), 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>


      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Portfolio Summary */}
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <AccountBalance sx={{ mr: 1, color: '#ffffff' }} />
                <Typography variant="h6" sx={{ color: '#ffffff' }}>Portfolio Value</Typography>
              </Box>
              <AnimatedPrice
                value={portfolioSummary?.total_value || 0}
                prefix="$"
                typographyVariant="h4"
                color="#ffffff"
              />
              <Box display="flex" flexDirection="column" mt={1}>
                <Box display="flex" alignItems="center">
                  <Typography variant="body2" sx={{ color: '#ffffff', mr: 1 }}>
                    Cash:
                  </Typography>
                  <AnimatedPrice
                    value={portfolioSummary?.cash_balance || 0}
                    prefix="$"
                    typographyVariant="body2"
                    color="#ffffff"
                  />
                </Box>
                <Box display="flex" alignItems="center">
                  <Typography variant="body2" sx={{ color: '#ffffff', mr: 1 }}>
                    Holdings:
                  </Typography>
                  <AnimatedPrice
                    value={(portfolioSummary?.total_value || 0) - (portfolioSummary?.cash_balance || 0)}
                    prefix="$"
                    typographyVariant="body2"
                    color="#ffffff"
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Total Return */}
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                {(portfolioSummary?.total_return || 0) >= 0 ? (
                  <TrendingUp color="success" sx={{ mr: 1 }} />
                ) : (
                  <TrendingDown color="error" sx={{ mr: 1 }} />
                )}
                <Typography variant="h6" sx={{ color: '#ffffff' }}>Total Return</Typography>
              </Box>
              <AnimatedPrice
                value={portfolioSummary?.total_return || 0}
                prefix="$"
                typographyVariant="h4"
                color={(portfolioSummary?.total_return || 0) >= 0 ? '#4caf50' : '#f44336'}
              />
              <Box display="flex" alignItems="center" mt={1}>
                <Typography variant="body2" color={(portfolioSummary?.daily_change || 0) >= 0 ? 'success.main' : 'error.main'} sx={{ mr: 1 }}>
                  Daily: 
                </Typography>
                <AnimatedPrice
                  value={portfolioSummary?.daily_change || 0}
                  prefix={(portfolioSummary?.daily_change || 0) >= 0 ? '+$' : '-$'}
                  typographyVariant="body2"
                  color={(portfolioSummary?.daily_change || 0) >= 0 ? '#4caf50' : '#f44336'}
                />
                <Typography variant="body2" color={(portfolioSummary?.daily_change || 0) >= 0 ? 'success.main' : 'error.main'} sx={{ ml: 1 }}>
                  ({(portfolioSummary?.daily_change_percent || 0).toFixed(2)}%)
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#ffffff', mt: 0.5 }}>
                Total: {portfolioSummary?.return_percentage.toFixed(2) || '0.00'}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Bot Status */}
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Bot Status</Typography>
                <Chip
                  label={
                    botStatus?.is_analyzing ? 'Analyzing' :
                    botStatus?.is_active ? 'Active' : 'Inactive'
                  }
                  color={
                    botStatus?.is_analyzing ? 'warning' :
                    botStatus?.is_active ? 'success' : 'default'
                  }
                  size="small"
                />
              </Box>
              <Button
                variant="contained"
                color={botStatus?.is_active ? 'error' : 'success'}
                startIcon={
                  toggling
                    ? <CircularProgress size={18} color="inherit" />
                    : (botStatus?.is_active ? <Stop /> : <PlayArrow />)
                }
                onClick={handleBotToggle}
                disabled={toggling}
                fullWidth
                sx={{ mb: 1 }}
              >
                {toggling
                  ? (botStatus?.is_active ? 'Stopping...' : 'Starting...')
                  : (botStatus?.is_active ? 'Stop Bot' : 'Start Bot')}
              </Button>
              {botStatus?.is_active && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Warning />}
                  onClick={async () => {
                    if (window.confirm("ARE YOU SURE? This will stop the bot and SELL ALL HOLDINGS immediately!")) {
                      try {
                        await botAPI.panicSell();
                        alert("PANIC SELL TRIGGERED: Bot stopped and all holdings are being liquidated.");
                        fetchDashboardData(true);
                      } catch (error) {
                        alert("Error executing panic sell. Please check logs.");
                      }
                    }
                  }}
                  fullWidth
                  sx={{ mb: 1, bgcolor: '#d32f2f', '&:hover': { bgcolor: '#b71c1c' } }}
                >
                  SELL ALL AND STOP BOT
                </Button>
              )}
              <Box mt={2} mb={2}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="textSecondary">
                    Portfolio Allocation ({Math.round((botConfig?.portfolio_allocation || 1.0) * 100)}%)
                  </Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={
                      botConfig?.portfolio_allocation_type === 'FIXED_AMOUNT' 
                        ? botConfig.portfolio_allocation_amount 
                        : Math.round((portfolioSummary?.total_value || 0) * (botConfig?.portfolio_allocation || 1.0))
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) return;
                      const portValue = portfolioSummary?.total_value || 1;
                      let percentage = Math.min(1.0, Math.max(0.01, val / portValue));
                      percentage = Math.round(percentage * 100) / 100; 
                      
                      setBotConfig(prev => prev ? { 
                        ...prev, 
                        portfolio_allocation_type: 'FIXED_AMOUNT',
                        portfolio_allocation_amount: val,
                        portfolio_allocation: percentage
                      } : null);
                    }}
                    onBlur={async (e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val) || val < 0) return;
                      
                      const portValue = portfolioSummary?.total_value || 1;
                      let percentage = Math.min(1.0, Math.max(0.01, val / portValue));
                      percentage = Math.round(percentage * 100) / 100; 
                      
                      try {
                        const updated = await botAPI.updateBotConfig({ 
                          portfolio_allocation_type: 'FIXED_AMOUNT',
                          portfolio_allocation_amount: val,
                          portfolio_allocation: percentage
                        });
                        setBotConfig(updated);
                      } catch (err) {
                        console.error('Failed to update allocation amount', err);
                      }
                    }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    disabled={!botConfig || !portfolioSummary}
                    sx={{ 
                      minWidth: '120px',
                      maxWidth: '140px',
                      '& input[type=number]': {
                        MozAppearance: 'textfield',
                      },
                      '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                        WebkitAppearance: 'none',
                        margin: 0,
                      },
                    }}
                  />
                </Box>
                <Slider
                  value={Math.round((botConfig?.portfolio_allocation || 1.0) * 100)}
                  step={1}
                  min={5}
                  max={100}
                  valueLabelDisplay="auto"
                  onChange={(_, value) => {
                    const newValue = (value as number) / 100;
                    setBotConfig(prev => prev ? { ...prev, portfolio_allocation: newValue } : null);
                  }}
                  onChangeCommitted={async (_, value) => {
                    const newValue = (value as number) / 100;
                    try {
                      const updated = await botAPI.updateBotConfig({ 
                        portfolio_allocation_type: 'PERCENTAGE',
                        portfolio_allocation: newValue 
                      });
                      setBotConfig(updated);
                    } catch (err) {
                      console.error('Failed to update allocation', err);
                    }
                  }}
                  disabled={!botConfig}
                  sx={{ width: '100%', mt: 1 }}
                />
              </Box>
              <Typography variant="body2" color="textSecondary">
                Today's Activity: {botStatus?.trades_bought_today || 0} Bought / {botStatus?.trades_sold_today || 0} Sold
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Trading Stats */}
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ShowChart sx={{ mr: 1, color: '#ffffff' }} />
                <Typography variant="h6" sx={{ color: '#ffffff' }}>Win Rate</Typography>
              </Box>
              <Typography variant="h4" sx={{ color: '#ffffff' }}>
                {tradingStats?.win_rate.toFixed(1) || '0.0'}%
              </Typography>
              <Typography variant="body2" sx={{ color: '#ffffff' }}>
                {tradingStats?.winning_trades || 0}W / {tradingStats?.losing_trades || 0}L
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Market Status */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Market Status
              </Typography>
              <Box display="flex" gap={1} mb={2}>
                <Chip
                  label={botStatus?.is_trading_hours ? 'Market Open' : 'Market Closed'}
                  color={botStatus?.is_trading_hours ? 'success' : 'default'}
                />
                <Chip
                  label={`${portfolioSummary?.holdings_count || 0} Holdings`}
                  variant="outlined"
                />
              </Box>
              <Typography variant="body2" color="textSecondary">
                The bot will automatically trade during market hours when active.
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.disabled' }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                <Button variant="outlined" size="small">
                  View Portfolio
                </Button>
                <Button variant="outlined" size="small">
                  Trading History
                </Button>
                <Button variant="outlined" size="small">
                  Bot Settings
                </Button>
                <Button variant="outlined" size="small" onClick={() => fetchDashboardData(true)}>
                  Refresh Data
                </Button>

              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Performance */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Performance Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={2}>
                  <Typography variant="body2" color="textSecondary">
                    Total Trades
                  </Typography>
                  <Typography variant="h6">
                    {tradingStats?.total_trades || 0}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="body2" color="textSecondary">
                    Avg Return
                  </Typography>
                  <Typography variant="h6">
                    ${tradingStats?.average_trade_return.toFixed(2) || '0.00'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="body2" color="textSecondary">
                    Best Trade
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    ${tradingStats?.best_trade?.toFixed(2) || '0.00'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="body2" color="textSecondary">
                    Worst Trade
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    ${tradingStats?.worst_trade?.toFixed(2) || '0.00'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="body2" color="textSecondary">
                    Best Open
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {tradingStats?.best_open_symbol ? (
                      <>{tradingStats.best_open_symbol} (+${tradingStats.best_open_position?.toFixed(2)})</>
                    ) : '-'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={2}>
                  <Typography variant="body2" color="textSecondary">
                    Worst Open
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    {tradingStats?.worst_open_symbol ? (
                      <>{tradingStats.worst_open_symbol} (-${Math.abs(tradingStats.worst_open_position || 0).toFixed(2)})</>
                    ) : '-'}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>



        {/* Activity Feed - Full Width */}
        <Grid item xs={12}>
          <ActivityFeed />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;