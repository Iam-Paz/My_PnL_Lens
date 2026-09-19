import { useState, useEffect } from 'react';
import Dashboard from './component/dashboard.jsx';
import Journal from './component/journal.jsx';
import Analytics from './component/analytics.jsx';
import Playbooks from './component/playbooks.jsx';
import Feedback from './component/feedback.jsx';
import Settings from './component/settings.jsx';
import Imports from './component/import.jsx';
import Landing from './component/Landing.jsx';
import { STORAGE_KEYS, migrateLegacyKeys, clearAllAppStorage } from './utils/storageKeys.js';
import { SHOW_LOVE_URL } from './config.js';

// Moves any pre-rebrand 'tradersstack_*' data to the new keys.
// Must run here (module level) BEFORE the useState initializers below read localStorage.
migrateLegacyKeys();

const DEFAULT_PLAYBOOKS = [
  { id: 'pb-1', title: 'Breakout', timeframe: '15m', riskPercent: '1%', description: 'Surge past key support or resistance', rules: ['Retest level', 'Volume spike'] },
  { id: 'pb-2', title: 'Pullback', timeframe: '1H', riskPercent: '1%', description: 'EMA continuation after trend', rules: ['20 EMA touch', 'Reversal candle'] },
  { id: 'pb-3', title: 'Reversal', timeframe: '4H', riskPercent: '0.5%', description: 'Key supply/demand zone reversal', rules: ['RSI Divergence', 'Key zone rejection'] },
  { id: 'pb-4', title: 'Trend Continuation', timeframe: '1H', riskPercent: '1%', description: 'Riding structure in trend direction', rules: ['Structure align', 'Clean 1:2 RR'] },
  { id: 'pb-5', title: 'Liquidity Sweep', timeframe: '15m', riskPercent: '1%', description: 'Stop hunt sweep at key levels', rules: ['Sweep equal highs/lows', 'Market Structure Shift'] },
];

const DEFAULT_SETTINGS = {
  traderName: 'Trader',
  currency: 'USD',
  startingBalance: 10000,
  riskPerTrade: 1,
  maxDrawdownPercent: 10,
  maxDailyDrawdownPercent: 3,
  brokerUtcOffset: 2,
};

// --- PHASE 4A: DEFAULT PAGE ---
const VALID_DEFAULT_PAGES = ['dashboard', 'journal', 'analytics', 'playbooks', 'imports', 'feedback', 'settings'];
const FALLBACK_DEFAULT_PAGE = 'journal';

function getSafeDefaultPage(value) {
  return VALID_DEFAULT_PAGES.includes(value) ? value : FALLBACK_DEFAULT_PAGE;
}

// --- PHASE 4A: DISPLAY NAME (POLISHED) ---
const FALLBACK_DISPLAY_NAME = 'my';
const MAX_DISPLAY_NAME_LENGTH = 20;

function normalizeDisplayName(raw) {
  if (typeof raw !== 'string') return FALLBACK_DISPLAY_NAME;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, MAX_DISPLAY_NAME_LENGTH);
  return cleaned || FALLBACK_DISPLAY_NAME;
}

// Capitalizes the first letter: paz -> Paz, my -> My
function toBrandLabel(displayName) {
  const base = normalizeDisplayName(displayName);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// Generates sidebar nickname: Paz_PnL_Lens (sidebar only — the public brand is always My_PnL_Lens)
function getAppName(displayName) {
  return `${toBrandLabel(displayName)}_PnL_Lens`;
}

function makeAccount(name, trades = []) {
  return {
    id: 'acc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name: name || 'Main Account',
    createdAt: new Date().toISOString(),
    trades,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export default function App() {
  // Landing gate — first visit sees the landing page, then never again
  const [enteredApp, setEnteredApp] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.enteredApp) === 'true';
  });

  const handleLaunch = () => {
    localStorage.setItem(STORAGE_KEYS.enteredApp, 'true');
    setEnteredApp(true);
  };

  // Default page
  const [defaultPage, setDefaultPageState] = useState(() => {
    return getSafeDefaultPage(localStorage.getItem(STORAGE_KEYS.defaultPage));
  });
  const [activeTab, setActiveTab] = useState(() => defaultPage);

  const setDefaultPage = (page) => {
    const safe = getSafeDefaultPage(page);
    setDefaultPageState(safe);
    localStorage.setItem(STORAGE_KEYS.defaultPage, safe);
  };

  // Display name
  const [displayName, setDisplayNameState] = useState(() => {
    return normalizeDisplayName(localStorage.getItem(STORAGE_KEYS.displayName) || FALLBACK_DISPLAY_NAME);
  });

  const setDisplayName = (raw) => {
    const safe = normalizeDisplayName(raw);
    setDisplayNameState(safe);
    localStorage.setItem(STORAGE_KEYS.displayName, safe);
  };

  const appName = getAppName(displayName);
  const logoBadge = displayName.slice(0, 2).toUpperCase();

  // Browser tab title — ALWAYS the main brand, never the nickname.
  // Branding rule: public surfaces = My_PnL_Lens, sidebar = personal playground.
  useEffect(() => {
    document.title = 'My_PnL_Lens';
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === 'true';
  });

  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.accounts);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((a) => ({
        ...a,
        settings: { ...DEFAULT_SETTINGS, ...(a.settings || {}) },
        trades: a.trades || [],
      }));
    }
    const oldTrades = localStorage.getItem(STORAGE_KEYS.legacyTrades);
    const oldSettings = localStorage.getItem(STORAGE_KEYS.legacySettings);
    let settings = { ...DEFAULT_SETTINGS };
    try { if (oldSettings) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(oldSettings) }; } catch (err) { console.warn('Failed to parse legacy mypnllens_settings from localStorage, falling back to defaults:', err); }
    return [{ id: 'acc-' + Date.now(), name: 'Main Account', createdAt: new Date().toISOString(), trades: oldTrades ? JSON.parse(oldTrades) : [], settings }];
  });

  const [activeAccountId, setActiveAccountId] = useState(() => localStorage.getItem(STORAGE_KEYS.activeAccount) || null);

  useEffect(() => { if (!activeAccountId && accounts.length > 0) setActiveAccountId(accounts[0].id); }, [accounts, activeAccountId]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];
  const trades = activeAccount?.trades || [];
  const settings = activeAccount?.settings || DEFAULT_SETTINGS;
  const totalTrades = accounts.reduce((s, a) => s + ((a.trades || []).length), 0);

  const setTrades = (newTrades) => {
    setAccounts((prev) => prev.map((a) => a.id === activeAccountId ? { ...a, trades: typeof newTrades === 'function' ? newTrades(a.trades) : newTrades } : a));
  };
  const setSettings = (newSettings) => {
    setAccounts((prev) => prev.map((a) => a.id === activeAccountId ? { ...a, settings: typeof newSettings === 'function' ? newSettings(a.settings || DEFAULT_SETTINGS) : newSettings } : a));
  };

  const [playbooks, setPlaybooks] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.playbooks);
    return saved ? JSON.parse(saved) : DEFAULT_PLAYBOOKS;
  });
  const [activityLog, setActivityLog] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.activityLog);
    return saved ? JSON.parse(saved) : [];
  });

  const logActivity = (type, filename, tradeCount) => {
    const entry = { id: 'log-' + Date.now(), timestamp: new Date().toISOString(), type, filename, tradeCount, accountId: activeAccountId, accountName: activeAccount?.name || 'Unknown' };
    setActivityLog((prev) => [entry, ...prev].slice(0, 200));
  };
  const clearActivityLog = () => { if (confirm('Clear all import/export history?')) setActivityLog([]); };

  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.accounts, JSON.stringify(accounts)); } catch (e) { console.warn('Storage quota exceeded.', e); } }, [accounts]);
  useEffect(() => { if (activeAccountId) localStorage.setItem(STORAGE_KEYS.activeAccount, activeAccountId); }, [activeAccountId]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.playbooks, JSON.stringify(playbooks)); }, [playbooks]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.activityLog, JSON.stringify(activityLog)); }, [activityLog]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(sidebarCollapsed)); }, [sidebarCollapsed]);

  const addAccount = (name) => { if (!name?.trim()) return; const newAcc = makeAccount(name.trim()); setAccounts([...accounts, newAcc]); setActiveAccountId(newAcc.id); };
  const renameAccount = (id, newName) => { if (!newName?.trim()) return; setAccounts(accounts.map((a) => (a.id === id ? { ...a, name: newName.trim() } : a))); };
  const deleteAccount = (id) => {
    if (accounts.length <= 1) { alert('You must have at least one account.'); return; }
    if (!confirm('Delete this account and all its trades/settings? This cannot be undone.')) return;
    const remaining = accounts.filter((a) => a.id !== id); setAccounts(remaining); if (activeAccountId === id) setActiveAccountId(remaining[0].id);
  };
  const resetCurrentAccountData = () => { if (!confirm(`Clear ALL trades for "${activeAccount?.name}"? Settings will stay.`)) return; setTrades([]); };
  const resetCurrentAccountEverything = () => { if (!confirm(`Reset "${activeAccount?.name}" completely (trades + settings)?`)) return; setAccounts((prev) => prev.map((a) => a.id === activeAccountId ? { ...a, trades: [], settings: { ...DEFAULT_SETTINGS } } : a)); };

  const resetAllAppData = () => {
    if (!confirm('⚠️ Wipe EVERYTHING? All accounts, trades, settings, playbooks, and import history?')) return;
    if (!confirm('This is permanent. Are you absolutely sure?')) return;
    const fresh = makeAccount('Main Account'); setAccounts([fresh]); setActiveAccountId(fresh.id); setPlaybooks(DEFAULT_PLAYBOOKS); setActivityLog([]);
    clearAllAppStorage();
    setDisplayNameState(FALLBACK_DISPLAY_NAME);
    setEnteredApp(false);
    alert('All data cleared. Fresh start created.');
  };

  const handleNav = (tab) => { setActiveTab(tab); setSidebarOpen(false); };
  useEffect(() => { const handleKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); }; window.addEventListener('keydown', handleKey); return () => window.removeEventListener('keydown', handleKey); }, []);

  // Landing gate (placed after all hooks): first-time visitors see the landing page
  if (!enteredApp) {
    return <Landing onLaunch={handleLaunch} tradeCount={totalTrades} />;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>{sidebarOpen ? '✕' : '☰'}</button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />
      {/* position is intentionally left out of this inline style: an inline
          position would always beat the mobile ".ts-sidebar { position: fixed }"
          media-query rule (inline styles win over non-!important CSS), which
          silently broke the off-canvas sidebar on tablet/mobile. Desktop's
          "sticky" default now lives in index.css instead, where the mobile
          override can actually take effect. */}
      <aside className={`ts-sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`} style={{ backgroundColor: 'var(--bg-surface)', borderRight: '1px solid var(--border-color)', padding: '20px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100vh', flexShrink: 0, transition: 'width 0.2s ease' }}>
        <div>
          <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: '4px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', color: '#fff', flexShrink: 0, boxShadow: '0 4px 12px rgba(41, 98, 255, 0.4)' }}>
              {logoBadge}
            </div>
            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Applied the brand font and capitalization formatting */}
                <h2 style={{ fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em', color: '#fff', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={appName}>
                  {appName}
                </h2>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>PRO JOURNAL</span>
              </div>
            )}
          </div>
          <button className="collapse-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'Expand' : 'Collapse'}>{sidebarCollapsed ? '»' : '«'}</button>
          {!sidebarCollapsed && (
            <div className="account-switcher" style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px', paddingLeft: '4px' }}>Active Account</label>
              <select value={activeAccountId || ''} onChange={(e) => setActiveAccountId(e.target.value)} className="ts-input" style={{ fontSize: '13px', fontWeight: 600 }}>
                {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name} ({a.trades.length})</option>))}
              </select>
              <button onClick={() => handleNav('accounts')} style={{ marginTop: '6px', width: '100%', background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', borderRadius: '6px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>⚙ Manage Accounts</button>
            </div>
          )}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <NavBtn icon="🏠" label="Dashboard" collapsed={sidebarCollapsed} active={activeTab === 'dashboard'} onClick={() => handleNav('dashboard')} />
            <NavBtn icon="📖" label="Journal" collapsed={sidebarCollapsed} active={activeTab === 'journal'} onClick={() => handleNav('journal')} />
            <NavBtn icon="📈" label="Analytics" collapsed={sidebarCollapsed} active={activeTab === 'analytics'} onClick={() => handleNav('analytics')} />
            <NavBtn icon="📚" label="Playbooks" collapsed={sidebarCollapsed} active={activeTab === 'playbooks'} onClick={() => handleNav('playbooks')} />
            <NavBtn icon="📦" label="Imports" collapsed={sidebarCollapsed} active={activeTab === 'imports'} onClick={() => handleNav('imports')} />
            <NavBtn icon="💬" label="Support" collapsed={sidebarCollapsed} active={activeTab === 'feedback'} onClick={() => handleNav('feedback')} />
            <NavBtn icon="⚙️" label="Settings" collapsed={sidebarCollapsed} active={activeTab === 'settings'} onClick={() => handleNav('settings')} />
          </nav>
        </div>
        {!sidebarCollapsed && (
          <div className="sidebar-footer ts-card" style={{ padding: '12px', backgroundColor: 'var(--bg-main)' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '4px' }}>ACTIVE ACCOUNT</p>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{activeAccount?.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}><span className="number-font" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{trades.length}</span> trades logged</div>
            <a href={SHOW_LOVE_URL} target="_blank" rel="noopener noreferrer" title="Support My_PnL_Lens on Selar" style={{ display: 'block', marginTop: '10px', padding: '8px', textAlign: 'center', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: '6px', color: '#f59e0b', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>
              ☕ Show some love
            </a>
          </div>
        )}
      </aside>

      {/* minWidth: 0 lets this flex child actually shrink to the viewport instead
          of stretching to fit its widest content (e.g. the journal table) — see
          https://css-tricks.com/flexbox-truncated-text/ for why flex items need
          this. Without it, children with their own overflow-x:auto wrappers
          couldn't scroll internally; the whole page scrolled sideways instead. */}
      <main className="ts-main" style={{ flex: 1, minWidth: 0, padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'dashboard' && <Dashboard trades={trades} settings={settings} />}
        {activeTab === 'journal' && <Journal trades={trades} setTrades={setTrades} playbooks={playbooks} logActivity={logActivity} settings={settings} />}
        {activeTab === 'analytics' && <Analytics trades={trades} playbooks={playbooks} settings={settings} />}
        {activeTab === 'playbooks' && <Playbooks trades={trades} setTrades={setTrades} playbooks={playbooks} setPlaybooks={setPlaybooks} />}
        {activeTab === 'imports' && (<Imports trades={trades} setTrades={setTrades} logActivity={logActivity} activityLog={activityLog} clearActivityLog={clearActivityLog} />)}
        {activeTab === 'accounts' && (<AccountsPage accounts={accounts} activeAccountId={activeAccountId} setActiveAccountId={setActiveAccountId} addAccount={addAccount} renameAccount={renameAccount} deleteAccount={deleteAccount} />)}
        {activeTab === 'feedback' && <Feedback />}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            setSettings={setSettings}
            accountName={activeAccount?.name || 'Account'}
            resetCurrentAccountData={resetCurrentAccountData}
            resetCurrentAccountEverything={resetCurrentAccountEverything}
            resetAllAppData={resetAllAppData}
            defaultPage={defaultPage}
            setDefaultPage={setDefaultPage}
            displayName={displayName}
            setDisplayName={setDisplayName}
            appName={appName}
          />
        )}
      </main>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick, collapsed }) {
  return (
    <button onClick={onClick} title={collapsed ? label : undefined} style={{ padding: collapsed ? '10px 0' : '10px 14px', backgroundColor: active ? 'rgba(41, 98, 255, 0.12)' : 'transparent', color: active ? '#60a5fa' : 'var(--text-secondary)', border: '1px solid', borderColor: active ? 'rgba(41, 98, 255, 0.3)' : 'transparent', borderRadius: 'var(--radius-sm)', textAlign: collapsed ? 'center' : 'left', cursor: 'pointer', fontSize: '13px', fontWeight: active ? 600 : 500, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: '10px', transition: 'all 0.15s ease' }}>
      <span style={{ fontSize: '16px' }}>{icon}</span>{!collapsed && <span>{label}</span>}
    </button>
  );
}

function AccountsPage({ accounts, activeAccountId, setActiveAccountId, addAccount, renameAccount, deleteAccount }) {
  const [newName, setNewName] = useState(''); const [editingId, setEditingId] = useState(null); const [editName, setEditName] = useState('');
  const handleAdd = (e) => { e.preventDefault(); if (!newName.trim()) return; addAccount(newName); setNewName(''); };
  const startEdit = (a) => { setEditingId(a.id); setEditName(a.name); }; const saveEdit = () => { renameAccount(editingId, editName); setEditingId(null); };
  return (
    <div>
      <div style={{ marginBottom: '24px' }}><h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>⚙ Manage Accounts</h1><p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>Each account has its own trades AND its own settings.</p></div>
      <form onSubmit={handleAdd} className="ts-card" style={{ marginBottom: '24px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input type="text" className="ts-input" placeholder="e.g. Prop Firm, Personal MT5, Demo" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1, minWidth: '200px' }} />
        <button type="submit" className="ts-btn ts-btn-success">+ Add Account</button>
      </form>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {accounts.map((a) => {
          const netPnL = (a.trades || []).reduce((s, t) => s + (Number(t.profit ?? t.pnl) || 0), 0);
          const isActive = a.id === activeAccountId;
          return (
            <div key={a.id} className="ts-card" style={{ borderColor: isActive ? 'var(--accent-blue)' : 'var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                {editingId === a.id ? (<input type="text" className="ts-input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />) : (<div><h3 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>{a.name}</h3>{isActive && <span style={{ fontSize: '10px', color: 'var(--accent-blue)', fontWeight: 700 }}>● ACTIVE</span>}</div>)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Trades: <span className="number-font" style={{ color: '#fff', fontWeight: 600 }}>{a.trades.length}</span></div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Balance setting: <span className="number-font">${Number(a.settings?.startingBalance || 0).toLocaleString()}</span></div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>Net P&L: <span className="number-font" style={{ color: netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 700 }}>{netPnL >= 0 ? '+' : '-'}${Math.abs(netPnL).toFixed(2)}</span></div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {!isActive && <button onClick={() => setActiveAccountId(a.id)} className="ts-btn ts-btn-primary" style={{ fontSize: '11px', padding: '6px 10px' }}>Switch to</button>}
                <button onClick={() => startEdit(a)} className="ts-btn ts-btn-ghost" style={{ fontSize: '11px', padding: '6px 10px' }}>✏️ Rename</button>
                <button onClick={() => deleteAccount(a.id)} className="ts-btn ts-btn-danger" style={{ fontSize: '11px', padding: '6px 10px' }}>🗑️ Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}