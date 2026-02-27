import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { tradesAPI, botAPI, portfolioAPI } from '../services/api';
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
      const tradesData = await tradesAPI.getTradingHistory(50);
      setTrades(tradesData);
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
      fetchTrades();
    } catch (err) {
      setError('Failed to execute trade');
      console.error('Trade execution error:', err);
    }
  };

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && trades.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      <Box display="flex" alignItems="center" mb={3}>
        <Typography variant="h4" style={{ marginRight: '16px', marginBottom: 0 }}>
          Trading Central
        </Typography>
        <Chip
          label="Live Updates"
          color="success"
          size="small"
          variant="outlined"
          style={{ animation: 'pulse 2s infinite' }}
        />
        <style>
          {`
            @keyframes pulse {
              0% { opacity: 1; }
              50% { opacity: 0.5; }
              100% { opacity: 1; }
            }
          `}
        </style>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Grid for Analysis and Stats */}
      <Grid container spacing={3} mb={3}>
        {/* Stock Analysis */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                AI Stock Analysis
              </Typography>
              <Box display="flex" gap={1} mb={2}>
                <TextField
                  label="Stock Symbol"
                  value={analyzeSymbol}
                  onChange={(e) => setAnalyzeSymbol(e.target.value)}
                  size="small"
                  placeholder="e.g., AAPL"
                  fullWidth
                />
                <Button
                  variant="contained"
                  onClick={handleAnalyzeStock}
                  disabled={analyzing || !analyzeSymbol.trim()}
                  sx={{ minWidth: '100px' }}
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
                    <Box sx={{ bgcolor: 'background.default', p: 2, borderRadius: 1 }}>
                      <Typography variant="body2" gutterBottom>
                        <strong>Action:</strong> <Chip size="small" label={analysisResult.data.action} color={analysisResult.data.action === 'BUY' ? 'success' : analysisResult.data.action === 'SELL' ? 'error' : 'default'} />
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
                        <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                          <strong>Reasoning:</strong> {analysisResult.data.reasoning}
                        </Typography>
                      )}
                      {analysisResult.data.action !== 'HOLD' && (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={() => handleExecuteTrade(analysisResult.data.symbol)}
                          sx={{ mt: 2 }}
                          fullWidth
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
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom fontWeight="bold">
                Trading Summary
              </Typography>
              <Box display="flex" justifyContent="space-around" textAlign="center" mt={3}>
                <Box>
                  <Typography variant="h3" color="primary.main">
                    {trades.length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Trades
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="h3" color="secondary.main">
                    {trades.filter(t => new Date(t.executed_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Trades Today
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

    </Box>
  );
};

export default Trading;