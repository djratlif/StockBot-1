import React from 'react';
import { Box, Typography, Paper, Button, Alert } from '@mui/material';
import { Lock as LockIcon, Home as HomeIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Unauthorized: React.FC = () => {
  const { logout } = useAuth();

  const handleTryAgain = () => {
    logout();
    // This will redirect back to the login page
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        p: 2,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          maxWidth: 500,
          textAlign: 'center',
          borderRadius: 2,
        }}
      >
        <Box sx={{ mb: 3 }}>
          <LockIcon
            sx={{
              fontSize: 64,
              color: 'error.main',
              mb: 2,
            }}
          />
        </Box>

        <Typography variant="h4" gutterBottom color="error">
          Access Denied
        </Typography>

        <Typography variant="h6" sx={{ mb: 3, color: 'text.secondary' }}>
          Unauthorized Account
        </Typography>

        <Alert severity="error" sx={{ mb: 3, textAlign: 'left' }}>
          <Typography variant="body1">
            Your Google account is not authorized to access StockBot. This application is restricted to approved users only.
          </Typography>
        </Alert>

        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
          If you believe this is an error, please contact the administrator to request access for your account.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<HomeIcon />}
            onClick={handleTryAgain}
            sx={{
              backgroundColor: '#4285f4',
              '&:hover': {
                backgroundColor: '#357ae8',
              },
            }}
          >
            Try Different Account
          </Button>
        </Box>

        <Typography variant="caption" sx={{ mt: 3, display: 'block', color: 'text.secondary' }}>
          StockBot - AI-Powered Trading Assistant
        </Typography>
      </Paper>
    </Box>
  );
};

export default Unauthorized;