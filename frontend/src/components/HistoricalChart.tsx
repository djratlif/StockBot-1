import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { Trade } from '../services/api';
import {
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  Chip
} from '@mui/material';
import { portfolioAPI, stocksAPI, Holding } from '../services/api';

interface HistoricalData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface StockHistoryResponse {
  symbol: string;
  period: string;
  data: HistoricalData[];
}

interface HistoricalChartProps {
  symbol?: string; // If provided, locks the chart to this symbol
  height?: number; // Custom height
  trades?: Trade[]; // Trades to plot as markers
  showToolbar?: boolean; // Whether to show the symbol selector
}

const HistoricalChart: React.FC<HistoricalChartProps> = ({
  symbol,
  height = 500,
  trades = [],
  showToolbar = true
}) => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(symbol || '');
  const [period, setPeriod] = useState<string>('1d');
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periods = [
    { value: '1d', label: '1 Day' },
    { value: '5d', label: '5 Days' },
    { value: '1mo', label: '1 Month' },
    { value: '3mo', label: '3 Months' },
    { value: '6mo', label: '6 Months' },
    { value: '1y', label: '1 Year' },
    { value: '2y', label: '2 Years' }
  ];

  const fetchHoldings = async () => {
    try {
      if (symbol) {
        // If symbol prop is provided, we don't necessarily need to fetch all holdings for the selector
        // But we might want to if showToolbar is true.
        // For simplicity, if symbol is fixed, we just set it.
        if (!selectedSymbol) setSelectedSymbol(symbol);
        return;
      }

      const holdingsData = await portfolioAPI.getHoldings();
      setHoldings(holdingsData);

      // Set the first holding as default selected symbol
      if (holdingsData.length > 0 && !selectedSymbol) {
        setSelectedSymbol(holdingsData[0].symbol);
      }
    } catch (err) {
      console.error('Error fetching holdings:', err);
      // Only set error if we really need holdings (no symbol provided)
      if (!symbol) setError('Failed to load holdings');
    }
  };

  const fetchHistoricalData = async (symbol: string, selectedPeriod: string) => {
    if (!symbol) return;

    try {
      setLoading(true);
      setError(null);

      const response: StockHistoryResponse = await stocksAPI.getStockHistory(symbol, selectedPeriod);
      setHistoricalData(response.data);
    } catch (err) {
      console.error(`Error fetching historical data for ${symbol}:`, err);
      setError(`Failed to load historical data for ${symbol}`);
      setHistoricalData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (symbol) {
      setSelectedSymbol(symbol);

      // Determine optimal period based on buy date
      if (trades && trades.length > 0) {
        // Find earliest buy trade for this symbol
        const buyTrades = trades.filter(t => t.symbol === symbol && t.action === 'BUY');
        if (buyTrades.length > 0) {
          // Sort by date ascending to get the first buy
          buyTrades.sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime());
          const firstBuyDate = new Date(buyTrades[0].executed_at);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - firstBuyDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let newPeriod = '1d';
          if (diffDays <= 1) newPeriod = '1d';
          else if (diffDays <= 5) newPeriod = '5d';
          else if (diffDays <= 30) newPeriod = '1mo';
          else if (diffDays <= 90) newPeriod = '3mo';
          else if (diffDays <= 180) newPeriod = '6mo';
          else if (diffDays <= 365) newPeriod = '1y';
          else newPeriod = '2y';

          setPeriod(newPeriod);
        }
      }
    } else {
      fetchHoldings();
    }
  }, [symbol, trades]); // specific dependency on trades to recalculate if they load later

  useEffect(() => {
    if (selectedSymbol) {
      fetchHistoricalData(selectedSymbol, period);
    }
  }, [selectedSymbol, period]);

  useEffect(() => {
    if (selectedSymbol) {
      // Update historical data every minute
      const interval = setInterval(() => {
        fetchHistoricalData(selectedSymbol, period);
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [selectedSymbol, period]);

  const handleSymbolChange = (event: SelectChangeEvent) => {
    setSelectedSymbol(event.target.value);
  };

  const handlePeriodChange = (event: SelectChangeEvent) => {
    setPeriod(event.target.value);
  };

  if (!symbol && holdings.length === 0 && !loading) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Historical Price Chart
          </Typography>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <Typography variant="body1" color="textSecondary">
              No holdings found. Start trading to see historical price charts.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Historical Price Chart
          </Typography>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for candlestick chart
  const dates = historicalData.map(d => d.date);
  const opens = historicalData.map(d => d.open);
  const highs = historicalData.map(d => d.high);
  const lows = historicalData.map(d => d.low);
  const closes = historicalData.map(d => d.close);
  const volumes = historicalData.map(d => d.volume);

  // Calculate price change for color coding
  const priceChange = historicalData.length > 1
    ? historicalData[historicalData.length - 1].close - historicalData[0].close
    : 0;
  const priceChangePercent = historicalData.length > 1
    ? ((historicalData[historicalData.length - 1].close - historicalData[0].close) / historicalData[0].close) * 100
    : 0;

  const candlestickData = [{
    type: 'candlestick' as const,
    x: dates,
    open: opens,
    high: highs,
    low: lows,
    close: closes,
    name: selectedSymbol,
    increasing: { line: { color: '#4caf50' } },
    decreasing: { line: { color: '#f44336' } },
    hovertemplate:
      '<b>%{x}</b><br>' +
      'Open: $%{open:.2f}<br>' +
      'High: $%{high:.2f}<br>' +
      'Low: $%{low:.2f}<br>' +
      'Close: $%{close:.2f}<br>' +
      '<extra></extra>'
  }];

  // Volume bar chart (secondary y-axis)
  const volumeData = [{
    type: 'bar' as const,
    x: dates,
    y: volumes,
    name: 'Volume',
    yaxis: 'y2',
    marker: { color: 'rgba(158, 158, 158, 0.3)' },
    hovertemplate:
      '<b>%{x}</b><br>' +
      'Volume: %{y:,.0f}<br>' +
      '<extra></extra>'
  }];

  // Purchase markers
  const buyTrades = trades.filter(t => t.action === 'BUY' && t.symbol === selectedSymbol);
  const markerData = buyTrades.length > 0 ? [{
    type: 'scatter' as const,
    mode: 'markers' as const,
    x: buyTrades.map(t => t.executed_at),
    y: buyTrades.map(t => t.price),
    name: 'Buy Point',
    marker: {
      symbol: 'triangle-up',
      size: 12,
      color: '#00C805', // Bright green
      line: {
        color: '#FFFFFF',
        width: 1
      }
    },
    hovertemplate:
      '<b>Buy Executed</b><br>' +
      'Date: %{x}<br>' +
      'Price: $%{y:.2f}<br>' +
      '<extra></extra>'
  }] : [];

  const layout = {
    title: {
      text: `${selectedSymbol} - Historical Price Movement`,
      font: { size: 18, color: '#333' }
    },
    font: { family: 'Roboto, sans-serif' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { t: 60, b: 50, l: 60, r: 60 },
    height: height,
    xaxis: {
      title: 'Date',
      rangeslider: { visible: false },
      showgrid: true,
      gridcolor: 'rgba(128,128,128,0.2)'
    },
    yaxis: {
      title: 'Price ($)',
      side: 'left' as const,
      showgrid: true,
      gridcolor: 'rgba(128,128,128,0.2)'
    },
    yaxis2: {
      title: 'Volume',
      side: 'right' as const,
      overlaying: 'y' as const,
      showgrid: false,
      tickformat: '.2s'
    },
    legend: {
      x: 0,
      y: 1,
      bgcolor: 'rgba(255,255,255,0.8)'
    }
  } as any;

  const config = {
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d'],
    responsive: true,
  } as any;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Historical Price Chart
          </Typography>

          <Box display="flex" gap={2} alignItems="center">
            {priceChange !== 0 && (
              <Chip
                label={`${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`}
                color={priceChange >= 0 ? 'success' : 'error'}
                size="small"
              />
            )}

            {showToolbar && (
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <Select
                  value={selectedSymbol}
                  onChange={handleSymbolChange}
                  displayEmpty
                >
                  {holdings.map((holding) => (
                    <MenuItem key={holding.symbol} value={holding.symbol}>
                      {holding.symbol}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={period}
                onChange={handlePeriodChange}
              >
                {periods.map((p) => (
                  <MenuItem key={p.value} value={p.value}>
                    {p.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        ) : historicalData.length > 0 ? (
          <>
            <Plot
              // Add a unique divId to prevent collision and handle unmounting better
              divId={`chart-${selectedSymbol}-${period}`}
              data={[...candlestickData, ...volumeData, ...markerData]}
              layout={layout}
              config={config}
              style={{ width: '100%', height: `${height}px` }}
              useResizeHandler={true}
            />

            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              Updates every minute • Candlestick chart shows OHLC data • Volume bars on secondary axis
            </Typography>
          </>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <Typography variant="body1" color="textSecondary">
              No historical data available for {selectedSymbol}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default HistoricalChart;