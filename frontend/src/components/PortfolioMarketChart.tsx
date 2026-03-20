import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, useTheme } from '@mui/material';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// We fetch directly alongside the other portfolioAPI routes. Let's assume you've configured proxy or base url.
import axios from 'axios';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface MarketComparisonData {
    labels: string[];
    portfolio_pct: number[];
    market_pct: number[];
}

function buildOptions(theme: any, minVal: number, maxVal: number, pad: number) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index' as const, intersect: false },
        plugins: {
            legend: {
                display: true,
                position: 'top' as const,
                labels: {
                    color: theme.palette.text.primary,
                    usePointStyle: true,
                    padding: 16,
                },
            },
            tooltip: {
                backgroundColor: theme.palette.background.paper,
                titleColor: theme.palette.text.primary,
                bodyColor: theme.palette.text.secondary,
                borderColor: theme.palette.divider,
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true,
                callbacks: {
                    label: (context: any) => {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += context.parsed.y.toFixed(2) + '%';
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false, drawBorder: false },
                ticks: { color: theme.palette.text.secondary, maxRotation: 45, minRotation: 45 }
            },
            y: {
                grid: { color: theme.palette.divider, drawBorder: false },
                ticks: {
                    color: theme.palette.text.secondary,
                    callback: (value: any) => {
                        return value + '%';
                    }
                },
                min: minVal < 0 ? minVal - pad : undefined,
                max: maxVal > 0 ? maxVal + pad : undefined,
            }
        }
    };
}

const PortfolioMarketChart: React.FC = () => {
    const theme = useTheme();
    const [data, setData] = useState<MarketComparisonData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchComparison = async () => {
            try {
                // Ensure auth token is passed if required
                const token = localStorage.getItem('token');
                const response = await axios.get<MarketComparisonData>('/api/portfolio/market-comparison?period=1W', {
                    headers: token ? { Authorization: `Bearer ${token}` } : {}
                });
                setData(response.data);
            } catch (err: any) {
                console.error("Failed to load market comparison", err);
                setError("Failed to track total portfolio market trend.");
            } finally {
                setLoading(false);
            }
        };

        fetchComparison();
    }, []);

    if (loading) {
        return (
            <Box sx={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !data || data.labels.length === 0) {
        return (
            <Box sx={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper', borderRadius: 2 }}>
                <Typography color="textSecondary">{error || "No market comparison performance available."}</Typography>
            </Box>
        );
    }

    const { labels, portfolio_pct, market_pct } = data;

    const datasets = [
        {
            label: 'Total Portfolio Growth (%)',
            data: portfolio_pct,
            borderColor: '#1976d2',
            backgroundColor: 'rgba(25, 118, 210, 0.1)',
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3
        },
        {
            label: 'Market SPY Growth (%)',
            data: market_pct,
            borderColor: '#ed6c02',
            backgroundColor: 'rgba(237, 108, 2, 0.1)',
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3
        }
    ];

    const allValues = [...portfolio_pct, ...market_pct];
    const minVal = Math.min(...allValues, 0);
    const maxVal = Math.max(...allValues, 0);
    const pad = Math.max(Math.abs(maxVal), Math.abs(minVal)) * 0.1 || 1;

    const chartData = { labels, datasets };
    const chartOptions = buildOptions(theme, minVal, maxVal, pad);

    return (
        <Box sx={{ height: 350, width: '100%', mt: 2 }}>
            <Line data={chartData} options={chartOptions as any} />
        </Box>
    );
};

export default PortfolioMarketChart;
