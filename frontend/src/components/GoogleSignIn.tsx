import React, { useEffect, useState } from 'react';
import { Button, Box, Typography, Alert, CircularProgress } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

interface GoogleSignInProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

const GoogleSignIn: React.FC<GoogleSignInProps> = ({ onSuccess, onError }) => {
  const { login, loginWithUserInfo, isLoading, clearUnauthorized } = useAuth();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleReady, setIsGoogleReady] = useState(false);

  useEffect(() => {
    // Load Google Identity Services
    const loadGoogleScript = () => {
      if (window.google) {
        initializeGoogle();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initializeGoogle;
      script.onerror = () => {
        setError('Failed to load Google Sign-In');
      };
      document.head.appendChild(script);
    };

    const initializeGoogle = () => {
      if (!window.google || !process.env.REACT_APP_GOOGLE_CLIENT_ID) {
        setError('Google Sign-In not properly configured');
        return;
      }

      try {
        // Initialize both One Tap and OAuth2 for better compatibility
        window.google.accounts.id.initialize({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true, // Use FedCM when available
        });

        // Also initialize OAuth2 for popup-based sign-in (works better in incognito)
        window.google.accounts.oauth2.initTokenClient({
          client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: handleOAuth2Response,
        });

        setIsGoogleReady(true);
      } catch (err) {
        console.error('Google initialization error:', err);
        setError('Failed to initialize Google Sign-In');
      }
    };

    loadGoogleScript();
  }, []);

  const handleGoogleResponse = async (response: any) => {
    if (!response.credential) {
      setError('No credential received from Google');
      onError?.('No credential received from Google');
      return;
    }

    setIsGoogleLoading(true);
    setError(null);
    clearUnauthorized(); // Clear any previous unauthorized state

    try {
      await login(response.credential);
      onSuccess?.();
    } catch (err: any) {
      // Don't show error message for unauthorized users - they'll see the unauthorized page
      if (err.response?.status !== 401) {
        const errorMessage = err.response?.data?.detail || 'Login failed';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleOAuth2Response = async (response: any) => {
    if (!response.access_token) {
      setError('No access token received from Google');
      onError?.('No access token received from Google');
      return;
    }

    setIsGoogleLoading(true);
    setError(null);
    clearUnauthorized(); // Clear any previous unauthorized state

    try {
      // Get user info using the access token
      const userInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${response.access_token}`);
      const userInfo = await userInfoResponse.json();

      if (!userInfo.id) {
        throw new Error('Failed to get user information');
      }

      // Use the auth context method for OAuth2 login
      await loginWithUserInfo(userInfo);
      onSuccess?.();
    } catch (err: any) {
      // Don't show error message for unauthorized users - they'll see the unauthorized page
      if (err.response?.status !== 401) {
        const errorMessage = err.message || 'OAuth2 login failed';
        setError(errorMessage);
        onError?.(errorMessage);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSignIn = () => {
    if (!isGoogleReady) {
      setError('Google Sign-In not ready');
      return;
    }

    setError(null);
    
    try {
      // Try One Tap first (works in normal browsing)
      window.google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One Tap failed, fall back to popup-based OAuth2 (works in incognito)
          console.log('One Tap not available, using popup method');
          handlePopupSignIn();
        }
      });
    } catch (err) {
      console.error('One Tap sign-in error:', err);
      // Fall back to popup method
      handlePopupSignIn();
    }
  };

  const handlePopupSignIn = () => {
    try {
      // Use popup-based OAuth2 sign-in (works better in incognito mode)
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: handleOAuth2Response,
      });
      
      client.requestAccessToken();
    } catch (err) {
      console.error('Popup sign-in error:', err);
      setError('Failed to show sign-in popup');
    }
  };

  const isButtonDisabled = isLoading || isGoogleLoading || !isGoogleReady;

  return (
    <Box sx={{ textAlign: 'center', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Welcome to StockBot
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Sign in with your Google account to start trading with AI
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        size="large"
        startIcon={
          isButtonDisabled ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <GoogleIcon />
          )
        }
        onClick={handleSignIn}
        disabled={isButtonDisabled}
        sx={{
          backgroundColor: '#4285f4',
          '&:hover': {
            backgroundColor: '#357ae8',
          },
          py: 1.5,
          px: 4,
          fontSize: '1.1rem',
        }}
      >
        {isButtonDisabled ? 'Loading...' : 'Sign in with Google'}
      </Button>

      <Typography variant="caption" display="block" sx={{ mt: 2, color: 'text.secondary' }}>
        Your data is secure and we only access basic profile information
      </Typography>
    </Box>
  );
};

export default GoogleSignIn;