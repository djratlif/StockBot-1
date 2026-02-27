import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Slider,
  InputAdornment,
  Divider,
} from '@mui/material';
import { PlayArrow, Stop, Warning, Settings, Security, AccessTime } from '@mui/icons-material';
import { botAPI, portfolioAPI } from '../services/api';
import type { BotConfig, BotStatus, PortfolioSummary } from '../services/api';

const Configuration: React.FC = () => {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const [configData, statusData, portfolioData] = await Promise.all([
        botAPI.getBotConfig(),
        botAPI.getBotStatus().catch(() => null),
        portfolioAPI.getPortfolioSummary().catch(() => null),
      ]);
      setConfig(configData);
      setBotStatus(statusData);
      setPortfolioSummary(portfolioData);
    } catch (err) {
      setError('Failed to load configuration data');
      console.error('Config error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBotToggle = async () => {
    if (!botStatus) return;

    try {
      if (botStatus.is_active) {
        await botAPI.stopBot();
      } else {
        await botAPI.startBot();
      }
      const updatedStatus = await botAPI.getBotStatus();
      setBotStatus(updatedStatus);
    } catch (err) {
      setError('Failed to toggle bot status');
      console.error('Bot toggle error:', err);
    }
  };

  const saveField = async (field: keyof BotConfig, value: any) => {
    if (!config) return;
    try {
      const updated = await botAPI.updateBotConfig({ [field]: value });
      setConfig(updated);
    } catch (err) {
      setError(`Failed to update ${field}`);
      console.error('Save error:', err);
    }
  };

  const handleChange = (field: keyof BotConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!config) {
    return (
      <Alert severity="error">
        Failed to load configuration
      </Alert>
    );
  }

  return (
    <Box sx={{ pb: 6 }}>
      {/* Page Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Bot Configuration
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Manage your AI assistant's trading strategy, boundaries, and risk management parameters.
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <Chip
            icon={botStatus?.is_active ? <PlayArrow /> : <Stop />}
            label={botStatus?.is_active ? 'Bot Active' : 'Bot Inactive'}
            color={botStatus?.is_active ? 'success' : 'default'}
            variant={botStatus?.is_active ? 'filled' : 'outlined'}
            sx={{ fontWeight: 'bold', px: 1 }}
          />
          <Button
            variant="contained"
            color={botStatus?.is_active ? 'error' : 'success'}
            startIcon={botStatus?.is_active ? <Stop /> : <PlayArrow />}
            onClick={handleBotToggle}
            disableElevation
            sx={{ fontWeight: 'bold' }}
          >
            {botStatus?.is_active ? 'Stop Trading' : 'Start Trading'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* AI Bots Configuration Full Width Row */}
        <Grid item xs={12}>
          <Card sx={{ mb: 0 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Security sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  AI Trading Bots & Allocation
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" mb={4}>
                Configure individual bot activity status, and define how much cash each bot is allowed to use.
              </Typography>
              <Grid container spacing={4}>
                {/* OpenAI */}
                <Grid item xs={12} md={4}>
                  <Box p={3} sx={{ bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box display="flex" justifyContent="space-between" mb={3}>
                      <Typography variant="subtitle1" fontWeight="bold">OpenAI (ChatGPT)</Typography>
                      <Chip
                        label={config.openai_active ? "Enabled" : "Disabled"}
                        color={config.openai_active ? "success" : "default"}
                        onClick={() => {
                          const active = !config.openai_active;
                          handleChange('openai_active', active);
                          saveField('openai_active', active);
                        }}
                        sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                      />
                    </Box>
                    <Box mt="auto">
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="subtitle2">Allocated Funds</Typography>
                        <Typography variant="subtitle2" color="primary" fontWeight="bold">
                          ${config.openai_allocation?.toFixed(0) || 0}
                        </Typography>
                      </Box>
                      <Slider
                        value={config.openai_allocation || 0}
                        max={portfolioSummary?.total_value || 10000}
                        step={50}
                        onChange={(e, val) => handleChange('openai_allocation', val as number)}
                        onChangeCommitted={(e, val) => saveField('openai_allocation', val as number)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => `$${v}`}
                      />
                    </Box>
                  </Box>
                </Grid>

                {/* Google Gemini */}
                <Grid item xs={12} md={4}>
                  <Box p={3} sx={{ bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box display="flex" justifyContent="space-between" mb={3}>
                      <Typography variant="subtitle1" fontWeight="bold">Google Gemini</Typography>
                      <Chip
                        label={config.gemini_active ? "Enabled" : "Disabled"}
                        color={config.gemini_active ? "secondary" : "default"}
                        onClick={() => {
                          const active = !config.gemini_active;
                          handleChange('gemini_active', active);
                          saveField('gemini_active', active);
                        }}
                        sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                      />
                    </Box>
                    <Box mt="auto">
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="subtitle2">Allocated Funds</Typography>
                        <Typography variant="subtitle2" color="secondary" fontWeight="bold">
                          ${config.gemini_allocation?.toFixed(0) || 0}
                        </Typography>
                      </Box>
                      <Slider
                        value={config.gemini_allocation || 0}
                        max={portfolioSummary?.total_value || 10000}
                        step={50}
                        color="secondary"
                        onChange={(e, val) => handleChange('gemini_allocation', val as number)}
                        onChangeCommitted={(e, val) => saveField('gemini_allocation', val as number)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => `$${v}`}
                      />
                    </Box>
                  </Box>
                </Grid>

                {/* Anthropic */}
                <Grid item xs={12} md={4}>
                  <Box p={3} sx={{ bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box display="flex" justifyContent="space-between" mb={3}>
                      <Typography variant="subtitle1" fontWeight="bold">Anthropic Claude</Typography>
                      <Chip
                        label={config.anthropic_active ? "Enabled" : "Disabled"}
                        color={config.anthropic_active ? "warning" : "default"}
                        onClick={() => {
                          const active = !config.anthropic_active;
                          handleChange('anthropic_active', active);
                          saveField('anthropic_active', active);
                        }}
                        sx={{ cursor: 'pointer', fontWeight: 'bold' }}
                      />
                    </Box>
                    <Box mt="auto">
                      <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="subtitle2">Allocated Funds</Typography>
                        <Typography variant="subtitle2" color="warning.main" fontWeight="bold">
                          ${config.anthropic_allocation?.toFixed(0) || 0}
                        </Typography>
                      </Box>
                      <Slider
                        value={config.anthropic_allocation || 0}
                        max={portfolioSummary?.total_value || 10000}
                        step={50}
                        color="warning"
                        onChange={(e, val) => handleChange('anthropic_allocation', val as number)}
                        onChangeCommitted={(e, val) => saveField('anthropic_allocation', val as number)}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => `$${v}`}
                      />
                    </Box>
                  </Box>
                </Grid>

              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* LEFT COLUMN: Trading Strategy & Schedule */}
        <Grid item xs={12} md={7}>
          {/* Trading Strategy Card */}
          <Card sx={{ mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Settings sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  Trading Strategy
                </Typography>
              </Box>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Strategy Profile</InputLabel>
                    <Select
                      value={config.strategy_profile || 'BALANCED'}
                      onChange={(e) => {
                        handleChange('strategy_profile', e.target.value);
                        saveField('strategy_profile', e.target.value);
                      }}
                      label="Strategy Profile"
                    >
                      <MenuItem value="BALANCED">Balanced</MenuItem>
                      <MenuItem value="AGGRESSIVE_DAY_TRADER">Aggressive Day Trader</MenuItem>
                      <MenuItem value="CONSERVATIVE_VALUE">Conservative Value</MenuItem>
                      <MenuItem value="MOMENTUM_SCALPER">Momentum Scalper</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Risk Tolerance</InputLabel>
                    <Select
                      value={config.risk_tolerance}
                      onChange={(e) => {
                        handleChange('risk_tolerance', e.target.value);
                        saveField('risk_tolerance', e.target.value);
                      }}
                      label="Risk Tolerance"
                    >
                      <MenuItem value="LOW">Low</MenuItem>
                      <MenuItem value="MEDIUM">Medium</MenuItem>
                      <MenuItem value="HIGH">High</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Max Daily Trades"
                    type="number"
                    value={config.max_daily_trades}
                    onChange={(e) => handleChange('max_daily_trades', parseInt(e.target.value))}
                    onBlur={(e) => saveField('max_daily_trades', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 50 }}
                    helperText="Limit the bot's activity per session."
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Minimum Cash Reserve"
                    type="number"
                    value={config.min_cash_reserve}
                    onChange={(e) => handleChange('min_cash_reserve', parseFloat(e.target.value))}
                    onBlur={(e) => saveField('min_cash_reserve', parseFloat(e.target.value))}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    inputProps={{ min: 0, step: 0.01 }}
                    helperText="Keep this amount uninvested at all times."
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Schedule Card */}
          <Card>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <AccessTime sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  Trading Window
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" mb={3}>
                The bot will only execute orders within these specified times (EST).
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Session Start"
                    type="time"
                    value={config.trading_hours_start}
                    onChange={(e) => {
                      handleChange('trading_hours_start', e.target.value);
                      saveField('trading_hours_start', e.target.value);
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Session End"
                    type="time"
                    value={config.trading_hours_end}
                    onChange={(e) => {
                      handleChange('trading_hours_end', e.target.value);
                      saveField('trading_hours_end', e.target.value);
                    }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT COLUMN: Limits & Danger Zone */}
        <Grid item xs={12} md={5}>
          {/* Risk Management Card */}
          <Card sx={{ mb: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" mb={3}>
                <Security sx={{ mr: 2, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  Portfolio Limits
                </Typography>
              </Box>

              <Box mb={4}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2" component="label">
                    Max Position Size
                  </Typography>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {(config.max_position_size * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <Slider
                  value={config.max_position_size * 100}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(e, val) => handleChange('max_position_size', (val as number) / 100)}
                  onChangeCommitted={(e, val) => saveField('max_position_size', (val as number) / 100)}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
                <Typography variant="caption" color="textSecondary">
                  Limit any single asset from occupying more than this % of the portfolio.
                </Typography>
              </Box>

              <Box mb={4}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2" component="label">
                    Take Profit Threshold
                  </Typography>
                  <Typography variant="subtitle2" color="success.main" fontWeight="bold">
                    +{(config.take_profit_percentage * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <Slider
                  value={config.take_profit_percentage * 100}
                  min={1}
                  max={200}
                  step={1}
                  color="success"
                  onChange={(e, val) => handleChange('take_profit_percentage', (val as number) / 100)}
                  onChangeCommitted={(e, val) => saveField('take_profit_percentage', (val as number) / 100)}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `+${v}%`}
                />
                <Typography variant="caption" color="textSecondary">
                  Automatically liquidate a holding to lock in gains at this %.
                </Typography>
              </Box>

              <Box>
                <Box display="flex" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2" component="label">
                    Stop Loss Threshold
                  </Typography>
                  <Typography variant="subtitle2" color="error.main" fontWeight="bold">
                    {(config.stop_loss_percentage * 100).toFixed(0)}%
                  </Typography>
                </Box>
                <Slider
                  value={config.stop_loss_percentage * 100}
                  min={-50}
                  max={-1}
                  step={1}
                  color="error"
                  onChange={(e, val) => handleChange('stop_loss_percentage', (val as number) / 100)}
                  onChangeCommitted={(e, val) => saveField('stop_loss_percentage', (val as number) / 100)}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(v) => `${v}%`}
                />
                <Typography variant="caption" color="textSecondary">
                  Automatically liquidate a holding to stop bleeding at this %.
                </Typography>
              </Box>

            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card sx={{ border: '2px solid rgba(244,67,54,0.3)', bgcolor: 'rgba(244,67,54,0.03)' }}>
            <CardContent sx={{ p: 4 }}>
              <Box display="flex" alignItems="center" mb={2} color="error.main">
                <Warning sx={{ mr: 1 }} />
                <Typography variant="h6" fontWeight="bold">
                  Danger Zone
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" mb={3}>
                Immediately halt bot operations and liquidate all active market holdings at the current bid price. Action cannot be undone.
              </Typography>
              <Button
                variant="contained"
                startIcon={<Warning />}
                disabled={!botStatus?.is_active}
                onClick={async () => {
                  if (window.confirm("ARE YOU SURE? This will stop the bot and SELL ALL HOLDINGS immediately!")) {
                    try {
                      await botAPI.panicSell();
                      alert("PANIC SELL TRIGGERED: Bot stopped and all holdings are being liquidated.");
                      fetchConfig();
                    } catch (error) {
                      alert("Error executing panic sell. Please check logs.");
                    }
                  }
                }}
                fullWidth
                sx={{
                  py: 1.5,
                  bgcolor: botStatus?.is_active ? '#d32f2f' : 'action.disabledBackground',
                  color: botStatus?.is_active ? 'white' : 'text.disabled',
                  fontWeight: 'bold',
                  '&:hover': { bgcolor: '#b71c1c' }
                }}
              >
                SELL ALL AND STOP BOT
              </Button>
            </CardContent>
          </Card>

        </Grid>
      </Grid>
    </Box>
  );
};

export default Configuration;