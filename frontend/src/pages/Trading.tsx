import React, { useState, useEffect } from 'react';
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
  Button,
  TextField,
  CircularProgress,
  Alert,
  IconButton,
  Collapse,
} from '@mui/material';
import { KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { tradesAPI, botAPI, portfolioAPI, Holding } from '../services/api';
import type { Trade } from '../services/api';
import HistoricalChart from '../components/HistoricalChart';

// Row component to handle expansion logic
const HoldingRow: React.FC<{ holding: Holding, trades: Trade[] }> = ({ holding, trades }) => {
  const [open, setOpen] = useState(false);

  const marketValue = holding.quantity * holding.current_price;
  const costBasis = holding.quantity * holding.average_cost;
  const gainLoss = marketValue - costBasis;
  const returnPercent = costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : 0;

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row">
          <Chip label={holding.symbol} color="primary" variant="outlined" />
        </TableCell>
        <TableCell align="right">{holding.quantity}</TableCell>
        <TableCell align="right">${holding.average_cost.toFixed(2)}</TableCell>
        <TableCell align="right">${holding.current_price.toFixed(2)}</TableCell>
        <TableCell align="right"><strong>${marketValue.toFixed(2)}</strong></TableCell>
        <TableCell align="right">
          <Typography
            variant="body2"
            color={gainLoss >= 0 ? 'success.main' : 'error.main'}
            fontWeight="bold"
          >
            {gainLoss >= 0 ? '+' : ''}{gainLoss.toFixed(2)} ({returnPercent.toFixed(2)}%)
          </Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 1 }}>
              <Typography variant="subtitle2" gutterBottom component="div">
                Price History & Buy Points
              </Typography>
              <HistoricalChart
                symbol={holding.symbol}
                height={400}
                trades={trades}
                showToolbar={false}
              />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

const Trading: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzeSymbol, setAnalyzeSymbol] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const [tradesData, holdingsData] = await Promise.all([
        tradesAPI.getTradingHistory(50),
        portfolioAPI.getHoldings()
      ]);
      setTrades(tradesData);
      setHoldings(holdingsData);
    } catch (err) {
      setError('Failed to load trading data');
      console.error('Trading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeStock = async () => {
    if (!analyzeSymbol.trim()) return;

    try {
      setAnalyzing(true);
      const result = await botAPI.analyzeStock(analyzeSymbol.toUpperCase());
      setAnalysisResult(result);
    } catch (err) {
      setError('Failed to analyze stock');
      console.error('Analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExecuteTrade = async (symbol: string) => {
    try {
      const result = await botAPI.executeAITrade(symbol);
      setAnalysisResult(result);
      // Refresh trades
      fetchTrades();
    } catch (err) {
      setError('Failed to execute trade');
      console.error('Trade execution error:', err);
    }
  };

  useEffect(() => {
    fetchTrades();
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
      <Typography variant="h4" gutterBottom>
        Trading
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Stock Analysis */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                AI Stock Analysis
              </Typography>
              <Box display="flex" gap={1} mb={2}>
                <TextField
                  label="Stock Symbol"
                  value={analyzeSymbol}
                  onChange={(e) => setAnalyzeSymbol(e.target.value)}
                  size="small"
                  placeholder="e.g., AAPL"
                />
                <Button
                  variant="contained"
                  onClick={handleAnalyzeStock}
                  disabled={analyzing || !analyzeSymbol.trim()}
                >
                  {analyzing ? <CircularProgress size={20} /> : 'Analyze'}
                </Button>
              </Box>

              {analysisResult && (
                <Box>
                  <Alert severity={analysisResult.success ? 'success' : 'error'} sx={{ mb: 2 }}>
                    {analysisResult.message}
                  </Alert>
                  {analysisResult.data && (
                    <Box>
                      <Typography variant="body2" gutterBottom>
                        <strong>Action:</strong> {analysisResult.data.action}
                      </Typography>
                      {analysisResult.data.quantity && (
                        <Typography variant="body2" gutterBottom>
                          <strong>Quantity:</strong> {analysisResult.data.quantity}
                        </Typography>
                      )}
                      {analysisResult.data.confidence && (
                        <Typography variant="body2" gutterBottom>
                          <strong>Confidence:</strong> {analysisResult.data.confidence}/10
                        </Typography>
                      )}
                      {analysisResult.data.reasoning && (
                        <Typography variant="body2" gutterBottom>
                          <strong>Reasoning:</strong> {analysisResult.data.reasoning}
                        </Typography>
                      )}
                      {analysisResult.data.action !== 'HOLD' && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleExecuteTrade(analysisResult.data.symbol)}
                          sx={{ mt: 1 }}
                        >
                          Execute Trade
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trading Summary
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Total Trades: {trades.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Recent Activity: {trades.filter(t => new Date(t.executed_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length} trades today
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Current Holdings Table */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Holdings
              </Typography>

              {holdings.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <Typography variant="body1" color="textSecondary">
                    No holdings found. Start trading to see your portfolio here.
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell />
                        <TableCell>Symbol</TableCell>
                        <TableCell align="right">Shares</TableCell>
                        <TableCell align="right">Avg Cost</TableCell>
                        <TableCell align="right">Current Price</TableCell>
                        <TableCell align="right">Total Value</TableCell>
                        <TableCell align="right">Return</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {holdings.map((holding) => (
                        <HoldingRow
                          key={holding.id}
                          holding={holding}
                          trades={trades.filter(t => t.symbol === holding.symbol)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Trading;