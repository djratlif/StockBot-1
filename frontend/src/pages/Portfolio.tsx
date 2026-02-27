import React, { useState, useEffect, useMemo } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  Select,
  MenuItem,
  InputLabel
} from '@mui/material';
import { AccountBalance, TrendingUp, TrendingDown } from '@mui/icons-material';
import { portfolioAPI, tradesAPI } from '../services/api';
import type { PortfolioSummary, Holding, Trade } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import AnimatedPrice from '../components/AnimatedPrice';
import HistoricalChart from '../components/HistoricalChart';

const Portfolio: React.FC = () => {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>('');

  const { lastMessage, isConnected } = useWebSocket();

  // Listen for WebSocket updates
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'portfolio_update') {
        setPortfolioSummary(prev => {
          if (!prev) return prev;
          // Calculate the change manually from the prev state or update directly if daily_change is provided by WS
          return {
            ...prev,
            cash_balance: lastMessage.payload.cash_balance,
            total_value: lastMessage.payload.total_value,
            holdings_value: lastMessage.payload.total_value - lastMessage.payload.cash_balance
          };
        });
        setLastUpdated(new Date());
      }
    }
  }, [lastMessage]);

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summary, holdingsData, tradesData] = await Promise.all([
        portfolioAPI.getPortfolioSummary(),
        portfolioAPI.getHoldings(),
        tradesAPI.getTradingHistory(50)
      ]);

      setPortfolioSummary(summary);
      setHoldings(holdingsData);
      setTrades(tradesData);
      setLastUpdated(new Date());

      if (!selectedChartSymbol && holdingsData && holdingsData.length > 0) {
        setSelectedChartSymbol(holdingsData[0].symbol);
      }
    } catch (err) {
      setError('Failed to load portfolio data');
      console.error('Portfolio error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
    // Refresh data every minute (60000ms)
    const interval = setInterval(fetchPortfolioData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getReasoningForSymbol = (symbol: string) => {
    if (!symbol) return null;
    const buyTrades = trades.filter(t => t.symbol === symbol && t.action === 'BUY');
    if (buyTrades.length === 0) return null;

    buyTrades.sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());
    return buyTrades[0];
  };

  const selectedTradeContext = useMemo(() => getReasoningForSymbol(selectedChartSymbol), [selectedChartSymbol, trades]);

  if (loading && !portfolioSummary) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <Typography variant="h4" gutterBottom style={{ marginRight: '16px', marginBottom: 0 }}>
          Portfolio
        </Typography>
        <Typography variant="caption" sx={{ verticalAlign: 'middle', color: 'text.secondary' }}>
          Updated: {lastUpdated.toLocaleTimeString()}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Portfolio Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
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
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Typography variant="h6" sx={{ color: '#ffffff' }}>Cash Balance</Typography>
              </Box>
              <AnimatedPrice
                value={portfolioSummary?.cash_balance || 0}
                prefix="$"
                typographyVariant="h4"
                color="#ffffff"
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
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
                value={Math.abs(portfolioSummary?.total_return || 0)}
                trendValue={portfolioSummary?.total_return || 0}
                prefix={(portfolioSummary?.total_return || 0) >= 0 ? '+$' : '-$'}
                typographyVariant="h4"
                color={(portfolioSummary?.total_return || 0) >= 0 ? '#4caf50' : '#f44336'}
              />
              <Box display="flex" alignItems="center" mt={1}>
                <Typography variant="body2" color={(portfolioSummary?.total_return || 0) >= 0 ? 'success.main' : 'error.main'}>
                  {(portfolioSummary?.return_percentage || 0) > 0 ? '+' : ''}{(portfolioSummary?.return_percentage || 0).toFixed(2)}%
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Current Holdings Table */}
      <Box mb={3}>
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box p={3} pb={2}>
              <Typography variant="h5" fontWeight="bold">
                Current Holdings
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Your portfolio composition and performance
              </Typography>
            </Box>

            {holdings.length === 0 ? (
              <Box textAlign="center" py={6}>
                <Typography variant="body1" color="textSecondary">
                  No holdings found. The bot hasn't made any purchases yet.
                </Typography>
              </Box>
            ) : (
              <TableContainer component={Paper} elevation={0} sx={{ bgcolor: 'transparent' }}>
                <Table>
                  <TableHead sx={{ bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Symbol</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Avg Cost</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Current Price</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Value</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Return</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {holdings.map((h) => {
                      const isShort = h.quantity < 0;
                      const totalReturn = (h.current_price - h.average_cost) * h.quantity;
                      const initialInvestment = Math.abs(h.quantity) * h.average_cost;
                      const returnPercent = initialInvestment > 0 ? (totalReturn / initialInvestment) * 100 : 0;
                      const isPositive = totalReturn >= 0;
                      const totalValue = Math.abs(h.quantity) * h.current_price;

                      return (
                        <TableRow
                          key={h.symbol}
                          hover
                          onClick={() => setSelectedChartSymbol(h.symbol)}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(25, 118, 210, 0.08)' },
                            bgcolor: selectedChartSymbol === h.symbol ? 'rgba(25, 118, 210, 0.04)' : 'transparent'
                          }}
                        >
                          <TableCell>
                            <Chip
                              label={h.symbol}
                              color="primary"
                              variant={selectedChartSymbol === h.symbol ? "filled" : "outlined"}
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {Math.abs(h.quantity)} {isShort && <Typography component="span" variant="caption" color="error.main">(Short)</Typography>}
                          </TableCell>
                          <TableCell align="right">${h.average_cost.toFixed(2)}</TableCell>
                          <TableCell align="right">${h.current_price.toFixed(2)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 'bold' }}>${totalValue.toFixed(2)}</TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              color={isPositive ? 'success.main' : 'error.main'}
                              fontWeight="bold"
                            >
                              {isPositive ? '+' : ''}{totalReturn.toFixed(2)} ({isPositive ? '+' : ''}{returnPercent.toFixed(2)}%)
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Chart and AI Reasoning Section */}
      <Box mb={3}>
        <Typography variant="h5" gutterBottom fontWeight="bold">
          Market Intelligence
        </Typography>
        <Grid container spacing={3}>
          {/* AI Reasoning Panel */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  AI Insight
                </Typography>
                {!selectedChartSymbol ? (
                  <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                    Select a holding to view AI reasoning.
                  </Typography>
                ) : !selectedTradeContext ? (
                  <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                    No AI reasoning found for {selectedChartSymbol} in recent trades.
                  </Typography>
                ) : (
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold" color="primary.main" gutterBottom>
                      Trade executed on {new Date(selectedTradeContext.executed_at).toLocaleDateString()}
                    </Typography>
                    <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 2, borderRadius: 2, borderLeft: '4px solid #1976d2' }}>
                      <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                        "{selectedTradeContext.ai_reasoning || "Algorithm initiated trade without explicit reasoning record."}"
                      </Typography>
                    </Box>
                    <Box mt={2}>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Bought at:</strong> ${selectedTradeContext.price.toFixed(2)}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        <strong>Quantity:</strong> {selectedTradeContext.quantity}
                      </Typography>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Chart Panel */}
          <Grid item xs={12} md={8}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography variant="h6">
                    Historical View
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel id="chart-symbol-select-label">Holding</InputLabel>
                    <Select
                      labelId="chart-symbol-select-label"
                      value={selectedChartSymbol}
                      label="Holding"
                      onChange={(e) => setSelectedChartSymbol(e.target.value)}
                    >
                      {holdings.length === 0 && <MenuItem value=""><em>None</em></MenuItem>}
                      {holdings.map((h) => (
                        <MenuItem key={h.symbol} value={h.symbol}>{h.symbol}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box sx={{ borderRadius: 1, overflow: 'hidden' }}>
                  {selectedChartSymbol ? (
                    <HistoricalChart
                      symbol={selectedChartSymbol}
                      height={400}
                      trades={trades}
                      showToolbar={false}
                    />
                  ) : (
                    <Box display="flex" justifyContent="center" alignItems="center" minHeight={400} sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
                      <Typography color="textSecondary">Portfolio is empty</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

    </Box>
  );
};

export default Portfolio;