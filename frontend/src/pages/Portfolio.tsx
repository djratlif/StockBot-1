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
  CircularProgress,
  Alert,
} from '@mui/material';
import { portfolioAPI } from '../services/api';
import type { PortfolioSummary, Holding } from '../services/api';

const Portfolio: React.FC = () => {
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [summary, holdingsData] = await Promise.all([
        portfolioAPI.getPortfolioSummary(),
        portfolioAPI.getHoldings(),
      ]);

      setPortfolioSummary(summary);
      setHoldings(holdingsData);
    } catch (err) {
      setError('Failed to load portfolio data');
      console.error('Portfolio error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
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
        Portfolio
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Portfolio Summary Cards */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Value
              </Typography>
              <Typography variant="h4" color="primary">
                ${portfolioSummary?.total_value.toFixed(2) || '0.00'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Cash Balance
              </Typography>
              <Typography variant="h4" color="success.main">
                ${portfolioSummary?.cash_balance.toFixed(2) || '0.00'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Return
              </Typography>
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

        {/* Holdings Table */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Holdings
              </Typography>
              
              {holdings.length === 0 ? (
                <Box textAlign="center" py={4}>
                  <Typography variant="body1" color="textSecondary">
                    No holdings found. The bot hasn't made any purchases yet.
                  </Typography>
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Symbol</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell align="right">Avg Cost</TableCell>
                        <TableCell align="right">Current Price</TableCell>
                        <TableCell align="right">Market Value</TableCell>
                        <TableCell align="right">Gain/Loss</TableCell>
                        <TableCell align="right">Return %</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {holdings.map((holding) => {
                        const marketValue = holding.quantity * holding.current_price;
                        const costBasis = holding.quantity * holding.average_cost;
                        const gainLoss = marketValue - costBasis;
                        const returnPercent = ((holding.current_price - holding.average_cost) / holding.average_cost) * 100;

                        return (
                          <TableRow key={holding.id}>
                            <TableCell>
                              <Chip label={holding.symbol} variant="outlined" />
                            </TableCell>
                            <TableCell align="right">{holding.quantity}</TableCell>
                            <TableCell align="right">${holding.average_cost.toFixed(2)}</TableCell>
                            <TableCell align="right">${holding.current_price.toFixed(2)}</TableCell>
                            <TableCell align="right">${marketValue.toFixed(2)}</TableCell>
                            <TableCell 
                              align="right" 
                              sx={{ color: gainLoss >= 0 ? 'success.main' : 'error.main' }}
                            >
                              ${gainLoss.toFixed(2)}
                            </TableCell>
                            <TableCell 
                              align="right"
                              sx={{ color: returnPercent >= 0 ? 'success.main' : 'error.main' }}
                            >
                              {returnPercent.toFixed(2)}%
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
        </Grid>
      </Grid>
    </Box>
  );
};

export default Portfolio;