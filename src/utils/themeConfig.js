import { createContext, useContext } from 'react';

// ---------------------------------------------------------------------------
// Theme system: Dark / Light / P&L Based
//
// A MODE is what the user picks in Settings. A SKIN is what actually gets
// applied to the page via <html data-theme="...">:
//   'dark'  -> 'dark'
//   'light' -> 'light'
//   'pnl'   -> 'pnl-profit' | 'dark' | 'pnl-loss' (from the active account's
//              total all-time P&L: above $0 profit, below $0 loss, exactly
//              $0 (or no trades) stays neutral dark)
// ---------------------------------------------------------------------------

export const THEME_MODES = [
  { id: 'dark', label: 'Dark' },
  { id: 'light', label: 'Light' },
  { id: 'pnl', label: 'P&L Based' },
];

export const FALLBACK_THEME_MODE = 'dark';

export function getSafeThemeMode(value) {
  return THEME_MODES.some((m) => m.id === value) ? value : FALLBACK_THEME_MODE;
}

// First-visit default: follow the device (light OS -> light app).
export function getSystemThemeMode() {
  try {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  } catch {
    return FALLBACK_THEME_MODE;
  }
}

export function getTradesTotalPnl(trades) {
  return (trades || []).reduce((s, t) => s + (Number(t.profit ?? t.pnl) || 0), 0);
}

export function resolveSkin(mode, totalPnl) {
  if (mode === 'light') return 'light';
  if (mode === 'pnl') {
    if (totalPnl > 0) return 'pnl-profit';
    if (totalPnl < 0) return 'pnl-loss';
    return 'dark'; // exactly breakeven (or no trades) stays neutral dark
  }
  return 'dark';
}

// Charts need REAL colors: recharts stroke/fill props are SVG attributes, and
// CSS variables are not valid there — so charts read this palette through the
// useSkin() hook below. (Inline-style tooltips CAN use var(...), so those
// stay in CSS and need no palette entry.)
const FALLBACK_SKIN = 'dark';

export const CHART_SKINS = {
  dark: {
    grid: '#232836', tick: '#788296', cursor: 'rgba(255,255,255,0.08)',
    up: '#00e676', down: '#ff5252', blue: '#38bdf8', accent: '#2962ff',
  },
  light: {
    grid: '#e2e8f0', tick: '#64748b', cursor: 'rgba(15,23,42,0.06)',
    up: '#16a34a', down: '#dc2626', blue: '#0284c7', accent: '#2962ff',
  },
  'pnl-profit': {
    grid: '#173a24', tick: '#7ba88d', cursor: 'rgba(255,255,255,0.08)',
    up: '#00e676', down: '#ff5252', blue: '#38bdf8', accent: '#2962ff',
  },
  'pnl-loss': {
    grid: '#451b1b', tick: '#b07c7c', cursor: 'rgba(255,255,255,0.08)',
    up: '#00e676', down: '#ff5252', blue: '#38bdf8', accent: '#2962ff',
  },
};

export function chartPalette(skin) {
  return CHART_SKINS[skin] || CHART_SKINS[FALLBACK_SKIN];
}

// Broadcast channel: App publishes the current skin once, and every chart
// below reads it with useSkin() — no prop-drilling through layers that
// don't care about theming.
export const SkinContext = createContext(FALLBACK_SKIN);

export function useSkin() {
  return useContext(SkinContext);
}