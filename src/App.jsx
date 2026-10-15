import { useState, useEffect } from 'react';
import {
  LayoutDashboard, TrendingUp, Library, Package, Settings as SettingsIcon,
  Users, BookOpen, MessageCircle, PanelLeftOpen, PanelLeftClose,
  Coffee, MoreHorizontal, X
} from 'lucide-react';
import Dashboard from './component/dashboard.jsx';
import Analytics from './component/analytics.jsx';
import Playbooks from './component/playbooks.jsx';
import Imports from './component/import.jsx';
import Settings from './component/settings.jsx';
import Journal from './component/journal.jsx';
import FilterSheet from './component/FilterSheet.jsx';
import Feedback from './component/feedback.jsx';
import Landing from './component/Landing.jsx';
import AccountsPage, { DEFAULT_ACCOUNT_SETTINGS, createAccount } from './component/accounts.jsx';
import { STORAGE_KEYS, migrateLegacyKeys, clearAllAppStorage } from './utils/storageKeys.js';
import { sanitizeGlobalFilter } from './utils/dateUtils';
import {
  getSafeThemeMode, getSystemThemeMode, subscribeToSystemTheme,
  getTradesTotalPnl, resolveSkin, SkinContext,
} from './utils/themeConfig.js';
import { SHOW_LOVE_URL } from './config.js';

// Tabs that live inside the mobile "More" sheet. When one of them is active,
// the More tab in the bottom bar glows so the user knows where they are.
const MORE_SHEET_TABS = ['playbooks', 'imports', 'accounts', 'feedback', 'settings'];

// Every tab the app can boot into (last-tab memory + legacy default-page fallback).
const KNOWN_TABS = ['dashboard', 'journal', 'analytics', 'playbooks', 'imports', 'accounts', 'feedback', 'settings'];

// Mobile bottom-bar tabs: 3 direct pages + the More sheet opener.
const MOBILE_TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

// Entries inside the mobile "More" bottom sheet.
const MORE_SHEET_ENTRIES = [
  { id: 'playbooks', label: 'Playbooks', icon: Library },
  { id: 'imports', label: 'Imports', icon: Package },
  { id: 'accounts', label: 'Manage Accounts', icon: Users },
  { id: 'feedback', label: 'Support', icon: MessageCircle },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

// Browser tab title follows the open page (see effect below).
const TAB_TITLES = {
  dashboard: 'Dashboard', journal: 'Journal', analytics: 'Analytics',
  playbooks: 'Playbooks', imports: 'Imports', accounts: 'Manage Accounts',
  feedback: 'Support', settings: 'Settings',
};

// Currency code -> symbol (passed down to Playbooks; Dashboard/journal map their own).
const CUR = { USD: '$', EUR: '€', GBP: '£', NGN: '₦' };

// Keys whose stored JSON failed to parse on this load. Populated by readJSON()
// during first render's state initializers; the rescue banner below reads it.
const corruptStorageKeys = [];

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      // Corrupt but potentially recoverable: preserve the raw blob BEFORE any
      // persist effect overwrites it, then fall back so the app still loads.
      try {
        localStorage.setItem(key + '__corrupt_backup', raw);
      } catch { /* storage full/blocked — nothing more we can do */ }
      if (!corruptStorageKeys.includes(key)) corruptStorageKeys.push(key);
      console.warn('[PnL Lens] Stored data for "' + key + '" failed to parse. Raw value preserved under "' + key + '__corrupt_backup".');
      return fallback;
    }
  } catch {
    return fallback;
  }
}

// App name = display name stripped to letters & numbers (empty -> default).
function sanitizeAppName(value) {
  return (value || '').replace(/[^a-zA-Z0-9]/g, '');
}

// One-time repair for CSV imports stored before the wall-time fix: their openAt/
// closeAt instants were shifted by the browser UTC offset at import. This adds
// the offset back once (stored values lose their 'Z', so it never re-runs).
function migrateCsvTimestamps(trades) {
  if (!Array.isArray(trades) || trades.length === 0) return Array.isArray(trades) ? trades : [];
  const shiftMs = -new Date().getTimezoneOffset() * 60000;
  const pad = (n) => String(n).padStart(2, '0');
  return trades.map((t) => {
    if (!t || t.source !== 'MT5_CSV') return t;
    let nt = t;
    let openMigrated = false;
    for (const k of ['openAt', 'openTime', 'closeAt', 'closeTime']) {
      const v = t[k];
      if (typeof v !== 'string' || !/Z$/.test(v)) continue;
      const d = new Date(v);
      if (isNaN(d.getTime())) continue;
      const w = new Date(d.getTime() + shiftMs);
      nt = { ...nt, [k]: `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}T${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}:${pad(w.getUTCSeconds())}` };
      if (k === 'openAt') openMigrated = true;
    }
    if (openMigrated) nt = { ...nt, date: String(nt.openAt).slice(0, 10) };
    return nt;
  });
}

// Every account guaranteed the full shape: { id, name, trades[], settings }.
function loadInitialAccounts() {
  const stored = readJSON(STORAGE_KEYS.accounts, null);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.map((a) => ({
      id: a.id || ('acc-' + Math.random().toString(36).slice(2)),
      name: a.name || 'Account',
      trades: migrateCsvTimestamps(Array.isArray(a.trades) ? a.trades : []),
      settings: { ...DEFAULT_ACCOUNT_SETTINGS, ...(a.settings || {}) },
    }));
  }
  // Very old single-account installs: adopt their trades + settings once.
  const legacyTrades = readJSON(STORAGE_KEYS.legacyTrades, null);
  if (Array.isArray(legacyTrades) && legacyTrades.length > 0) {
    const legacySettings = readJSON(STORAGE_KEYS.legacySettings, {});
    return [{
      ...createAccount('Account 1'),
      trades: migrateCsvTimestamps(legacyTrades),
      settings: { ...DEFAULT_ACCOUNT_SETTINGS, ...(legacySettings || {}) },
    }];
  }
  return [createAccount('Account 1')];
}

export default function App() {
  // One-time migration: pre-rebrand 'tradersstack_*' keys -> 'mypnllens_*'.
  useEffect(() => { migrateLegacyKeys(); }, []);

  // ---- Accounts (persisted) ----
  const [accounts, setAccounts] = useState(loadInitialAccounts);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts)); } catch { /* storage full/blocked */ }
  }, [accounts]);

  const [activeAccountId, setActiveAccountId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.activeAccount) || null; } catch { return null; }
  });
  // Keep the active id pointing at a real account (fresh installs, deleted acts).
  useEffect(() => {
    if (accounts.length > 0 && !accounts.some((a) => a.id === activeAccountId)) {
      setActiveAccountId(accounts[0].id);
    }
  }, [accounts, activeAccountId]);
  useEffect(() => {
    try {
      if (activeAccountId) localStorage.setItem(STORAGE_KEYS.activeAccount, activeAccountId);
    } catch { /* storage full/blocked */ }
  }, [activeAccountId]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0] || null;
  const trades = activeAccount?.trades || [];

  // Functional-form aware: pages call setTrades(array) AND setTrades(prev => ...).
  const updateActiveAccountTrades = (updater) => {
    const id = activeAccount?.id;
    if (!id) return;
    setAccounts((prev) => prev.map((a) => (
      a.id === id
        ? { ...a, trades: typeof updater === 'function' ? updater(a.trades) : updater }
        : a
    )));
  };

  // ---- Playbooks (persisted, shared across accounts) ----
  const [playbooks, setPlaybooks] = useState(() => {
    const v = readJSON(STORAGE_KEYS.playbooks, []);
    return Array.isArray(v) ? v : [];
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.playbooks, JSON.stringify(playbooks)); } catch { /* storage full/blocked */ }
  }, [playbooks]);

  // ---- Import/export activity log (persisted) ----
  const [activityLog, setActivityLog] = useState(() => {
    const v = readJSON(STORAGE_KEYS.activityLog, []);
    return Array.isArray(v) ? v : [];
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.activityLog, JSON.stringify(activityLog)); } catch { /* storage full/blocked */ }
  }, [activityLog]);
  const logActivity = (type, filename, count) => {
    setActivityLog((prev) => [{
      id: 'log-' + Date.now(),
      type,
      filename,
      tradeCount: count,
      timestamp: new Date().toISOString(),
    }, ...(prev || [])].slice(0, 100));
  };
  const clearActivityLog = () => {
    if (confirm('Clear the import/export history log?')) setActivityLog([]);
  };

  // ---- Per-account settings (+ Settings page writers) ----
  const settings = { ...DEFAULT_ACCOUNT_SETTINGS, ...(activeAccount?.settings || {}) };
  const setSettings = (updater) => {
    const id = activeAccount?.id;
    if (!id) return;
    setAccounts((prev) => prev.map((a) => (
      a.id === id
        ? { ...a, settings: typeof updater === 'function' ? updater(a.settings) : updater }
        : a
    )));
  };
  const accountName = activeAccount?.name || 'Account';
  const resetCurrentAccountData = () => {
    if (!activeAccount) return;
    if (!confirm(`Clear ALL trades in "${activeAccount.name}"? Settings are kept. This cannot be undone.`)) return;
    updateActiveAccountTrades([]);
  };
  const resetCurrentAccountEverything = () => {
    if (!activeAccount) return;
    if (!confirm(`Reset "${activeAccount.name}" — clears trades AND settings back to defaults? This cannot be undone.`)) return;
    const id = activeAccount.id;
    setAccounts((prev) => prev.map((a) => (
      a.id === id ? { ...a, trades: [], settings: { ...DEFAULT_ACCOUNT_SETTINGS } } : a
    )));
  };
  const resetAllAppData = () => {
    if (!confirm('WIPE EVERYTHING? All accounts, trades, playbooks and settings on this device will be permanently deleted.')) return;
    if (!confirm('Last chance — really delete ALL app data?')) return;
    clearAllAppStorage();
    window.location.reload();
  };

  // ---- Global personalization (persisted) ----
  const [displayName, setDisplayNameState] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.displayName) || ''; } catch { return ''; }
  });
  const setDisplayName = (name) => {
    setDisplayNameState(name || '');
    try { localStorage.setItem(STORAGE_KEYS.displayName, name || ''); } catch { /* storage full/blocked */ }
  };
  const appName = sanitizeAppName(displayName) || 'My_PnL_Lens';

  // ---- Theme mode -> skin (see themeConfig.js). Applied via <html data-theme>
  // so the pre-paint snippet in index.html and React never disagree. ----
  const [themeMode, setThemeModeState] = useState(() => {
    try { return getSafeThemeMode(localStorage.getItem(STORAGE_KEYS.theme)); } catch { return 'system'; }
  });
  const setThemeMode = (mode) => {
    const safe = getSafeThemeMode(mode);
    setThemeModeState(safe);
    try { localStorage.setItem(STORAGE_KEYS.theme, safe); } catch { /* storage full/blocked */ }
  };
  const [systemSkin, setSystemSkin] = useState(() => getSystemThemeMode());
  useEffect(() => subscribeToSystemTheme(setSystemSkin), []);
  const skin = resolveSkin(themeMode, getTradesTotalPnl(trades), systemSkin);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', skin);
  }, [skin]);

  // ---- Navigation (last-tab memory: reloads reopen where you left off) ----
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const last = localStorage.getItem(STORAGE_KEYS.lastTab);
      if (last && KNOWN_TABS.includes(last)) return last;
      // One-time courtesy for pre-memory installs: honor their old Default Page once.
      const legacy = localStorage.getItem(STORAGE_KEYS.defaultPage);
      if (legacy && KNOWN_TABS.includes(legacy)) return legacy;
    } catch { /* fresh default below */ }
    return 'journal';
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.lastTab, activeTab); } catch { /* storage full/blocked */ }
  }, [activeTab]);

  // Desktop pinned sidebar: expanded panel <-> 76px icon rail. Persisted so
  // the user's choice of full sidebar vs slim rail survives reloads.
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(navCollapsed)); } catch { /* storage full/blocked */ }
  }, [navCollapsed]);

  // ---- Global cross-page filter (persisted, shape-guarded: a corrupt stored
  // value resets to "show everything" instead of crashing a page) ----
  const [globalFilter, setGlobalFilter] = useState(() =>
    sanitizeGlobalFilter(readJSON(STORAGE_KEYS.globalFilter, null))
  );
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.globalFilter, JSON.stringify(globalFilter)); } catch { /* storage full/blocked */ }
  }, [globalFilter]);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Mobile "More" bottom sheet visibility. Closed by selecting an entry,
  // tapping the backdrop, pressing Escape, or tapping the More tab again.
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  // Dismiss flag for the corrupt-storage rescue banner (Fix 1). Default true
  // (visible) — the banner itself only renders when corruptStorageKeys is non-empty.
  const [showStorageWarning, setShowStorageWarning] = useState(true);
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') setMoreSheetOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Lock background scroll while the More sheet is open (phones).
  useEffect(() => {
    document.body.style.overflow = moreSheetOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [moreSheetOpen]);

  // ---- Landing gate (first launch shows the Landing page) ----
  const [entered, setEntered] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEYS.enteredApp) === 'true'; } catch { return false; }
  });
  const totalTrades = accounts.reduce((n, a) => n + (Array.isArray(a.trades) ? a.trades.length : 0), 0);
  const handleLaunch = () => {
    try { localStorage.setItem(STORAGE_KEYS.enteredApp, 'true'); } catch { /* storage full/blocked */ }
    setEntered(true);
  };

  // Desktop nav click — the pinned sidebar never closes on navigation.
  const handleNav = (tab) => { setActiveTab(tab); };

  // Mobile nav click — also closes the More sheet (direct tabs render the
  // sheet closed anyway; sheet entries close it after navigating).
  const handleMobileNav = (tab) => { setActiveTab(tab); setMoreSheetOpen(false); };

  // Browser tab title follows the open page.
  useEffect(() => {
    document.title = `${TAB_TITLES[activeTab] || 'Journal'} · ${appName}`;
  }, [activeTab, appName]);

  // Nickname for the mobile header: first word of account name, max 12 chars.
  const activeNickname = (activeAccount?.name || 'Account').split(' ')[0].slice(0, 12);

  if (!entered) {
    return <Landing onLaunch={handleLaunch} tradeCount={totalTrades} />;
  }

  return (
    <SkinContext.Provider value={skin}>
      <div className={`app-shell ${navCollapsed ? 'nav-collapsed' : ''}`} style={{ minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
        {/* ============ DESKTOP PINNED SIDEBAR (hidden on phones, see index.css).
            Always visible on desktop — collapse toggle flips it between the full
            panel and the 76px icon rail. Labels/account/footer only render when
            expanded; the rail keeps icon buttons with tooltips instead. ============ */}
        <aside className="ts-sidebar" style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', padding: '20px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
          {navCollapsed ? (
            /* ---- Collapsed icon rail: logo dot, page icons, account shortcut,
                   collapse toggle, love icon. Every button has a tooltip. ---- */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', height: '100%' }}>
              <div title={appName} style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', color: '#fff', flexShrink: 0, boxShadow: '0 4px 12px rgba(41, 98, 255, 0.4)', marginBottom: '12px' }}>
                {appName.charAt(0).toUpperCase()}
              </div>
              <NavBtn icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleNav('dashboard')} collapsed />
              <NavBtn icon={BookOpen} label="Journal" active={activeTab === 'journal'} onClick={() => handleNav('journal')} collapsed />
              <NavBtn icon={TrendingUp} label="Analytics" active={activeTab === 'analytics'} onClick={() => handleNav('analytics')} collapsed />
              <NavBtn icon={Library} label="Playbooks" active={activeTab === 'playbooks'} onClick={() => handleNav('playbooks')} collapsed />
              <NavBtn icon={Package} label="Imports" active={activeTab === 'imports'} onClick={() => handleNav('imports')} collapsed />
              <NavBtn icon={MessageCircle} label="Support" active={activeTab === 'feedback'} onClick={() => handleNav('feedback')} collapsed />
              <NavBtn icon={SettingsIcon} label="Settings" active={activeTab === 'settings'} onClick={() => handleNav('settings')} collapsed />
              <NavBtn icon={Users} label="Manage Accounts" active={activeTab === 'accounts'} onClick={() => handleNav('accounts')} collapsed />
              <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <button className="rail-icon-btn" aria-label="Expand sidebar" title="Expand sidebar" onClick={() => setNavCollapsed(false)}>
                  <PanelLeftOpen size={18} />
                </button>
                <a className="rail-icon-btn" href={SHOW_LOVE_URL} target="_blank" rel="noopener noreferrer" aria-label="Show some love" title="Show some love — support My_PnL_Lens">
                  <Coffee size={16} />
                </a>
              </div>
            </div>
          ) : (
            /* ---- Expanded panel: logo, account switcher, full nav, footer. ---- */
            <>
              <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: '4px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', color: '#fff', flexShrink: 0, boxShadow: '0 4px 12px rgba(41, 98, 255, 0.4)' }}>
                  {appName.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Applied the brand font and capitalization formatting */}
                  <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em', color: 'var(--text-bright)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={appName}>
                    {appName}
                  </h2>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>PRO JOURNAL</span>
                </div>
                <button className="sidebar-close-btn" aria-label="Collapse sidebar" title="Collapse sidebar" onClick={() => setNavCollapsed(true)}>
                  <PanelLeftClose size={18} />
                </button>
              </div>
              <div className="account-switcher" style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px', paddingLeft: '4px' }}>Active Account</label>
                <select value={activeAccountId || ''} onChange={(e) => setActiveAccountId(e.target.value)} className="ts-input" style={{ fontSize: '13px', fontWeight: 600 }}>
                  {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name} ({a.trades.length})</option>))}
                </select>
                <button onClick={() => handleNav('accounts')} style={{ marginTop: '6px', width: '100%', background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', borderRadius: '6px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Users size={12} /> Manage Accounts</button>
              </div>
              <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <NavBtn icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleNav('dashboard')} />
                <NavBtn icon={BookOpen} label="Journal" active={activeTab === 'journal'} onClick={() => handleNav('journal')} />
                <NavBtn icon={TrendingUp} label="Analytics" active={activeTab === 'analytics'} onClick={() => handleNav('analytics')} />
                <NavBtn icon={Library} label="Playbooks" active={activeTab === 'playbooks'} onClick={() => handleNav('playbooks')} />
                <NavBtn icon={Package} label="Imports" active={activeTab === 'imports'} onClick={() => handleNav('imports')} />
                <NavBtn icon={MessageCircle} label="Support" active={activeTab === 'feedback'} onClick={() => handleNav('feedback')} />
                <NavBtn icon={SettingsIcon} label="Settings" active={activeTab === 'settings'} onClick={() => handleNav('settings')} />
              </nav>
              <div className="sidebar-footer ts-card" style={{ padding: '12px', backgroundColor: 'var(--bg-main)', marginTop: 'auto' }}>
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>ACTIVE ACCOUNT</p>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '4px' }}>{activeAccount?.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><span className="number-font" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{trades.length}</span> trades logged</div>
                <a href={SHOW_LOVE_URL} target="_blank" rel="noopener noreferrer" title="Support My_PnL_Lens on Selar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '10px', padding: '8px', textAlign: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '6px', color: 'var(--color-amber-text)', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
                  <Coffee size={13} /> Show some love
                </a>
              </div>
            </>
          )}
        </aside>

        {/* ============ MOBILE HEADER (phones only, see index.css): logo dot +
            nickname + compact account switcher. Desktop never renders this. ============ */}
        <header className="mobile-header">
          <div className="mobile-brand">
            <div className="mobile-logo" style={{ backgroundColor: 'var(--accent-blue)' }}>
              {appName.charAt(0).toUpperCase()}
            </div>
            <span className="mobile-nickname" title={activeAccount?.name || ''}>{activeNickname}</span>
          </div>
          <select
            className="ts-input mobile-account-select"
            value={activeAccountId || ''}
            onChange={(e) => setActiveAccountId(e.target.value)}
            aria-label="Active account"
            style={{ width: 'auto' }}
          >
            {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name} ({a.trades.length})</option>))}
          </select>
        </header>

        <main key={activeAccountId} className="ts-main" style={{ flex: 1, minWidth: 0, padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
          {/* Rescue banner (Fix 1): only renders when stored data failed to parse on load. */}
          {showStorageWarning && corruptStorageKeys.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid #f59e0b', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px', lineHeight: 1.2 }}>⚠️</span>
              <div style={{ flex: 1, fontSize: '13px' }}>
                <strong>Some saved data couldn’t be read, so a fresh copy was started.</strong>
                <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                  The unreadable data was preserved in this browser (keys: {corruptStorageKeys.join(', ')}). Restore from Settings → Import Backup if you have one.
                </div>
              </div>
              <button onClick={() => setShowStorageWarning(false)} className="ts-btn ts-btn-ghost" style={{ flexShrink: 0 }}>Dismiss</button>
            </div>
          )}
          {activeTab === 'dashboard' && <Dashboard trades={trades} settings={settings} brandName={appName} globalFilter={globalFilter} onOpenFilters={() => setFilterSheetOpen(true)} />}
          {activeTab === 'journal' && <Journal trades={trades} setTrades={updateActiveAccountTrades} playbooks={playbooks} logActivity={logActivity} settings={settings} globalFilter={globalFilter} onOpenFilters={() => setFilterSheetOpen(true)} />}
          {activeTab === 'analytics' && <Analytics trades={trades} playbooks={playbooks} settings={settings} globalFilter={globalFilter} onOpenFilters={() => setFilterSheetOpen(true)} />}
          {activeTab === 'playbooks' && <Playbooks trades={trades} setTrades={updateActiveAccountTrades} playbooks={playbooks} setPlaybooks={setPlaybooks} currency={CUR[settings.currency] || '$'} />}
          {activeTab === 'imports' && <Imports trades={trades} setTrades={updateActiveAccountTrades} logActivity={logActivity} activityLog={activityLog} clearActivityLog={clearActivityLog} settings={settings} />}
          {activeTab === 'feedback' && <Feedback />}
          {activeTab === 'settings' && (
            <Settings
              settings={settings}
              setSettings={setSettings}
              accountName={accountName}
              resetCurrentAccountData={resetCurrentAccountData}
              resetCurrentAccountEverything={resetCurrentAccountEverything}
              resetAllAppData={resetAllAppData}
              displayName={displayName}
              setDisplayName={setDisplayName}
              appName={appName}
              themeMode={themeMode}
              setThemeMode={setThemeMode}
            />
          )}
          {activeTab === 'accounts' && <AccountsPage accounts={accounts} setAccounts={setAccounts} activeAccountId={activeAccountId} setActiveAccountId={setActiveAccountId} />}
        </main>

        {/* ============ MOBILE BOTTOM TAB BAR (phones only, see index.css).
            Dashboard / Journal / Analytics navigate directly; More opens the
            sheet below. Hidden on desktop. ============ */}
        <nav className="mobile-tabbar" aria-label="Primary">
          {MOBILE_TABS.map(({ id, label, icon: Icon }) => {
            const isMore = id === 'more';
            const active = isMore
              ? moreSheetOpen || MORE_SHEET_TABS.includes(activeTab)
              : activeTab === id;
            return (
              <button
                key={id}
                className={`mobile-tab ${active ? 'active' : ''}`}
                onClick={() => (isMore ? setMoreSheetOpen((v) => !v) : handleMobileNav(id))}
                aria-label={label}
              >
                <Icon size={21} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* ============ MOBILE "MORE" BOTTOM SHEET (phones only). Backdrop tap
            or Escape closes it; entries navigate then close. ============ */}
        {moreSheetOpen && (
          <div className="more-backdrop" onClick={() => setMoreSheetOpen(false)}>
            <div className="more-sheet" role="dialog" aria-label="More options" onClick={(e) => e.stopPropagation()}>
              <div className="more-grabber" />
              {MORE_SHEET_ENTRIES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={`more-entry ${activeTab === id ? 'active' : ''}`}
                  onClick={() => handleMobileNav(id)}
                >
                  <Icon size={19} />
                  <span>{label}</span>
                </button>
              ))}
              <a className="more-love" href={SHOW_LOVE_URL} target="_blank" rel="noopener noreferrer">
                <Coffee size={15} /> Show some love
              </a>
              <button className="more-close" onClick={() => setMoreSheetOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* ============ GLOBAL FILTER SHEET (one filter shared by Dashboard,
            Analytics & Journal; backdrop tap, Escape, or Done closes it). ============ */}
        {filterSheetOpen && (
          <FilterSheet
            trades={trades}
            value={globalFilter}
            onChange={setGlobalFilter}
            onClose={() => setFilterSheetOpen(false)}
          />
        )}
      </div>
    </SkinContext.Provider>
  );
}

function NavBtn({ icon: Icon, label, active, onClick, collapsed = false }) {
  // Collapsed rail button: square icon-only button with a tooltip.
  if (collapsed) {
    return (
      <button
        onClick={onClick}
        title={label}
        aria-label={label}
        className="rail-icon-btn"
        style={{
          backgroundColor: active ? 'var(--nav-active-bg)' : 'transparent',
          color: active ? 'var(--nav-active-text)' : 'var(--text-secondary)',
        }}
      >
        <Icon size={19} />
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
        borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px',
        fontWeight: active ? 700 : 500, width: '100%', textAlign: 'left',
        backgroundColor: active ? 'var(--nav-active-bg)' : 'transparent',
        color: active ? 'var(--nav-active-text)' : 'var(--text-secondary)',
        transition: 'background-color 0.15s ease, color 0.15s ease',
      }}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}