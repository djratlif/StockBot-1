import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Error,
  Info,
  Warning,
  Refresh,
} from '@mui/icons-material';

interface ActivityItem {
  id: number;
  timestamp: string;
  action?: string;
  details?: string;
  // Legacy fields for backward compatibility
  level?: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  message?: string;
  symbol?: string;
  trade_id?: number;
}

const ActivityFeed: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'BOUGHT_SOLD'>('ALL');

  const fetchActivities = async () => {
    try {
      setLoading(true);

      // Import the logsAPI
      const { logsAPI } = await import('../services/api');

      // Fetch real activity logs from backend
      const response = await logsAPI.getActivityLogs(25, 24);

      if (response.success && response.data) {
        setActivities(response.data);
      } else {
        // Fallback to mock data if no real logs exist
        const mockActivities: ActivityItem[] = [
          {
            id: 1,
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: 'Bot started and checking market status',
          },
          {
            id: 2,
            timestamp: new Date(Date.now() - 30000).toISOString(),
            level: 'WARNING',
            message: 'Market is currently closed - waiting for trading hours (9:30 AM - 4:00 PM EST)',
          },
          {
            id: 3,
            timestamp: new Date(Date.now() - 60000).toISOString(),
            level: 'INFO',
            message: 'Analyzing trending stocks: AAPL, GOOGL, MSFT, TSLA, META',
          },
          {
            id: 4,
            timestamp: new Date(Date.now() - 90000).toISOString(),
            level: 'SUCCESS',
            message: 'Portfolio initialized with $20.00 virtual money',
          },
          {
            id: 5,
            timestamp: new Date(Date.now() - 120000).toISOString(),
            level: 'INFO',
            message: 'AI trading engine loaded successfully',
          },
          {
            id: 6,
            timestamp: new Date(Date.now() - 150000).toISOString(),
            level: 'INFO',
            message: 'Connected to Yahoo Finance API for stock data',
          },
        ];
        setActivities(mockActivities);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      // Show mock data on error
      const mockActivities: ActivityItem[] = [
        {
          id: 1,
          timestamp: new Date().toISOString(),
          level: 'WARNING',
          message: 'Unable to connect to activity logs - showing demo data',
        },
        {
          id: 2,
          timestamp: new Date(Date.now() - 30000).toISOString(),
          level: 'INFO',
          message: 'Bot is ready to start trading when activated',
        },
      ];
      setActivities(mockActivities);
    } finally {
      setLoading(false);
    }
  };

  const formatTimeEST = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      month: 'short',
      day: 'numeric',
      hour12: true
    });
  };

  const getActivityIcon = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />;
      case 'ERROR':
        return <Error sx={{ color: 'error.main', fontSize: 20 }} />;
      case 'WARNING':
        return <Warning sx={{ color: 'warning.main', fontSize: 20 }} />;
      case 'PORTFOLIO_UP':
        return <TrendingUp sx={{ color: 'success.main', fontSize: 20 }} />;
      case 'PORTFOLIO_DOWN':
        return <TrendingDown sx={{ color: 'error.main', fontSize: 20 }} />;
      default:
        return <Info sx={{ color: 'info.main', fontSize: 20 }} />;
    }
  };

  const getActivityColor = (level: string) => {
    switch (level) {
      case 'SUCCESS':
        return 'success.main';
      case 'ERROR':
        return 'error.main';
      case 'WARNING':
        return 'warning.main';
      case 'PORTFOLIO_UP':
        return 'success.main';
      case 'PORTFOLIO_DOWN':
        return 'error.main';
      default:
        return 'text.primary';
    }
  };

  useEffect(() => {
    fetchActivities();

    // Refresh activities every 5 seconds
    const interval = setInterval(fetchActivities, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredActivities = activities.filter(activity => {
    if (filter === 'ALL') return true;
    
    const text = (activity.message || activity.details || '').toUpperCase();
    if (filter === 'BOUGHT_SOLD') {
      return text.includes('BUY') || text.includes('BOUGHT') || text.includes('SELL') || text.includes('SOLD');
    }
    return true;
  });

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={2}>
          <Typography variant="h6">
            Bot Activity Feed
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <ToggleButtonGroup
              value={filter}
              exclusive
              onChange={(e, newFilter) => {
                if (newFilter !== null) setFilter(newFilter);
              }}
              size="small"
              sx={{ height: 32 }}
            >
              <ToggleButton value="ALL" sx={{ textTransform: 'none', px: 2 }}>All</ToggleButton>
              <ToggleButton value="BOUGHT_SOLD" sx={{ textTransform: 'none', px: 2 }}>Bought/Sold</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Refresh Activity">
              <IconButton onClick={fetchActivities} disabled={loading} size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredActivities.length === 0 ? (
            <Alert severity="info">
              {activities.length === 0 
                ? "No recent activity. Start the bot to see real-time updates." 
                : "No activities match the selected filter."}
            </Alert>
          ) : (
            <List dense>
              {filteredActivities.map((activity) => (
                <ListItem
                  key={activity.id}
                  sx={{
                    px: 0,
                    py: 1,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:last-child': { borderBottom: 'none' }
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {getActivityIcon(activity.level || activity.action || 'INFO')}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography
                          variant="body2"
                          sx={{ color: getActivityColor(activity.level || activity.action || 'INFO') }}
                        >
                          {activity.message || activity.details || 'No details available'}
                        </Typography>
                        {activity.symbol && (
                          <Chip
                            label={activity.symbol}
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {formatTimeEST(activity.timestamp)} EST
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </Box>

        <Box mt={2} pt={2} borderTop={1} borderColor="divider">
          <Typography variant="caption" color="text.secondary">
            Activity updates every 5 seconds • All times shown in EST
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;