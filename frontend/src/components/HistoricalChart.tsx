import React, { useState, useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi, CandlestickSeries, HistogramSeries, createSeriesMarkers, SeriesMarker } from 'lightweight-charts';
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
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(symbol || '');
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
      if (symbol) {
        if (!selectedSymbol) setSelectedSymbol(symbol);
        return;
      }

      const holdingsData = await portfolioAPI.getHoldings();
      setHoldings(holdingsData);

      if (holdingsData.length > 0 && !selectedSymbol) {
        setSelectedSymbol(holdingsData[0].symbol);
      }
    } catch (err) {
      console.error('Error fetching holdings:', err);
      if (!symbol) setError('Failed to load holdings');
    }
  };

  const fetchHistoricalData = async (symbol: string, selectedPeriod: string) => {
    if (!symbol) return;

    try {
      // Don't set loading repeatedly for silent background updates
      if (historicalData.length === 0 || selectedSymbol !== symbol) {
        setLoading(true);
      }
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

      if (trades && trades.length > 0) {
        const buyTrades = trades.filter(t => t.symbol === symbol && t.action === 'BUY');
        if (buyTrades.length > 0) {
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
  }, [symbol, trades]);

  useEffect(() => {
    if (selectedSymbol) {
      fetchHistoricalData(selectedSymbol, period);
    }
  }, [selectedSymbol, period]);

  useEffect(() => {
    if (selectedSymbol) {
      const interval = setInterval(() => {
        fetchHistoricalData(selectedSymbol, period);
      }, 60000);

      return () => clearInterval(interval);
    }
  }, [selectedSymbol, period]);

  // Lightweight Charts Initialization
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: 'rgba(42, 46, 57, 0.2)' },
        horzLines: { color: 'rgba(42, 46, 57, 0.2)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#4caf50',
      downColor: '#f44336',
      borderVisible: false,
      wickUpColor: '#4caf50',
      wickDownColor: '#f44336',
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // set as an overlay by setting a blank priceScaleId
    });

    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.8, // highest point of the series will be at 80% of the chart height
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [height]);

  // Update Data and Markers on Chart
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || historicalData.length === 0) return;

    // Formatting date to Unix Timestamp (seconds) for lightweight-charts
    const formattedData = historicalData.map(d => ({
      time: Math.floor(new Date(d.date).getTime() / 1000),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    // Sort ascending by time
    formattedData.sort((a, b) => a.time - b.time);

    const formattedVolume = historicalData.map(d => ({
      time: Math.floor(new Date(d.date).getTime() / 1000),
      value: d.volume,
      color: d.close > d.open ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)',
    })).sort((a, b) => a.time - b.time);

    // Filter out duplicates (lightweight-charts requires strictly increasing time)
    const uniqueFormattedData = formattedData.filter((v, i, a) => a.findIndex(t => (t.time === v.time)) === i);
    const uniqueFormattedVolume = formattedVolume.filter((v, i, a) => a.findIndex(t => (t.time === v.time)) === i);

    try {
      candleSeriesRef.current.setData(uniqueFormattedData as any);
      volumeSeriesRef.current.setData(uniqueFormattedVolume as any);
      chartRef.current?.timeScale().fitContent();

      // Plot Trade Markers
      if (trades && trades.length > 0) {
        // Find trades for this symbol that exist within the time window
        const relevantTrades = trades.filter(t => t.symbol === selectedSymbol);

        const markers: any[] = relevantTrades.map(t => {
          const isBuy = t.action === 'BUY';
          // Find the closest candlestick time that is on or before the trade time, 
          // or just map directly if intraday markers are supported (lightweight charts ties markers to exact data point times)
          // To be safe and ensure the marker shows up, we should snap it to the exact time of the nearest data point.
          const tradeTime = Math.floor(new Date(t.executed_at).getTime() / 1000);

          let closestPoint = uniqueFormattedData[0];
          let minDiff = Infinity;
          for (const point of uniqueFormattedData) {
            const diff = Math.abs(point.time - tradeTime);
            if (diff < minDiff) {
              minDiff = diff;
              closestPoint = point;
            }
          }

          return {
            time: closestPoint ? closestPoint.time : tradeTime,
            position: isBuy ? 'belowBar' : 'aboveBar',
            color: isBuy ? '#2196F3' : '#FF9800',
            shape: isBuy ? 'arrowUp' : 'arrowDown',
            text: `${isBuy ? 'B' : 'S'} @ ${t.price}`,
          };
        }).sort((a, b) => a.time - b.time);

        // Remove duplicates if multiple trades snapped to the same data point
        const uniqueMarkers = markers.filter((v, i, a) => a.findIndex(t => (t.time === v.time)) === i);

        if (uniqueMarkers.length > 0) {
          let sm = (candleSeriesRef.current as any).__markersPlugin;
          if (!sm) {
            sm = createSeriesMarkers(candleSeriesRef.current as any);
            (candleSeriesRef.current as any).__markersPlugin = sm;
          }
          sm.setMarkers(uniqueMarkers);
        }
      }
    } catch (e) {
      console.error("Error setting chart data", e, uniqueFormattedData);
    }
  }, [historicalData, trades, selectedSymbol]);

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

  const priceChange = historicalData.length > 1
    ? historicalData[0].close - historicalData[historicalData.length - 1].close // Alpha Vantage may return descending
    : 0;
  const priceChangePercent = historicalData.length > 1 && historicalData[historicalData.length - 1].close !== 0
    ? (priceChange / historicalData[historicalData.length - 1].close) * 100
    : 0;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
          <Typography variant="h6">
            Historical Price Chart
          </Typography>

          <Box display="flex" gap={2} alignItems="center">
            {historicalData.length > 1 && (
              <Chip
                label={`${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)} (${priceChangePercent >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%)`}
                color={priceChange >= 0 ? 'success' : 'error'}
                size="small"
              />
            )}

            {showToolbar && holdings.length > 0 && (
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

        <Box position="relative" minHeight={`${height}px`}>
          {loading && (
            <Box
              position="absolute"
              top={0} left={0} right={0} bottom={0}
              display="flex"
              justifyContent="center"
              alignItems="center"
              bgcolor="rgba(0,0,0,0.3)"
              zIndex={10}
            >
              <CircularProgress />
            </Box>
          )}

          <Box style={{ display: historicalData.length > 0 ? 'block' : 'none' }}>
            <div ref={chartContainerRef} style={{ width: '100%', height: `${height}px` }} />
            <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
              TradingView Lightweight Charts • Candlestick & Volume
            </Typography>
          </Box>

          {!loading && historicalData.length === 0 && (
            <Box position="absolute" top={0} left={0} right={0} bottom={0} display="flex" justifyContent="center" alignItems="center">
              <Typography variant="body1" color="textSecondary">
                No historical data available for {selectedSymbol}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default HistoricalChart;