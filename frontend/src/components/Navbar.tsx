import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  AccountBalance as PortfolioIcon,
  TrendingUp as TradingIcon,
  Settings as SettingsIcon,
  BugReport as DebugIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Menu as MenuIcon,
  Science as PaperIcon,
  AttachMoney as LiveIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import TimeTicker from './TimeTicker';
import { useAuth } from '../contexts/AuthContext';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [navMenuAnchorEl, setNavMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [tradingMode, setTradingMode] = useState<string>('paper');

  const navItems = [
    { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
    { label: 'Portfolio', path: '/portfolio', icon: <PortfolioIcon /> },
    { label: 'Trading', path: '/trading', icon: <TradingIcon /> },
    { label: 'Config', path: '/config', icon: <SettingsIcon /> },
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
          sx={{ mr: 3, cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          StockBot
        </Typography>

        {/* Time and Market Status - Center */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <TimeTicker />
        </Box>

        {/* User Profile - Right aligned */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={tradingMode}
            exclusive
            onChange={handleTradingModeChange}
            aria-label="trading mode"
            size="small"
            sx={{
              mr: 2,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              '& .MuiToggleButton-root': {
                color: 'rgba(255, 255, 255, 0.5)',
                '&.Mui-selected': {
                  color: '#fff',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.3)',
                  },
                },
                '&.Mui-disabled': {
                  color: 'rgba(255, 255, 255, 0.2)',
                }
              }
            }}
          >
            <ToggleButton value="paper" aria-label="fake trading">
              <Tooltip title="Fake Money Trading">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LiveIcon fontSize="small" />
                  <Typography variant="caption" sx={{ display: { xs: 'none', md: 'block' } }}>Fake</Typography>
                </Box>
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="live" aria-label="real trading" disabled>
              <Tooltip title="Real Money Trading - Coming Soon">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LiveIcon fontSize="small" />
                  <Typography variant="caption" sx={{ display: { xs: 'none', md: 'block' } }}>Real</Typography>
                </Box>
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

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
            <MenuItem onClick={handleProfileMenuClose}>
              <ListItemIcon>
                <PersonIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                <Typography variant="body2">{user?.email}</Typography>
              </ListItemText>
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