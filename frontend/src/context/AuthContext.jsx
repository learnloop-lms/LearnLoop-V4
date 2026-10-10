import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { getTheme } from '../theme/themeConfig';

// Determine API Base URL from environment variables or current runtime location
const resolveApiBase = () => {
  // 1. Explicit API base URL defined in environment (e.g. VITE_API_BASE="http://10.147.20.160:8000/api" or "/api")
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/+$/, '');
  }

  // 2. Explicit backend URL defined in environment (e.g. VITE_BACKEND_URL="http://10.147.20.160:8000")
  if (import.meta.env.VITE_BACKEND_URL) {
    const backend = import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, '');
    return backend.endsWith('/api') ? backend : `${backend}/api`;
  }

  // 3. Domain or IP specified in environment (e.g. VITE_SERVER_IP="10.147.20.160" or VITE_DOMAIN="learnloop.edu")
  const envHost = import.meta.env.VITE_DOMAIN || import.meta.env.VITE_SERVER_IP || import.meta.env.VITE_HOST;
  if (envHost && envHost.trim()) {
    const proto = import.meta.env.VITE_PROTOCOL || (typeof window !== 'undefined' ? window.location.protocol : 'http:');
    const cleanHost = envHost.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const port = import.meta.env.VITE_BACKEND_PORT || '8000';
    const hostWithPort = cleanHost.includes(':') ? cleanHost : `${cleanHost}:${port}`;
    return `${proto.replace(/:$/, '')}://${hostWithPort}/api`;
  }

  // 4. Runtime browser environment
  if (typeof window !== 'undefined') {
    // When running Vite dev server locally or over network (port 5173), dynamically use the current hostname
    if (window.location.port === '5173') {
      const devHost = window.location.hostname || 'localhost';
      return `${window.location.protocol}//${devHost}:8000/api`;
    }
    // In production behind Nginx or served directly by FastAPI
    return '/api';
  }

  return '/api';
};

const API_BASE = resolveApiBase();

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token') || '');
  const [loading, setLoading] = useState(true);

  // Initialize token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
      fetchProfile(savedToken);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setLoading(false);
    }
  }, []);

  const fetchProfile = async (authToken) => {
    const activeToken = authToken || token || localStorage.getItem('token');
    if (!activeToken) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const res = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      setUser(res.data);
      return res.data;
    } catch (err) {
      console.error('Session expired or error fetching profile:', err);
      logout();
      return null;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, role) => {
    const res = await axios.post(`${API_BASE}/auth/login`, {
      email,
      password,
      role
    });
    const accessToken = res.data.access_token;
    localStorage.setItem('token', accessToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setToken(accessToken);
    const profile = await fetchProfile(accessToken);
    return { ...res.data, ...profile };
  };

  const registerStudent = async (data) => {
    const res = await axios.post(`${API_BASE}/auth/register/student`, data);
    const accessToken = res.data.access_token;
    localStorage.setItem('token', accessToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setToken(accessToken);
    const profile = await fetchProfile(accessToken);
    return { ...res.data, ...profile };
  };

  const registerTeacher = async (data) => {
    const res = await axios.post(`${API_BASE}/auth/register/teacher`, data);
    const accessToken = res.data.access_token;
    localStorage.setItem('token', accessToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setToken(accessToken);
    const profile = await fetchProfile(accessToken);
    return { ...res.data, ...profile };
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setToken('');
    setUser(null);
    setLoading(false);
  };

  const activeTheme = getTheme(user?.pt_ls);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        activeTheme,
        login,
        registerStudent,
        registerTeacher,
        logout,
        fetchProfile,
        API_BASE
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
