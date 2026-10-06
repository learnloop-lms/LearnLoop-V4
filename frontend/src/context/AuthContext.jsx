import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { getTheme } from '../theme/themeConfig';

const API_BASE = import.meta.env.VITE_API_BASE || (typeof window !== 'undefined' && window.location.port === '5173' ? 'http://localhost:8000/api' : '/api');

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
