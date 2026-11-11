import { useSyncExternalStore } from 'react';

// Light or dark. The choice is kept in this browser; until someone picks,
// the app follows the device setting. public/theme.js applies it before the
// first paint; this module keeps it in step afterwards.

const KEY = 'lt-theme';
const COLOURS = { light: '#f5f6f8', dark: '#0f1117' };
const media = window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();

function saved() {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOURS[theme]);
  listeners.forEach((listener) => listener());
}

apply(saved() ?? (media.matches ? 'dark' : 'light'));
media.addEventListener('change', (event) => {
  if (!saved()) apply(event.matches ? 'dark' : 'light');
});

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Private windows may refuse; the switch still works for this visit.
  }
  apply(theme);
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTheme = () => useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme);
