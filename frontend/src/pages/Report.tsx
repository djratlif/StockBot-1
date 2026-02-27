import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Chip,
    Alert
} from '@mui/material';
import { portfolioAPI, DailyReport } from '../services/api';

const Report: React.FC = () => {
    const [report, setReport] = useState<DailyReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchReport = async () => {
            try {
                const data = await portfolioAPI.getDailyReport();
                setReport(data);
                setError(null);
            } catch (err: any) {
                setError(err.response?.data?.detail || 'Failed to load daily report');
            } finally {
                setLoading(false);
            }
        };
        fetchReport();
    }, []);

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (!report) {
        return <Typography>No report data available.</Typography>;
    }

    const sortedModels = [...report.models].sort((a, b) => b.score - a.score);

    const getProviderColor = (provider: string) => {
        switch (provider) {
            case 'OPENAI': return '#1976d2';
            case 'GEMINI': return '#9c27b0';
            case 'ANTHROPIC': return '#ed6c02';
            default: return '#757575';
        }
    };

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h4" gutterBottom>
                Daily Performance Report
            </Typography>
            <Typography variant="subtitle1" color="textSecondary" gutterBottom>
                Trades and AI model performance for {report.date}
            </Typography>

            <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
                AI Model Leaderboard
            </Typography>
            <Grid container spacing={3}>
                {sortedModels.map((model, index) => (
                    <Grid item xs={12} md={4} key={model.provider}>
                        <Card sx={{
                            borderTop: `4px solid ${getProviderColor(model.provider)}`,
                            position: 'relative',
                            overflow: 'visible'
                        }}>
                            {index === 0 && model.score > 0 && (
                                <Chip
                                    label="🥇 1st Place"
                                    color="warning"
                                    sx={{ position: 'absolute', top: -12, right: 16 }}
                                />
                            )}
                            {index === 1 && model.score > 0 && (
                                <Chip
                                    label="🥈 2nd Place"
                                    sx={{ position: 'absolute', top: -12, right: 16, bgcolor: '#e0e0e0', color: 'black' }}
                                />
                            )}
                            {index === 2 && model.score > 0 && (
                                <Chip
                                    label="🥉 3rd Place"
                                    sx={{ position: 'absolute', top: -12, right: 16, bgcolor: '#cd7f32', color: 'white' }}
                                />
                            )}
                            <CardContent>
                                <Typography variant="h6" sx={{ color: getProviderColor(model.provider) }}>
                                    {model.provider}
                                </Typography>
                                <Typography variant="h3" sx={{ my: 2 }}>
                                    {model.score} <Typography component="span" variant="h6" color="textSecondary">pts</Typography>
                                </Typography>

                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="textSecondary">Open PnL</Typography>
                                        <Typography variant="body1" sx={{ color: model.open_pnl >= 0 ? 'success.main' : 'error.main', fontWeight: 'bold' }}>
                                            ${model.open_pnl.toFixed(2)}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="textSecondary">Win Rate</Typography>
                                        <Typography variant="body1" fontWeight="bold">
                                            {model.win_rate.toFixed(1)}%
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="textSecondary">Trades Today</Typography>
                                        <Typography variant="body1">{model.trades_today}</Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="body2" color="textSecondary">Active Pos</Typography>
                                        <Typography variant="body1">{model.total_positions}</Typography>
                                    </Grid>
                                </Grid>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Typography variant="h5" sx={{ mt: 6, mb: 2 }}>
                Today's Trades
            </Typography>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Time</TableCell>
                            <TableCell>Symbol</TableCell>
                            <TableCell>Action</TableCell>
                            <TableCell>Quantity</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Total</TableCell>
                            <TableCell>AI Provider</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {report.trades.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center">No trades executed today.</TableCell>
                            </TableRow>
                        ) : (
                            report.trades.map((trade) => (
                                <TableRow key={trade.id}>
                                    <TableCell>{new Date(trade.executed_at).toLocaleTimeString()}</TableCell>
                                    <TableCell sx={{ fontWeight: 'bold' }}>{trade.symbol}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={trade.action}
                                            size="small"
                                            color={trade.action === 'BUY' ? 'success' : 'error'}
                                        />
                                    </TableCell>
                                    <TableCell>{trade.quantity}</TableCell>
                                    <TableCell>${trade.price.toFixed(2)}</TableCell>
                                    <TableCell>${trade.total_amount.toFixed(2)}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={trade.ai_provider || 'OPENAI'}
                                            size="small"
                                            sx={{
                                                bgcolor: getProviderColor(trade.ai_provider || 'OPENAI'),
                                                color: 'white',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default Report;
