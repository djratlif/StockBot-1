import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: number;
  email: string;
  name: string;
  picture?: string;
  google_id: string;
  is_active: boolean;
  is_read_only: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isUnauthorized: boolean;
  login: (googleToken: string) => Promise<void>;
  loginWithUserInfo: (userInfo: any) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearUnauthorized: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  const isAuthenticated = !!user && !!token;

  const logout = React.useCallback((): void => {
    setUser(null);
    setToken(null);
    setIsUnauthorized(false);
    localStorage.removeItem('token');
  }, []);

  // Response interceptor to handle 401 errors globally across the app
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [logout]);

  // Inactivity timeout watcher
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimeout = () => {
      clearTimeout(timeoutId);
      // Standard 30 minute inactivity timeout
      timeoutId = setTimeout(() => {
        if (token) {
          console.warn('Session expired due to inactivity');
          logout();
        }
      }, 30 * 60 * 1000);
    };

    if (token) {
      resetTimeout();
      window.addEventListener('mousemove', resetTimeout);
      window.addEventListener('keydown', resetTimeout);
      window.addEventListener('scroll', resetTimeout);
      window.addEventListener('click', resetTimeout);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimeout);
      window.removeEventListener('keydown', resetTimeout);
      window.removeEventListener('scroll', resetTimeout);
      window.removeEventListener('click', resetTimeout);
    };
  }, [token, logout]);

  const login = async (googleToken: string): Promise<void> => {
    try {
      setIsLoading(true);
      setIsUnauthorized(false);
      const response = await api.post('/api/auth/google', {
        token: googleToken
      });

      const { access_token, user: userData } = response.data;

      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
    } catch (error: any) {
      console.error('Login failed:', error);
      if (error.response?.status === 401) {
        setIsUnauthorized(true);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithUserInfo = async (userInfo: any): Promise<void> => {
    try {
      setIsLoading(true);
      setIsUnauthorized(false);
      const response = await api.post('/api/auth/google-oauth2', {
        google_id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
      });

      const { access_token, user: userData } = response.data;

      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
    } catch (error: any) {
      console.error('OAuth2 login failed:', error);
      if (error.response?.status === 401) {
        setIsUnauthorized(true);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };



  const clearUnauthorized = (): void => {
    setIsUnauthorized(false);
  };

  const checkAuth = async (): Promise<void> => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await api.get('/api/auth/me');

      setUser(response.data);
    } catch (error) {
      console.error('Auth check failed:', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    isUnauthorized,
    login,
    loginWithUserInfo,
    logout,
    checkAuth,
    clearUnauthorized
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};