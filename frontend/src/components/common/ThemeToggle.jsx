/**
 * ThemeToggle Component
 * Dark/Light mode toggle with Sun/Moon icons
 * Uses lucide-react for icons
 */

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

function ThemeToggle() {
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first, then system preference
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) {
      return saved === 'true';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <div
      className="theme-toggle"
      role="group"
      aria-label="Theme toggle"
    >
      <button
        className={`theme-icon-button ${!isDark ? 'active' : ''}`}
        onClick={() => setIsDark(false)}
        aria-label="Switch to light mode"
        title="Switch to light mode"
      >
        <Sun size={18} className="theme-icon sun" />
      </button>
      <button
        className={`theme-icon-button ${isDark ? 'active' : ''}`}
        onClick={() => setIsDark(true)}
        aria-label="Switch to dark mode"
        title="Switch to dark mode"
      >
        <Moon size={18} className="theme-icon moon" />
      </button>
    </div>
  );
}

export default ThemeToggle;

