import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    TextField,
    Avatar,
    Divider,
    Alert,
    CircularProgress,
    Grid
} from '@mui/material';
import { Security, Person } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { botAPI } from '../services/api';
import type { BotConfig } from '../services/api';

const Account: React.FC = () => {
    const { user } = useAuth();
    const [config, setConfig] = useState<BotConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                setLoading(true);
                const configData = await botAPI.getBotConfig();
                setConfig(configData);
            } catch (err) {
                setError('Failed to load API configurations.');
                console.error('Config fetch error:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleChange = (field: keyof BotConfig, value: any) => {
        if (!config) return;
        setConfig({ ...config, [field]: value });
    };

    const saveField = async (field: keyof BotConfig, value: any) => {
        if (!config) return;
        try {
            const updated = await botAPI.updateBotConfig({ [field]: value });
            setConfig(updated);
        } catch (err) {
            setError(`Failed to save ${field} securely.`);
            console.error('Save error:', err);
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ pb: 6, maxWidth: 800, mx: 'auto' }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                Account Settings
            </Typography>
            <Typography variant="body2" color="textSecondary" mb={4}>
                Manage your user profile and active trading API keys securely.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            {/* User Profile Info */}
            <Card sx={{ mb: 4 }}>
                <CardContent sx={{ p: 4 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                        <Person sx={{ mr: 2, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                            Profile
                        </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={3}>
                        <Avatar
                            src={user?.picture}
                            alt={user?.name}
                            sx={{ width: 80, height: 80 }}
                        >
                            {user?.name?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                            <Typography variant="h5" fontWeight="bold">
                                {user?.name}
                            </Typography>
                            <Typography variant="body1" color="textSecondary">
                                {user?.email}
                            </Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* API Keys */}
            <Card>
                <CardContent sx={{ p: 4 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                        <Security sx={{ mr: 2, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                            AI Provider API Keys
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" mb={4}>
                        These keys are required for the AI bots to operate. They are securely saved and utilized during trading cycles.
                    </Typography>

                    <Grid container spacing={4}>
                        {/* OpenAI */}
                        <Grid item xs={12}>
                            <Typography variant="subtitle1" fontWeight="bold" mb={1}>OpenAI (ChatGPT)</Typography>
                            <TextField
                                fullWidth
                                placeholder="sk-..."
                                type="password"
                                value={config?.openai_api_key || ''}
                                onChange={(e) => handleChange('openai_api_key', e.target.value)}
                                onBlur={(e) => saveField('openai_api_key', e.target.value)}
                                helperText="Powers the primary trading agent analysis logic."
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        {/* Google Gemini */}
                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" fontWeight="bold" mb={1}>Google Gemini</Typography>
                            <TextField
                                fullWidth
                                placeholder="AIza..."
                                type="password"
                                value={config?.gemini_api_key || ''}
                                onChange={(e) => handleChange('gemini_api_key', e.target.value)}
                                onBlur={(e) => saveField('gemini_api_key', e.target.value)}
                                helperText="Optionally run Google Gemini models for aggregated trading consensus."
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        {/* Anthropic */}
                        <Grid item xs={12}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle1" fontWeight="bold" mb={1}>Anthropic Claude</Typography>
                            <TextField
                                fullWidth
                                placeholder="sk-ant-..."
                                type="password"
                                value={config?.anthropic_api_key || ''}
                                onChange={(e) => handleChange('anthropic_api_key', e.target.value)}
                                onBlur={(e) => saveField('anthropic_api_key', e.target.value)}
                                helperText="Optionally run Anthropic Claude models for aggregated trading consensus."
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    </Grid>

                </CardContent>
            </Card>
        </Box>
    );
};

export default Account;
