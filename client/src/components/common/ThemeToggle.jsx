import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext.jsx';

export const ThemeToggle = ({ className = '', size = 'md' }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-9 h-9 rounded-xl',
    lg: 'w-10 h-10 rounded-xl',
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      type="button"
      id="theme-toggle-btn"
      data-testid="theme-toggle-btn"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center transition-colors border select-none ${
        sizeClasses[size] || sizeClasses.md
      } ${
        isDark
          ? 'bg-slate-800/90 text-amber-300 border-slate-700/80 hover:bg-slate-700 hover:text-amber-200 hover:border-slate-600 shadow-xs'
          : 'bg-white text-slate-600 border-slate-200/90 hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300 shadow-xs'
      } ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className={`${iconSizes[size] || iconSizes.md} transition-transform duration-200 rotate-0 hover:rotate-45`} />
      ) : (
        <Moon className={`${iconSizes[size] || iconSizes.md} transition-transform duration-200 -rotate-12 hover:rotate-0`} />
      )}
    </button>
  );
};

export default ThemeToggle;
