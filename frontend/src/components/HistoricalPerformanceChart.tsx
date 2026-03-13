import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    useTheme,
} from '@mui/material';
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
import { tradesAPI, HistoricalPnLPoint } from '../services/api';

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

const PROVIDER_COLORS: Record<string, { border: string; background: string; label: string }> = {
    OPENAI: { border: '#2196f3', background: 'rgba(33, 150, 243, 0.08)', label: 'GPT-4o Mini' },
    GEMINI: { border: '#e91e8c', background: 'rgba(233, 30, 140, 0.08)', label: 'Gemini 2.5 Flash' },
    ANTHROPIC: { border: '#ff9800', background: 'rgba(255, 152, 0, 0.08)', label: 'Claude 3.5 Haiku' },
};

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
                            label += new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                signDisplay: 'always'
                            }).format(context.parsed.y);
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
                        return new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            maximumSignificantDigits: 3
                        }).format(value);
                    }
                },
                min: minVal < 0 ? minVal - pad : undefined,
                max: maxVal > 0 ? maxVal + pad : undefined,
            }
        }
    };
}

const HistoricalPerformanceChart: React.FC = () => {
    const theme = useTheme();
    const [data, setData] = useState<HistoricalPnLPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const history = await tradesAPI.getHistoricalPnL();
                setData(history);
            } catch (err: any) {
                console.error("Failed to load historical PnL", err);
                setError("Failed to load historical PnL track record.");
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    if (loading) {
        return (
            <Box sx={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || data.length === 0) {
        return (
            <Box sx={{ height: 350, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper', borderRadius: 2 }}>
                <Typography color="textSecondary">{error || "No historical multi-day correlation data available."}</Typography>
            </Box>
        );
    }

    const labels = data.map(d => d.date);
    const datasets = ['OPENAI', 'GEMINI', 'ANTHROPIC'].map(provider => {
        const pts = data.map(d => (d as any)[provider] || 0);
        return {
            label: PROVIDER_COLORS[provider]?.label || provider,
            data: pts,
            borderColor: PROVIDER_COLORS[provider]?.border || '#999',
            backgroundColor: PROVIDER_COLORS[provider]?.background || 'transparent',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            fill: false,
            tension: 0.3
        };
    });

    const allValues = datasets.flatMap(d => d.data);
    const minVal = Math.min(...allValues, 0);
    const maxVal = Math.max(...allValues, 0);
    const pad = Math.max(Math.abs(maxVal), Math.abs(minVal)) * 0.1;

    const chartData = { labels, datasets };
    const chartOptions = buildOptions(theme, minVal, maxVal, pad);

    return (
        <Box sx={{ height: 350, width: '100%', mt: 2 }}>
            <Line data={chartData} options={chartOptions as any} />
        </Box>
    );
};

export default HistoricalPerformanceChart;
