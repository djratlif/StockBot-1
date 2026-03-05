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
  IconButton,
  Divider
} from '@mui/material';
import { AccountBalance, TrendingUp, TrendingDown, KeyboardArrowDown, KeyboardArrowUp, Psychology, ExpandMore, ExpandLess } from '@mui/icons-material';
import { portfolioAPI, tradesAPI } from '../services/api';
import type { PortfolioSummary, Holding, Trade } from '../services/api';
import { useWebSocket } from '../contexts/WebSocketContext';
import AnimatedPrice from '../components/AnimatedPrice';
import HistoricalChart from '../components/HistoricalChart';

/** Pill that expands inline to show one AI insight's full text */
const InsightPill = ({ trade }: { trade: Trade }) => {
  const [open, setOpen] = useState(false);
  const providerColor =
    trade.ai_provider === 'OPENAI' ? '#1976d2'
      : trade.ai_provider === 'GEMINI' ? '#dc004e'
        : '#ed6c02';

  return (
    <Box mb={1}>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          px: 1.5,
          py: 0.5,
          borderRadius: 2,
          border: `1px solid ${providerColor}`,
          bgcolor: `${providerColor}18`,
          color: providerColor,
          userSelect: 'none',
          '&:hover': { bgcolor: `${providerColor}30` },
          transition: 'background 0.2s'
        }}
      >
        <Psychology sx={{ fontSize: 14 }} />
        <Typography variant="caption" fontWeight="bold">
          {trade.ai_provider || 'OPENAI'}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          · {new Date(trade.executed_at!).toLocaleDateString()}
        </Typography>
        {open ? <ExpandLess sx={{ fontSize: 14 }} /> : <ExpandMore sx={{ fontSize: 14 }} />}
      </Box>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box
          sx={{
            mt: 0.75,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.04)',
            borderLeft: `3px solid ${providerColor}`
          }}
        >
          <Typography variant="body2" sx={{ lineHeight: 1.6, mb: 0.5 }}>
            "{trade.ai_reasoning || 'Algorithm initiated trade without explicit reasoning record.'}"
          </Typography>
          <Typography variant="caption" color="textSecondary">
            <strong>Bought at:</strong> ${trade.price.toFixed(2)} &nbsp;|&nbsp; <strong>Qty:</strong> {trade.quantity}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
};

/** One row in the holdings table — holds merged quantity/cost across providers */
const HoldingRow = ({ symbol, holdings, trades }: { symbol: string; holdings: Holding[]; trades: Trade[] }) => {
  const [open, setOpen] = useState(false);

  // Merge: sum quantity & weighted-average cost across all providers for this symbol
  const totalQty = holdings.reduce((acc, h) => acc + h.quantity, 0);
  const totalCost = holdings.reduce((acc, h) => acc + h.quantity * h.average_cost, 0);
  const avgCost = totalQty !== 0 ? totalCost / totalQty : 0;
  const currentPrice = holdings[0]?.current_price ?? 0;
  const isShort = totalQty < 0;
  const totalValue = Math.abs(totalQty) * currentPrice;
  const totalReturn = (currentPrice - avgCost) * totalQty;
  const initialInvestment = Math.abs(totalQty) * avgCost;
  const returnPercent = initialInvestment > 0 ? (totalReturn / initialInvestment) * 100 : 0;
  const isPositive = totalReturn >= 0;

  // Latest BUY trade per provider for insights
  const insightTrades = useMemo(() => {
    const buyTrades = trades.filter(t => t.symbol === symbol && t.action === 'BUY');
    const latestByProvider = new Map<string, Trade>();
    [...buyTrades]
      .sort((a, b) => new Date(a.executed_at!).getTime() - new Date(b.executed_at!).getTime())
      .forEach(t => latestByProvider.set(t.ai_provider || 'OPENAI', t));
    return Array.from(latestByProvider.values())
      .sort((a, b) => new Date(b.executed_at!).getTime() - new Date(a.executed_at!).getTime());
  }, [symbol, trades]);

  return (
    <React.Fragment>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Chip
            label={symbol}
            color="primary"
            variant="outlined"
            size="small"
            onClick={() => setOpen(!open)}
            clickable
            sx={{ fontWeight: 'bold' }}
          />
        </TableCell>
        <TableCell align="right">
          {Math.abs(totalQty)}{isShort && (
            <Typography component="span" variant="caption" color="error.main"> (Short)</Typography>
          )}
        </TableCell>
        <TableCell align="right">${avgCost.toFixed(2)}</TableCell>
        <TableCell align="right">${currentPrice.toFixed(2)}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 'bold' }}>${totalValue.toFixed(2)}</TableCell>
        <TableCell align="right">
          <Typography variant="body2" color={isPositive ? 'success.main' : 'error.main'} fontWeight="bold">
            {isPositive ? '+' : ''}{totalReturn.toFixed(2)} ({isPositive ? '+' : ''}{returnPercent.toFixed(2)}%)
          </Typography>
        </TableCell>
      </TableRow>

      {/* Expanded detail row */}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2, mb: 4 }}>
              <Typography variant="h6" gutterBottom component="div">
                Market Intelligence
              </Typography>
              <Grid container spacing={3}>
                {/* AI Insights Panel */}
                <Grid item xs={12} md={4}>
                  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(255,255,255,0.02)' }}>
                    <CardContent>
                      <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                        AI Insights
                      </Typography>

                      {insightTrades.length === 0 ? (
                        <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
                          No AI reasoning found for {symbol} in recent trades.
                        </Typography>
                      ) : (
                        <Box>
                          {insightTrades.map(trade => (
                            <InsightPill key={trade.id} trade={trade} />
                          ))}
                        </Box>
                      )}

                      {/* Per-provider position breakdown if multiple */}
                      {holdings.length > 1 && (
                        <>
                          <Divider sx={{ my: 1.5, opacity: 0.2 }} />
                          <Typography variant="caption" color="textSecondary" display="block" mb={0.5}>
                            Position breakdown
                          </Typography>
                          {holdings.map(h => (
                            <Box key={h.id} display="flex" justifyContent="space-between" mb={0.25}>
                              <Typography variant="caption" color="textSecondary">
                                {h.ai_provider || 'OPENAI'}
                              </Typography>
                              <Typography variant="caption">
                                {h.quantity} @ ${h.average_cost.toFixed(2)}
                              </Typography>
                            </Box>
                          ))}
                        </>
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
                          symbol={symbol}
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

  const { lastMessage } = useWebSocket();

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
    const interval = setInterval(fetchPortfolioData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Group holdings by symbol so each symbol appears only once
  const holdingsBySymbol = useMemo(() => {
    const map = new Map<string, Holding[]>();
    holdings.forEach(h => {
      if (!map.has(h.symbol)) map.set(h.symbol, []);
      map.get(h.symbol)!.push(h);
    });
    return Array.from(map.entries()); // [ [symbol, Holding[]], ... ]
  }, [holdings]);

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

            {holdingsBySymbol.length === 0 ? (
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
                    {holdingsBySymbol.map(([symbol, symbolHoldings]) => (
                      <HoldingRow
                        key={symbol}
                        symbol={symbol}
                        holdings={symbolHoldings}
                        trades={trades}
                      />
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