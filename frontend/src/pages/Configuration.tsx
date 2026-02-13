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
} from '@mui/material';
import { botAPI } from '../services/api';
import type { BotConfig } from '../services/api';

const Configuration: React.FC = () => {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const configData = await botAPI.getBotConfig();
      setConfig(configData);
    } catch (err) {
      setError('Failed to load configuration');
      console.error('Config error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await botAPI.updateBotConfig(config);
      setSuccess('Configuration saved successfully!');
    } catch (err) {
      setError('Failed to save configuration');
      console.error('Save error:', err);
    } finally {
      setSaving(false);
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

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
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
                margin="normal"
                inputProps={{ min: 1, max: 100 }}
                helperText="Maximum percentage of portfolio per stock"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Risk Tolerance</InputLabel>
                <Select
                  value={config.risk_tolerance}
                  onChange={(e) => handleChange('risk_tolerance', e.target.value)}
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
                onChange={(e) => handleChange('trading_hours_start', e.target.value)}
                margin="normal"
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                fullWidth
                label="Trading End Time"
                type="time"
                value={config.trading_hours_end}
                onChange={(e) => handleChange('trading_hours_end', e.target.value)}
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
              <Typography variant="h6" gutterBottom>
                Bot Control
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={config.is_active}
                    onChange={(e) => handleChange('is_active', e.target.checked)}
                  />
                }
                label="Bot Active"
              />

              <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
                When active, the bot will automatically analyze and trade stocks during market hours.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Save Button */}
        <Grid item xs={12}>
          <Box display="flex" justifyContent="center">
            <Button
              variant="contained"
              size="large"
              onClick={handleSave}
              disabled={saving}
              sx={{ minWidth: 200 }}
            >
              {saving ? <CircularProgress size={24} /> : 'Save Configuration'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Configuration;