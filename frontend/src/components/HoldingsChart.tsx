import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { Card, CardContent, Typography, Box, CircularProgress, Alert } from '@mui/material';
import { portfolioAPI, stocksAPI, Holding } from '../services/api';

interface HoldingWithPrice extends Holding {
  total_value: number;
  unrealized_pnl: number;
  unrealized_pnl_percent: number;
}

const HoldingsChart: React.FC = () => {
  const [holdings, setHoldings] = useState<HoldingWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHoldingsWithPrices = async () => {
    try {
      setError(null);
      const holdingsData = await portfolioAPI.getHoldings();
      
      if (holdingsData.length === 0) {
        setHoldings([]);
        setLoading(false);
        return;
      }

      // Fetch current prices for all holdings
      const holdingsWithPrices = await Promise.all(
        holdingsData.map(async (holding) => {
          try {
            const priceData = await stocksAPI.getStockPrice(holding.symbol);
            const currentPrice = priceData.price;
            const totalValue = holding.quantity * currentPrice;
            const totalCost = holding.quantity * holding.average_cost;
            const unrealizedPnl = totalValue - totalCost;
            const unrealizedPnlPercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

            return {
              ...holding,
              current_price: currentPrice,
              total_value: totalValue,
              unrealized_pnl: unrealizedPnl,
              unrealized_pnl_percent: unrealizedPnlPercent,
            };
          } catch (err) {
            console.error(`Error fetching price for ${holding.symbol}:`, err);
            // Use the stored current_price as fallback
            const totalValue = holding.quantity * holding.current_price;
            const totalCost = holding.quantity * holding.average_cost;
            const unrealizedPnl = totalValue - totalCost;
            const unrealizedPnlPercent = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

            return {
              ...holding,
              total_value: totalValue,
              unrealized_pnl: unrealizedPnl,
              unrealized_pnl_percent: unrealizedPnlPercent,
            };
          }
        })
      );

      setHoldings(holdingsWithPrices);
    } catch (err) {
      console.error('Error fetching holdings:', err);
      setError('Failed to load holdings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldingsWithPrices();
    
    // Update every minute (60000ms)
    const interval = setInterval(fetchHoldingsWithPrices, 60000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Portfolio Holdings
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <Typography variant="body1" color="textSecondary">
              No holdings found. Start trading to see your portfolio visualization.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for the pie chart
  const symbols = holdings.map(h => h.symbol);
  const values = holdings.map(h => h.total_value);
  const colors = holdings.map((h, index) => {
    // Generate colors based on performance
    if (h.unrealized_pnl > 0) {
      return `rgba(76, 175, 80, ${0.7 + (index * 0.1) % 0.3})`; // Green shades for profits
    } else if (h.unrealized_pnl < 0) {
      return `rgba(244, 67, 54, ${0.7 + (index * 0.1) % 0.3})`; // Red shades for losses
    } else {
      return `rgba(158, 158, 158, ${0.7 + (index * 0.1) % 0.3})`; // Gray for neutral
    }
  });

  // Create hover text with detailed information
  const hoverText = holdings.map(h => 
    `<b>${h.symbol}</b><br>` +
    `Shares: ${h.quantity.toLocaleString()}<br>` +
    `Current Price: $${h.current_price.toFixed(2)}<br>` +
    `Avg Cost: $${h.average_cost.toFixed(2)}<br>` +
    `Total Value: $${h.total_value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br>` +
    `P&L: $${h.unrealized_pnl.toFixed(2)} (${h.unrealized_pnl_percent.toFixed(2)}%)<br>` +
    `<extra></extra>`
  );

  const plotData = [{
    type: 'pie' as const,
    labels: symbols,
    values: values,
    hovertemplate: hoverText,
    marker: {
      colors: colors,
      line: {
        color: '#ffffff',
        width: 2
      }
    },
    textinfo: 'label+percent' as const,
    textposition: 'auto' as const,
    showlegend: true,
  }];

  const layout = {
    title: {
      text: 'Portfolio Holdings Distribution',
      font: { size: 18, color: '#333' }
    },
    font: { family: 'Roboto, sans-serif' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { t: 50, b: 50, l: 50, r: 50 },
    height: 400,
    legend: {
      orientation: 'v' as const,
      x: 1.05,
      y: 0.5,
      font: { size: 12 }
    }
  };

  const config = {
    displayModeBar: false,
    responsive: true,
  };

  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.total_value, 0);
  const totalUnrealizedPnl = holdings.reduce((sum, h) => sum + h.unrealized_pnl, 0);
  const totalUnrealizedPnlPercent = totalPortfolioValue > 0 ? (totalUnrealizedPnl / (totalPortfolioValue - totalUnrealizedPnl)) * 100 : 0;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Portfolio Holdings
          </Typography>
          <Box textAlign="right">
            <Typography variant="body2" color="textSecondary">
              Total Value: ${totalPortfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
            <Typography 
              variant="body2" 
              color={totalUnrealizedPnl >= 0 ? 'success.main' : 'error.main'}
            >
              P&L: ${totalUnrealizedPnl.toFixed(2)} ({totalUnrealizedPnlPercent.toFixed(2)}%)
            </Typography>
          </Box>
        </Box>
        
        <Plot
          data={plotData}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '400px' }}
        />
        
        <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
          Updates every minute • Hover over segments for detailed information
        </Typography>
      </CardContent>
    </Card>
  );
};

export default HoldingsChart;