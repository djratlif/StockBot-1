import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
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

const HistoricalChart: React.FC = () => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [period, setPeriod] = useState<string>('1mo');
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
      const holdingsData = await portfolioAPI.getHoldings();
      setHoldings(holdingsData);
      
      // Set the first holding as default selected symbol
      if (holdingsData.length > 0 && !selectedSymbol) {
        setSelectedSymbol(holdingsData[0].symbol);
      }
    } catch (err) {
      console.error('Error fetching holdings:', err);
      setError('Failed to load holdings');
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
    fetchHoldings();
  }, []);

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

  if (holdings.length === 0) {
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

  const layout = {
    title: {
      text: `${selectedSymbol} - Historical Price Movement`,
      font: { size: 18, color: '#333' }
    },
    font: { family: 'Roboto, sans-serif' },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { t: 60, b: 50, l: 60, r: 60 },
    height: 500,
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
              data={[...candlestickData, ...volumeData]}
              layout={layout}
              config={config}
              style={{ width: '100%', height: '500px' }}
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