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
    Grid,
    Button,
    Snackbar
} from '@mui/material';
import { Security, Person, Email, Save } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { botAPI } from '../services/api';
import type { BotConfig } from '../services/api';

const Account: React.FC = () => {
    const { user } = useAuth();
    const [config, setConfig] = useState<BotConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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

    const handleSaveSection = async (section: string) => {
        if (!config) return;
        try {
            setSaving(true);
            setError(null);
            const updated = await botAPI.updateBotConfig(config);
            setConfig(updated);
            setSaveSuccess(`${section} saved successfully!`);
        } catch (err) {
            setError(`Failed to save ${section}.`);
            console.error('Save error:', err);
        } finally {
            setSaving(false);
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
                                helperText="Optionally run Anthropic Claude models for aggregated trading consensus."
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    </Grid>

                    <Box mt={3} display="flex" justifyContent="flex-end">
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<Save />}
                            onClick={() => handleSaveSection('API Keys')}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save API Keys'}
                        </Button>
                    </Box>

                </CardContent>
            </Card>

            {/* Email Notifications */}
            <Card sx={{ mt: 4 }}>
                <CardContent sx={{ p: 4 }}>
                    <Box display="flex" alignItems="center" mb={3}>
                        <Email sx={{ mr: 2, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight="bold">
                            Email Notifications
                        </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" mb={4}>
                        Configure SMTP credentials to receive the Daily Performance Report automatically at 4:05 PM EST. If using Gmail, you must generate an App Password.
                    </Typography>

                    <Grid container spacing={4}>
                        {/* SMTP Email */}
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle1" fontWeight="bold" mb={1}>SMTP Email Address</Typography>
                            <TextField
                                fullWidth
                                placeholder="name@gmail.com"
                                type="email"
                                value={config?.smtp_email || ''}
                                onChange={(e) => handleChange('smtp_email', e.target.value)}
                                helperText="The email address handling the outbound dispatch (and receiving the report if same)."
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>

                        {/* SMTP Password */}
                        <Grid item xs={12} md={6}>
                            <Typography variant="subtitle1" fontWeight="bold" mb={1}>SMTP App Password</Typography>
                            <TextField
                                fullWidth
                                placeholder="xxxx xxxx xxxx xxxx"
                                type="password"
                                value={config?.smtp_password || ''}
                                onChange={(e) => handleChange('smtp_password', e.target.value)}
                                helperText="Your 16-character Google App Password (not your standard sign-in password)."
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    </Grid>

                    <Box mt={3} display="flex" justifyContent="flex-end">
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<Save />}
                            onClick={() => handleSaveSection('Email Settings')}
                            disabled={saving}
                        >
                            {saving ? 'Saving...' : 'Save Email Settings'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            <Snackbar
                open={!!saveSuccess}
                autoHideDuration={4000}
                onClose={() => setSaveSuccess(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity="success" sx={{ width: '100%' }}>
                    {saveSuccess}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Account;
