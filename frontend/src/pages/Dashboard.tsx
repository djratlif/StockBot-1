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
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  PlayArrow,
  Stop,
  AccountBalance,
  ShowChart,
} from '@mui/icons-material';
import { portfolioAPI, botAPI, tradesAPI } from '../services/api';
import type { PortfolioSummary, BotStatus, TradingStats } from '../services/api';
import ActivityFeed from '../components/ActivityFeed';

const Dashboard: React.FC = () => {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [tradingStats, setTradingStats] = useState<TradingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [portfolio, bot, stats] = await Promise.all([
        portfolioAPI.getPortfolioSummary().catch(() => null),
        botAPI.getBotStatus().catch(() => null),
        tradesAPI.getTradeSummary().catch(() => null),
      ]);

      setPortfolioSummary(portfolio);
      setBotStatus(bot);
      setTradingStats(stats);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBotToggle = async () => {
    if (!botStatus) return;

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
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
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
                <AccountBalance color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Portfolio Value</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                ${portfolioSummary?.total_value.toFixed(2) || '0.00'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Cash: ${portfolioSummary?.cash_balance.toFixed(2) || '0.00'}
              </Typography>
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
                <Typography variant="h6">Total Return</Typography>
              </Box>
              <Typography 
                variant="h4" 
                color={(portfolioSummary?.total_return || 0) >= 0 ? 'success.main' : 'error.main'}
              >
                ${portfolioSummary?.total_return.toFixed(2) || '0.00'}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {portfolioSummary?.return_percentage.toFixed(2) || '0.00'}%
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
                  label={botStatus?.is_active ? 'Active' : 'Inactive'}
                  color={botStatus?.is_active ? 'success' : 'default'}
                  size="small"
                />
              </Box>
              <Button
                variant="contained"
                color={botStatus?.is_active ? 'error' : 'success'}
                startIcon={botStatus?.is_active ? <Stop /> : <PlayArrow />}
                onClick={handleBotToggle}
                fullWidth
                sx={{ mb: 1 }}
              >
                {botStatus?.is_active ? 'Stop Bot' : 'Start Bot'}
              </Button>
              <Typography variant="body2" color="textSecondary">
                Trades Today: {botStatus?.trades_today || 0}/{botStatus?.max_daily_trades || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Trading Stats */}
        <Grid item xs={12} md={6} lg={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <ShowChart color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6">Win Rate</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {tradingStats?.win_rate.toFixed(1) || '0.0'}%
              </Typography>
              <Typography variant="body2" color="textSecondary">
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
                <Button variant="outlined" size="small" onClick={fetchDashboardData}>
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
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="textSecondary">
                    Total Trades
                  </Typography>
                  <Typography variant="h6">
                    {tradingStats?.total_trades || 0}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="textSecondary">
                    Avg Return
                  </Typography>
                  <Typography variant="h6">
                    ${tradingStats?.average_trade_return.toFixed(2) || '0.00'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="textSecondary">
                    Best Trade
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    ${tradingStats?.best_trade?.toFixed(2) || '0.00'}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="textSecondary">
                    Worst Trade
                  </Typography>
                  <Typography variant="h6" color="error.main">
                    ${tradingStats?.worst_trade?.toFixed(2) || '0.00'}
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