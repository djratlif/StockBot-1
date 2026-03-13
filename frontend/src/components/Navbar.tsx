import React, { useState, useEffect, useRef } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  ListItemIcon,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Switch,
  Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  AccountBalance as PortfolioIcon,
  TrendingUp as TradingIcon,
  Settings as SettingsIcon,
  BugReport as DebugIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Assessment as ReportIcon,
  Menu as MenuIcon,
  Science as PaperIcon,
  AttachMoney as LiveIcon,
  SensorsRounded, // Added SensorsRounded icon
  SensorsOffRounded, // Added SensorsOffRounded icon
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { stocksAPI, StockInfo } from '../services/api';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const { isConnected } = useWebSocket(); // Get connection status from WebSocketContext
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [navMenuAnchorEl, setNavMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [tradingMode, setTradingMode] = useState<string>('paper');
  const [spyData, setSpyData] = useState<StockInfo | null>(null);
  const spyIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSpyData = async () => {
    try {
      const info = await stocksAPI.getStockInfo('SPY');
      setSpyData(info);
    } catch (err) {
      console.error('Failed to fetch SPY data:', err);
    }
  };

  useEffect(() => {
    fetchSpyData();
    spyIntervalRef.current = setInterval(fetchSpyData, 60000); // Poll once a minute
    return () => {
      if (spyIntervalRef.current) clearInterval(spyIntervalRef.current);
    };
  }, []);

  const navItems = [
    { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
    { label: 'Portfolio', path: '/portfolio', icon: <PortfolioIcon /> },
    { label: 'Trading', path: '/trading', icon: <TradingIcon /> },
    { label: 'Config', path: '/config', icon: <SettingsIcon /> },
    { label: 'Report', path: '/report', icon: <ReportIcon /> },
    { label: 'Debug', path: '/debug', icon: <DebugIcon /> },
  ];

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleNavMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNavMenuAnchorEl(event.currentTarget);
  };

  const handleNavMenuClose = () => {
    setNavMenuAnchorEl(null);
  };

  const handleTradingModeChange = (
    event: React.MouseEvent<HTMLElement>,
    newMode: string,
  ) => {
    if (newMode !== null) {
      setTradingMode(newMode);
    }
  };

  const handleLogout = () => {
    logout();
    handleProfileMenuClose();
    navigate('/');
  };

  // Don't show navbar if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppBar position="static" sx={{ mb: 2 }}>
      <Toolbar sx={{ minHeight: '64px !important' }}>
        <IconButton
          size="large"
          edge="start"
          color="inherit"
          aria-label="menu"
          sx={{ mr: 2 }}
          onClick={handleNavMenuOpen}
        >
          <MenuIcon />
        </IconButton>
        <Menu
          anchorEl={navMenuAnchorEl}
          open={Boolean(navMenuAnchorEl)}
          onClose={handleNavMenuClose}
        >
          {navItems.map((item) => (
            <MenuItem
              key={item.path}
              onClick={() => {
                navigate(item.path);
                handleNavMenuClose();
              }}
              selected={location.pathname === item.path}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </MenuItem>
          ))}
        </Menu>

        <Typography
          variant="h6"
          component="div"
          sx={{ flexGrow: 1, mr: 3, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          StockBot
        </Typography>

        {/* User Profile - Right aligned */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
          {spyData && (
            <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', bgcolor: 'rgba(0,0,0,0.2)', px: 1.5, py: 0.5, borderRadius: 1, border: '1px solid rgba(255,255,255,0.1)' }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold', mr: 1 }}>SPY</Typography>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mr: 1 }}>${spyData.current_price.toFixed(2)}</Typography>
              <Typography
                variant="caption"
                sx={{
                  color: spyData.change_percent >= 0 ? '#4caf50' : '#f44336',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {spyData.change_percent >= 0 ? '+' : ''}{spyData.change_percent.toFixed(2)}%
              </Typography>
            </Box>
          )}

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', ml: 1, mr: 1 }}>
            <Chip
              icon={isConnected ? <SensorsRounded fontSize="small" /> : <SensorsOffRounded fontSize="small" />}
              label={isConnected ? "Live Data" : "Connecting..."}
              color={isConnected ? "success" : "default"}
              variant="outlined"
              size="small"
            />
          </Box>
          <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {user?.name}
          </Typography>
          <Avatar
            src={user?.picture}
            alt={user?.name}
            sx={{ width: 32, height: 32, cursor: 'pointer' }}
            onClick={handleProfileMenuOpen}
          >
            {user?.name?.charAt(0).toUpperCase()}
          </Avatar>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            onClick={handleProfileMenuClose}
            PaperProps={{
              elevation: 0,
              sx: {
                overflow: 'visible',
                filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                mt: 1.5,
                minWidth: '200px',
                '& .MuiAvatar-root': {
                  width: 32,
                  height: 32,
                  ml: -0.5,
                  mr: 1,
                },
                '&:before': {
                  content: '""',
                  display: 'block',
                  position: 'absolute',
                  top: 0,
                  right: 14,
                  width: 10,
                  height: 10,
                  bgcolor: 'background.paper',
                  transform: 'translateY(-50%) rotate(45deg)',
                  zIndex: 0,
                },
              },
            }}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" color="text.secondary" fontWeight="bold">Active Mode</Typography>
              <Tooltip title="Cash Trading - Coming Soon">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.primary' }}>
                    Paper Trading
                  </Typography>
                  <Switch
                    checked={false}
                    disabled
                    size="small"
                    inputProps={{ 'aria-label': 'toggle cash trading' }}
                  />
                </Box>
              </Tooltip>
            </Box>
            <Divider />
            <MenuItem onClick={handleProfileMenuClose}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                <Typography variant="body2" noWrap>{user?.email}</Typography>
              </ListItemText>
            </MenuItem>
            <MenuItem onClick={() => {
              navigate('/account');
              handleProfileMenuClose();
            }}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Account Settings</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;