import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  Button,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Api as ApiIcon,
  TrendingUp as TradeIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as BugIcon,
} from '@mui/icons-material';
import { logsAPI } from '../services/api';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`debug-tabpanel-${index}`}
      aria-labelledby={`debug-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const Debug: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logLimit, setLogLimit] = useState(50);

  const fetchDebugData = useCallback(async () => {
    try {
      setRefreshing(true);
      const [debugResponse, statusResponse] = await Promise.all([
        logsAPI.getDebugInfo(logLimit),
        logsAPI.getSystemStatus(),
      ]);
      
      setDebugInfo(debugResponse.data);
      setSystemStatus(statusResponse.data);
    } catch (error) {
      console.error('Error fetching debug data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [logLimit]);

  useEffect(() => {
    fetchDebugData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDebugData, 30000);
    return () => clearInterval(interval);
  }, [fetchDebugData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'ERROR':
        return <ErrorIcon color="error" />;
      case 'WARNING':
        return <WarningIcon color="warning" />;
      case 'SUCCESS':
        return <SuccessIcon color="success" />;
      default:
        return <InfoIcon color="info" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const renderLogList = (logs: any[], title: string, icon: React.ReactNode) => (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          <Typography variant="h6">
            {title} ({logs.length})
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <List dense>
          {logs.length === 0 ? (
            <ListItem>
              <ListItemText primary="No logs found" />
            </ListItem>
          ) : (
            logs.map((log, index) => (
              <React.Fragment key={log.id || index}>
                <ListItem>
                  <ListItemIcon>
                    {getLogIcon(log.level)}
                  </ListItemIcon>
                  <ListItemText
                    primary={log.message}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          {formatTimestamp(log.timestamp)} EST
                        </Typography>
                        {log.symbol && (
                          <Chip
                            label={log.symbol}
                            size="small"
                            variant="outlined"
                            sx={{ mt: 0.5, mr: 1 }}
                          />
                        )}
                        {log.trade_id && (
                          <Chip
                            label={`Trade #${log.trade_id}`}
                            size="small"
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </Box>
                    }
                  />
                </ListItem>
                {index < logs.length - 1 && <Divider />}
              </React.Fragment>
            ))
          )}
        </List>
      </AccordionDetails>
    </Accordion>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BugIcon />
          Debug & Logs
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            select
            label="Log Limit"
            value={logLimit}
            onChange={(e) => setLogLimit(Number(e.target.value))}
            size="small"
            sx={{ minWidth: 120 }}
          >
            <MenuItem value={25}>25 logs</MenuItem>
            <MenuItem value={50}>50 logs</MenuItem>
            <MenuItem value={100}>100 logs</MenuItem>
            <MenuItem value={200}>200 logs</MenuItem>
          </TextField>
          <Button
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
            onClick={fetchDebugData}
            disabled={refreshing}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* System Status Overview */}
      {systemStatus && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            System Status
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">
                    OpenAI API
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {systemStatus.openai_api_configured ? (
                      systemStatus.openai_api_working ? (
                        <Chip label="Working" color="success" size="small" />
                      ) : (
                        <Chip label="Error" color="error" size="small" />
                      )
                    ) : (
                      <Chip label="Not Configured" color="warning" size="small" />
                    )}
                  </Box>
                  {systemStatus.openai_error && (
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                      {systemStatus.openai_error}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">
                    Stock API
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {systemStatus.stock_api_working ? (
                      <Chip label="Working" color="success" size="small" />
                    ) : (
                      <Chip label="Error" color="error" size="small" />
                    )}
                  </Box>
                  {systemStatus.stock_api_error && (
                    <Typography variant="caption" color="error" display="block" sx={{ mt: 1 }}>
                      {systemStatus.stock_api_error}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">
                    Database
                  </Typography>
                  <Chip 
                    label={systemStatus.database_connected ? "Connected" : "Disconnected"} 
                    color={systemStatus.database_connected ? "success" : "error"} 
                    size="small" 
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" color="textSecondary">
                    Last Check
                  </Typography>
                  <Typography variant="body2">
                    {formatTimestamp(systemStatus.last_check)} EST
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Debug Summary */}
      {debugInfo && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Log Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <ErrorIcon color="error" sx={{ fontSize: 32 }} />
                  <Typography variant="h6">{debugInfo.summary.error_count}</Typography>
                  <Typography variant="caption">Errors</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <WarningIcon color="warning" sx={{ fontSize: 32 }} />
                  <Typography variant="h6">{debugInfo.summary.warning_count}</Typography>
                  <Typography variant="caption">Warnings</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <InfoIcon color="info" sx={{ fontSize: 32 }} />
                  <Typography variant="h6">{debugInfo.summary.info_count}</Typography>
                  <Typography variant="caption">Info</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <ApiIcon color="primary" sx={{ fontSize: 32 }} />
                  <Typography variant="h6">{debugInfo.summary.api_call_count}</Typography>
                  <Typography variant="caption">API Calls</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <TradeIcon color="success" sx={{ fontSize: 32 }} />
                  <Typography variant="h6">{debugInfo.summary.trade_count}</Typography>
                  <Typography variant="caption">Trades</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <BugIcon color="action" sx={{ fontSize: 32 }} />
                  <Typography variant="h6">{debugInfo.summary.total_logs}</Typography>
                  <Typography variant="caption">Total Logs</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Detailed Logs */}
      {debugInfo && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label={`Errors (${debugInfo.summary.error_count})`} />
              <Tab label={`Warnings (${debugInfo.summary.warning_count})`} />
              <Tab label={`API Calls (${debugInfo.summary.api_call_count})`} />
              <Tab label={`Trades (${debugInfo.summary.trade_count})`} />
              <Tab label={`All Logs (${debugInfo.summary.total_logs})`} />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            {renderLogList(debugInfo.errors, 'Error Logs', <ErrorIcon color="error" />)}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {renderLogList(debugInfo.warnings, 'Warning Logs', <WarningIcon color="warning" />)}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {renderLogList(debugInfo.api_calls, 'API Call Logs', <ApiIcon color="primary" />)}
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            {renderLogList(debugInfo.trades, 'Trade Logs', <TradeIcon color="success" />)}
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            {renderLogList(debugInfo.info, 'All Logs', <InfoIcon color="info" />)}
          </TabPanel>
        </Paper>
      )}

      {/* Rate Limiting Alert */}
      {debugInfo && debugInfo.api_calls.some((log: any) => 
        log.message.toLowerCase().includes('rate limit') || 
        log.message.toLowerCase().includes('quota')
      ) && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <Typography variant="subtitle2">Rate Limiting Detected</Typography>
          <Typography variant="body2">
            API rate limiting has been detected in your logs. This may cause delays in bot operations.
            Check the API Calls tab for more details.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default Debug;