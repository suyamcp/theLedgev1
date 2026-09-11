import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export type Theme = 'dark' | 'light';
const THEME_KEY = 'tl_theme';

export const getStoredTheme = (): Theme => {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch { /* noop */ }
  return 'light'; // light grey is the brand surface, so it is the default
};

export const applyTheme = (t: Theme) => {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(THEME_KEY, t); } catch { /* noop */ }
};

interface ThemeToggleProps {
  /** `icon` = compact circle for the navbar, `full` = labelled pill for menus */
  variant?: 'icon' | 'full';
  className?: string;
}

export default function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  // Keep the DOM in sync, and follow changes made from another toggle instance.
  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => {
    const sync = (e: Event) => setTheme((e as CustomEvent).detail as Theme);
    window.addEventListener('vp-theme-change', sync);
    return () => window.removeEventListener('vp-theme-change', sync);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    window.dispatchEvent(new CustomEvent('vp-theme-change', { detail: next }));
  };

  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  if (variant === 'full') {
    return (
      <button
        onClick={toggle}
        aria-label={label}
        className={`w-full py-3 px-4 rounded-xl bg-pine-950/40 border border-pine-850/60 hover:border-gold-500 text-neutral-300 hover:text-gold-400 font-display font-medium text-xs transition-all flex items-center gap-2.5 ${className}`}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4 text-gold-500" /> : <Moon className="w-4 h-4 text-gold-500" />}
        <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      title={label}
      aria-label={label}
      className={`p-2.5 rounded-full bg-pine-900 border border-pine-850 hover:border-gold-500 text-gold-400 hover:text-gold-300 transition-all cursor-pointer flex items-center justify-center group ${className}`}
    >
      {theme === 'dark'
        ? <Sun className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
        : <Moon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />}
    </button>
  );
}
