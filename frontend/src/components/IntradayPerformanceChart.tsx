import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Typography,
    CircularProgress,
    Chip,
    Tabs,
    Tab,
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
import { tradesAPI } from '../services/api';
import type { IntradayPerformance } from '../services/api';

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
    OPENAI: { border: '#2196f3', background: 'rgba(33, 150, 243, 0.08)', label: 'OpenAI' },
    GEMINI: { border: '#e91e8c', background: 'rgba(233, 30, 140, 0.08)', label: 'Gemini' },
    ANTHROPIC: { border: '#ff9800', background: 'rgba(255, 152, 0, 0.08)', label: 'Claude' },
};

// Shared chart options factory
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
                    font: { size: 12 },
                    usePointStyle: true,
                    pointStyleWidth: 10,
                    padding: 16,
                },
            },
            tooltip: {
                backgroundColor: 'rgba(15,15,30,0.95)',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                titleColor: '#ffffff',
                bodyColor: '#cccccc',
                padding: 10,
                callbacks: {
                    title: (ctx: any) => `Time: ${ctx[0]?.label}`,
                    label: (ctx: any) => {
                        const val = ctx.parsed.y;
                        const sign = val >= 0 ? '+' : '';
                        return ` ${ctx.dataset.label}: ${sign}$${val.toFixed(2)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                ticks: {
                    color: theme.palette.text.secondary,
                    font: { size: 11 },
                    maxTicksLimit: 10,
                    maxRotation: 0,
                },
                grid: { color: 'rgba(255,255,255,0.05)' },
            },
            y: {
                min: minVal - pad,
                max: maxVal + pad,
                ticks: {
                    color: theme.palette.text.secondary,
                    font: { size: 11 },
                    callback: (val: any) => {
                        const sign = val >= 0 ? '+' : '';
                        return `${sign}$${Number(val).toFixed(2)}`;
                    },
                },
                grid: { color: 'rgba(255,255,255,0.05)' },
            },
        },
    };
}

const IntradayPerformanceChart: React.FC = () => {
    const theme = useTheme();
    const [data, setData] = useState<IntradayPerformance | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    const fetchData = async () => {
        try {
            const result = await tradesAPI.getIntradayPerformance();
            setData(result);
        } catch (err) {
            console.error('Failed to fetch intraday performance:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        intervalRef.current = setInterval(fetchData, 30000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
                <CircularProgress size={28} />
            </Box>
        );
    }

    if (!data) {
        return (
            <Typography variant="body2" color="textSecondary" align="center">
                No intraday data available
            </Typography>
        );
    }

    // ── TAB 0: Realized time axis ────────────────────────────────────────────
    const realizedTimes = new Set<string>();
    Object.values(data.providers).forEach((pts) => pts.forEach((p) => realizedTimes.add(p.time)));
    const sortedRealizedTimes = Array.from(realizedTimes).sort();
    const realizedLabels = sortedRealizedTimes.map((t) => t.substring(0, 5));

    const realizedDatasets = Object.entries(data.providers)
        .filter(([, pts]) => pts.length > 0)
        .map(([provider, pts]) => {
            const colors = PROVIDER_COLORS[provider] || { border: '#fff', background: 'rgba(255,255,255,0.08)', label: provider };
            const ptMap = new Map(pts.map((p) => [p.time, p.cumulative_pnl]));
            let lastVal = 0;
            const values = sortedRealizedTimes.map((t) => {
                if (ptMap.has(t)) lastVal = ptMap.get(t)!;
                return lastVal;
            });
            return {
                label: colors.label,
                data: values,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: colors.border,
                tension: 0.2,
                fill: false,
            };
        });

    // ── TAB 1: Total P&L from PortfolioSnapshot time-series ─────────────────
    // Uses saved snapshots (every 5 min) so the line actually fluctuates with prices.
    const totalSnapSeries: Record<string, { time: string; total_pnl: number }[]> = (data as any).total_series ?? {};

    const totalTimes = new Set<string>();
    Object.values(totalSnapSeries).forEach((pts) => pts.forEach((p) => totalTimes.add(p.time)));
    // add now_time as trailing endpoint
    totalTimes.add(data.now_time);
    const sortedTotalTimes = Array.from(totalTimes).sort();
    const totalLabels = sortedTotalTimes.map((t) => t.substring(0, 5));

    const totalDatasets = Object.entries(totalSnapSeries)
        .filter(([, pts]) => pts.length > 0)
        .map(([provider, pts]) => {
            const colors = PROVIDER_COLORS[provider] || { border: '#fff', background: 'rgba(255,255,255,0.08)', label: provider };
            const ptMap = new Map(pts.map((p) => [p.time, p.total_pnl]));
            // Append current unrealized as final data point at now_time
            const currentTotal = (pts[pts.length - 1]?.total_pnl ?? 0);
            ptMap.set(data.now_time, parseFloat((currentTotal).toFixed(2)));
            let lastVal: number | null = null;
            const values = sortedTotalTimes.map((t) => {
                if (ptMap.has(t)) lastVal = ptMap.get(t)!;
                return lastVal;
            });
            return {
                label: colors.label,
                data: values,
                borderColor: colors.border,
                backgroundColor: colors.background,
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: colors.border,
                tension: 0.2,
                fill: false,
                spanGaps: true,
            };
        });

    // ── Y-axis range ────────────────────────────────────────────────────────
    const activeDatasets = tab === 0 ? realizedDatasets : totalDatasets;
    const allValues = activeDatasets.flatMap((d) => (d.data as (number | null)[]).filter((v): v is number => v !== null));
    const minVal = Math.min(0, ...allValues);
    const maxVal = Math.max(0, ...allValues);
    const pad = Math.max(Math.abs(maxVal - minVal) * 0.15, 0.5);

    const activeLabels = tab === 0 ? realizedLabels : totalLabels;
    const options = buildOptions(theme, minVal, maxVal, pad);

    // ── Summary chips ───────────────────────────────────────────────────────
    const chips: { provider: string; realized: number; unrealized: number }[] = Object.entries(data.providers).map(([p, pts]) => ({
        provider: p,
        realized: pts.length > 0 ? pts[pts.length - 1].cumulative_pnl : 0,
        unrealized: data.unrealized_pnl?.[p] ?? 0,
    }));

    return (
        <Box>
            {/* Tabs */}
            <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                textColor="inherit"
                indicatorColor="primary"
                sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0, px: 2, fontSize: '0.82rem' } }}
            >
                <Tab label="Realized Gains" />
                <Tab label="Total P&L (incl. Open Positions)" />
            </Tabs>

            {/* Summary chips */}
            <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                {chips.map(({ provider, realized, unrealized }) => {
                    const colors = PROVIDER_COLORS[provider] || { label: provider };
                    const displayVal = tab === 0 ? realized : realized + unrealized;
                    const isPos = displayVal >= 0;
                    return (
                        <Chip
                            key={provider}
                            label={`${colors.label}: ${isPos ? '+' : ''}$${displayVal.toFixed(2)}`}
                            size="small"
                            sx={{
                                bgcolor: isPos ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                                color: isPos ? '#4caf50' : '#f44336',
                                borderColor: isPos ? '#4caf50' : '#f44336',
                                border: '1px solid',
                                fontWeight: 'bold',
                                fontSize: '0.75rem',
                            }}
                        />
                    );
                })}
                <Typography variant="caption" sx={{ color: 'text.disabled', alignSelf: 'center', ml: 'auto' }}>
                    {tab === 0
                        ? 'Completed sell trades only · Updates every 30s'
                        : 'Realized + unrealized · Sampled every 5 min · Updates every 30s'}
                </Typography>
            </Box>

            {/* Chart */}
            <Box sx={{ height: 260, position: 'relative' }}>
                <Line
                    data={{ labels: activeLabels, datasets: tab === 0 ? realizedDatasets : totalDatasets }}
                    options={options as any}
                />
            </Box>
        </Box>
    );
};

export default IntradayPerformanceChart;
