import React, { createContext, useContext, useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(() => localStorage.getItem('colorMode') || 'light');

  useEffect(() => {
    localStorage.setItem('colorMode', mode);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [mode]);

  const toggleMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, isLight: mode === 'light', isDark: mode === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export const ThemeToggle = ({ className = "" }) => {
  const { isLight, toggleMode } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleMode}
      className={`p-2.5 rounded-2xl transition-all cursor-pointer flex items-center gap-2 border shadow-xs ${
        isLight
          ? 'bg-white hover:bg-slate-100 text-amber-600 border-slate-200'
          : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
      } ${className}`}
      title={isLight ? "Switch to Dark Theme" : "Switch to Light Theme"}
    >
      {isLight ? <Moon className="w-5 h-5 text-indigo-600" /> : <Sun className="w-5 h-5 text-amber-400" />}
      <span className="text-xs font-bold hidden sm:inline">
        {isLight ? "Dark" : "Light"}
      </span>
    </button>
  );
};
