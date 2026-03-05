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
  Collapse,
  IconButton
} from '@mui/material';
import { AccountBalance, TrendingUp, TrendingDown, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { portfolioAPI, tradesAPI } from '../services/api';
import type { PortfolioSummary, Holding, Trade } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import AnimatedPrice from '../components/AnimatedPrice';
import HistoricalChart from '../components/HistoricalChart';

const HoldingRow = ({ holding: h, trades }: { holding: Holding, trades: Trade[] }) => {
  const [open, setOpen] = useState(false);
  const isShort = h.quantity < 0;
  const totalReturn = (h.current_price - h.average_cost) * h.quantity;
  const initialInvestment = Math.abs(h.quantity) * h.average_cost;
  const returnPercent = initialInvestment > 0 ? (totalReturn / initialInvestment) * 100 : 0;
  const isPositive = totalReturn >= 0;
  const totalValue = Math.abs(h.quantity) * h.current_price;

  const reasoningContext = useMemo(() => {
    const buyTrades = trades.filter(t => t.symbol === h.symbol && t.action === 'BUY');
    if (buyTrades.length === 0) return [];

    const latestTradesByProvider = new Map<string, Trade>();
    const sortedTrades = [...buyTrades].sort((a, b) => new Date(a.executed_at!).getTime() - new Date(b.executed_at!).getTime());

    sortedTrades.forEach(trade => {
      const provider = trade.ai_provider || 'OPENAI';
      latestTradesByProvider.set(provider, trade);
    });

    return Array.from(latestTradesByProvider.values())
      .sort((a, b) => new Date(b.executed_at!).getTime() - new Date(a.executed_at!).getTime());
  }, [h.symbol, trades]);

  return (
    <React.Fragment>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Chip
            label={h.symbol}
            color="primary"
            variant="outlined"
            size="small"
            onClick={() => setOpen(!open)}
            clickable
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
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2, mb: 4 }}>
              <Typography variant="h6" gutterBottom component="div">
                Market Intelligence
              </Typography>
              <Grid container spacing={3}>
                {/* AI Reasoning Panel */}
                <Grid item xs={12} md={4}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        AI Insight
                      </Typography>
                      {!reasoningContext || reasoningContext.length === 0 ? (
                        <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                          No AI reasoning found for {h.symbol} in recent trades.
                        </Typography>
                      ) : (
                        <Box>
                          {reasoningContext.map(trade => {
                            const providerColor = trade.ai_provider === 'OPENAI' ? '#1976d2' : trade.ai_provider === 'GEMINI' ? '#dc004e' : '#ed6c02';
                            return (
                              <Box key={trade.id} mb={3}>
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ color: providerColor }} gutterBottom>
                                  {trade.ai_provider || 'OPENAI'} • Executed {new Date(trade.executed_at!).toLocaleDateString()}
                                </Typography>
                                <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', p: 2, borderRadius: 2, borderLeft: `4px solid ${providerColor}` }}>
                                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                                    "{trade.ai_reasoning || "Algorithm initiated trade without explicit reasoning record."}"
                                  </Typography>
                                </Box>
                                <Box mt={1}>
                                  <Typography variant="caption" color="textSecondary">
                                    <strong>Bought at:</strong> ${trade.price.toFixed(2)} | <strong>Qty:</strong> {trade.quantity}
                                  </Typography>
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                {/* Chart Panel */}
                <Grid item xs={12} md={8}>
                  <Card sx={{ height: '100%', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        Historical View
                      </Typography>
                      <Box sx={{ borderRadius: 1, overflow: 'hidden' }}>
                        <HistoricalChart
                          symbol={h.symbol}
                          height={300}
                          trades={trades}
                          showToolbar={false}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </React.Fragment>
  );
};

const Portfolio: React.FC = () => {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { lastMessage, isConnected } = useWebSocket();

  // Listen for WebSocket updates
  useEffect(() => {
    if (lastMessage) {
      if (lastMessage.type === 'portfolio_update') {
        setPortfolioSummary(prev => {
          if (!prev) return prev;
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
                      <TableCell width={50} />
                      <TableCell sx={{ fontWeight: 'bold' }}>Symbol</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Qty</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Avg Cost</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Current Price</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Value</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Return</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {holdings.map((h) => (
                      <HoldingRow key={h.id} holding={h} trades={trades} />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default Portfolio;