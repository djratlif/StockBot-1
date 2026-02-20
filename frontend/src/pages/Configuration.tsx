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
  Switch,
  FormControlLabel,
  Box,
  Alert,
  CircularProgress,
  Chip,
  Slider,
  InputAdornment,
} from '@mui/material';
import { PlayArrow, Stop, Warning } from '@mui/icons-material';
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
    <Box>
      <Typography variant="h4" gutterBottom>
        Bot Configuration
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Trading Parameters */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trading Parameters
              </Typography>

              <TextField
                fullWidth
                label="Max Daily Trades"
                type="number"
                value={config.max_daily_trades}
                onChange={(e) => handleChange('max_daily_trades', parseInt(e.target.value))}
                onBlur={(e) => saveField('max_daily_trades', parseInt(e.target.value))}
                margin="normal"
                inputProps={{ min: 1, max: 50 }}
                helperText="Maximum number of trades per day"
              />

              <TextField
                fullWidth
                label="Max Position Size (%)"
                type="number"
                value={(config.max_position_size * 100).toFixed(0)}
                onChange={(e) => handleChange('max_position_size', parseFloat(e.target.value) / 100)}
                onBlur={(e) => saveField('max_position_size', parseFloat(e.target.value) / 100)}
                margin="normal"
                inputProps={{ min: 1, max: 100 }}
                helperText="Maximum percentage of portfolio per stock"
              />

              <FormControl fullWidth margin="normal">
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

              <TextField
                fullWidth
                label="Min Cash Reserve ($)"
                type="number"
                value={config.min_cash_reserve}
                onChange={(e) => handleChange('min_cash_reserve', parseFloat(e.target.value))}
                onBlur={(e) => saveField('min_cash_reserve', parseFloat(e.target.value))}
                margin="normal"
                inputProps={{ min: 0, step: 0.01 }}
                helperText="Minimum cash to keep available"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Risk Management */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Risk Management
              </Typography>

              <TextField
                fullWidth
                label="Stop Loss (%)"
                type="number"
                value={(config.stop_loss_percentage * 100).toFixed(0)}
                onChange={(e) => handleChange('stop_loss_percentage', parseFloat(e.target.value) / 100)}
                onBlur={(e) => saveField('stop_loss_percentage', parseFloat(e.target.value) / 100)}
                margin="normal"
                inputProps={{ min: -100, max: 0 }}
                helperText="Automatic sell trigger (negative value)"
              />

              <TextField
                fullWidth
                label="Take Profit (%)"
                type="number"
                value={(config.take_profit_percentage * 100).toFixed(0)}
                onChange={(e) => handleChange('take_profit_percentage', parseFloat(e.target.value) / 100)}
                onBlur={(e) => saveField('take_profit_percentage', parseFloat(e.target.value) / 100)}
                margin="normal"
                inputProps={{ min: 0, max: 500 }}
                helperText="Automatic sell trigger (positive value)"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Trading Hours */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trading Hours (EST)
              </Typography>

              <TextField
                fullWidth
                label="Trading Start Time"
                type="time"
                value={config.trading_hours_start}
                onChange={(e) => {
                  handleChange('trading_hours_start', e.target.value);
                  saveField('trading_hours_start', e.target.value);
                }}
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                fullWidth
                label="Trading End Time"
                type="time"
                value={config.trading_hours_end}
                onChange={(e) => {
                  handleChange('trading_hours_end', e.target.value);
                  saveField('trading_hours_end', e.target.value);
                }}
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Bot Control */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography variant="h6">Bot Status</Typography>
                <Chip
                  label={botStatus?.is_active ? 'Active' : 'Inactive'}
                  color={botStatus?.is_active ? 'success' : 'default'}
                  size="small"
                />
              </Box>
              <Button
                variant="contained"
                color={botStatus?.is_active ? 'error' : 'success'}
                startIcon={botStatus?.is_active ? <Stop /> : <PlayArrow />}
                onClick={handleBotToggle}
                fullWidth
                sx={{ mb: 1 }}
              >
                {botStatus?.is_active ? 'Stop Bot' : 'Start Bot'}
              </Button>
              {botStatus?.is_active && (
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Warning />}
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
                  sx={{ mb: 1, bgcolor: '#d32f2f', '&:hover': { bgcolor: '#b71c1c' } }}
                >
                  SELL ALL AND STOP BOT
                </Button>
              )}
              <Box mt={2} mb={2}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="body2" color="textSecondary">
                    Portfolio Allocation ({Math.round((config?.portfolio_allocation || 1.0) * 100)}%)
                  </Typography>
                  <TextField
                    type="number"
                    size="small"
                    value={
                      config?.portfolio_allocation_type === 'FIXED_AMOUNT' 
                        ? config.portfolio_allocation_amount 
                        : Math.round((portfolioSummary?.total_value || 0) * (config?.portfolio_allocation || 1.0))
                    }
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val)) return;
                      const portValue = portfolioSummary?.total_value || 1;
                      let percentage = Math.min(1.0, Math.max(0.01, val / portValue));
                      percentage = Math.round(percentage * 100) / 100; 
                      
                      setConfig(prev => prev ? { 
                        ...prev, 
                        portfolio_allocation_type: 'FIXED_AMOUNT',
                        portfolio_allocation_amount: val,
                        portfolio_allocation: percentage
                      } : null);
                    }}
                    onBlur={async (e) => {
                      const val = parseFloat(e.target.value);
                      if (isNaN(val) || val < 0) return;
                      
                      const portValue = portfolioSummary?.total_value || 1;
                      let percentage = Math.min(1.0, Math.max(0.01, val / portValue));
                      percentage = Math.round(percentage * 100) / 100; 
                      
                      try {
                        const updated = await botAPI.updateBotConfig({ 
                          portfolio_allocation_type: 'FIXED_AMOUNT',
                          portfolio_allocation_amount: val,
                          portfolio_allocation: percentage
                        });
                        setConfig(updated);
                      } catch (err) {
                        console.error('Failed to update allocation amount', err);
                      }
                    }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                    disabled={!portfolioSummary}
                    sx={{ 
                      minWidth: '120px',
                      maxWidth: '140px',
                      '& input[type=number]': {
                        MozAppearance: 'textfield',
                      },
                      '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                        WebkitAppearance: 'none',
                        margin: 0,
                      },
                    }}
                  />
                </Box>
                <Slider
                  value={Math.round((config?.portfolio_allocation || 1.0) * 100)}
                  step={1}
                  min={5}
                  max={100}
                  valueLabelDisplay="auto"
                  onChange={(_, value) => {
                    const newValue = (value as number) / 100;
                    handleChange('portfolio_allocation', newValue);
                  }}
                  onChangeCommitted={async (_, value) => {
                    const newValue = (value as number) / 100;
                    try {
                      const updated = await botAPI.updateBotConfig({ 
                        portfolio_allocation_type: 'PERCENTAGE',
                        portfolio_allocation: newValue 
                      });
                      setConfig(updated);
                    } catch (err) {
                      console.error('Failed to update allocation', err);
                    }
                  }}
                  sx={{ width: '100%', mt: 1 }}
                />
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                When active, the bot will automatically analyze and trade stocks during market hours using the allocated amount.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Configuration;