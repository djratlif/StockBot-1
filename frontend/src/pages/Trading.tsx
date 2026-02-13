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
} from '@mui/material';
import { tradesAPI, botAPI } from '../services/api';
import type { Trade } from '../services/api';

const Trading: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyzeSymbol, setAnalyzeSymbol] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const tradesData = await tradesAPI.getTradingHistory(20);
      setTrades(tradesData);
    } catch (err) {
      setError('Failed to load trading history');
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
                Recent Activity: {trades.filter(t => new Date(t.executed_at) > new Date(Date.now() - 24*60*60*1000)).length} trades today
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Trading History */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Trades
              </Typography>
              
              {trades.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <Typography variant="body1" color="textSecondary">
                    No trades found. Start the bot to begin trading.
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Symbol</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Price</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell>AI Reasoning</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {trades.map((trade) => (
                        <TableRow key={trade.id}>
                          <TableCell>
                            {new Date(trade.executed_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Chip label={trade.symbol} variant="outlined" />
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={trade.action}
                              color={trade.action === 'BUY' ? 'success' : 'error'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">{trade.quantity}</TableCell>
                          <TableCell align="right">${trade.price.toFixed(2)}</TableCell>
                          <TableCell align="right">${trade.total_amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ maxWidth: 200 }}>
                              {trade.ai_reasoning || 'No reasoning provided'}
                            </Typography>
                          </TableCell>
                        </TableRow>
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