import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  name: string;
  picture?: string;
  google_id: string;
  is_active: boolean;
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

  // Set up axios interceptor for authentication
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle 401 errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, [token]);

  const login = async (googleToken: string): Promise<void> => {
    try {
      setIsLoading(true);
      setIsUnauthorized(false);
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/auth/google`, {
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
      const response = await axios.post(`${process.env.REACT_APP_API_BASE_URL}/api/auth/google-oauth2`, {
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

  const logout = (): void => {
    setUser(null);
    setToken(null);
    setIsUnauthorized(false);
    localStorage.removeItem('token');
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
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
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