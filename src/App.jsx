import { useState, useEffect } from 'react';
import Dashboard from './component/dashboard.jsx';
import Journal from './component/journal.jsx';
import Analytics from './component/analytics.jsx';
import Playbooks from './component/playbooks.jsx';
import Feedback from './component/feedback.jsx';
import Settings from './component/settings.jsx';
import Imports from './component/import.jsx';


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
};

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
  const [activeTab, setActiveTab] = useState('journal');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('tradersstack_sidebar_collapsed') === 'true';
  });

  // MULTI ACCOUNT + PER-ACCOUNT SETTINGS
  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem('tradersstack_accounts');
    if (saved) {
      const parsed = JSON.parse(saved);
      // migrate older accounts that have no settings object
      return parsed.map((a) => ({
        ...a,
        settings: { ...DEFAULT_SETTINGS, ...(a.settings || {}) },
        trades: a.trades || [],
      }));
    }

    // migrate old single-account data
    const oldTrades = localStorage.getItem('tradersstack_trades');
    const oldSettings = localStorage.getItem('tradersstack_settings');
    let settings = { ...DEFAULT_SETTINGS };
    try {
      if (oldSettings) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(oldSettings) };
    } catch {}

    return [{
      id: 'acc-' + Date.now(),
      name: 'Main Account',
      createdAt: new Date().toISOString(),
      trades: oldTrades ? JSON.parse(oldTrades) : [],
      settings,
    }];
  });

  const [activeAccountId, setActiveAccountId] = useState(() => {
    return localStorage.getItem('tradersstack_active_account') || null;
  });

  useEffect(() => {
    if (!activeAccountId && accounts.length > 0) {
      setActiveAccountId(accounts[0].id);
    }
  }, [accounts, activeAccountId]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0];
  const trades = activeAccount?.trades || [];
  const settings = activeAccount?.settings || DEFAULT_SETTINGS;

  const setTrades = (newTrades) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === activeAccountId
          ? { ...a, trades: typeof newTrades === 'function' ? newTrades(a.trades) : newTrades }
          : a
      )
    );
  };

  const setSettings = (newSettings) => {
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === activeAccountId
          ? {
              ...a,
              settings:
                typeof newSettings === 'function'
                  ? newSettings(a.settings || DEFAULT_SETTINGS)
                  : newSettings,
            }
          : a
      )
    );
  };

  const [playbooks, setPlaybooks] = useState(() => {
    const saved = localStorage.getItem('tradersstack_playbooks');
    return saved ? JSON.parse(saved) : DEFAULT_PLAYBOOKS;
  });

  const [activityLog, setActivityLog] = useState(() => {
    const saved = localStorage.getItem('tradersstack_activity_log');
    return saved ? JSON.parse(saved) : [];
  });

  const logActivity = (type, filename, tradeCount) => {
    const entry = {
      id: 'log-' + Date.now(),
      timestamp: new Date().toISOString(),
      type,
      filename,
      tradeCount,
      accountId: activeAccountId,
      accountName: activeAccount?.name || 'Unknown',
    };
    setActivityLog((prev) => [entry, ...prev].slice(0, 200));
  };

  const clearActivityLog = () => {
    if (confirm('Clear all import/export history?')) setActivityLog([]);
  };

  // PERSIST
  useEffect(() => {
    try {
      localStorage.setItem('tradersstack_accounts', JSON.stringify(accounts));
    } catch (e) {
      console.warn('Storage quota exceeded.', e);
    }
  }, [accounts]);

  useEffect(() => {
    if (activeAccountId) localStorage.setItem('tradersstack_active_account', activeAccountId);
  }, [activeAccountId]);

  useEffect(() => {
    localStorage.setItem('tradersstack_playbooks', JSON.stringify(playbooks));
  }, [playbooks]);

  useEffect(() => {
    localStorage.setItem('tradersstack_activity_log', JSON.stringify(activityLog));
  }, [activityLog]);

  useEffect(() => {
    localStorage.setItem('tradersstack_sidebar_collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // ACCOUNT CRUD
  const addAccount = (name) => {
    if (!name?.trim()) return;
    const newAcc = makeAccount(name.trim());
    setAccounts([...accounts, newAcc]);
    setActiveAccountId(newAcc.id);
  };

  const renameAccount = (id, newName) => {
    if (!newName?.trim()) return;
    setAccounts(accounts.map((a) => (a.id === id ? { ...a, name: newName.trim() } : a)));
  };

  const deleteAccount = (id) => {
    if (accounts.length <= 1) {
      alert('You must have at least one account.');
      return;
    }
    if (!confirm('Delete this account and all its trades/settings? This cannot be undone.')) return;
    const remaining = accounts.filter((a) => a.id !== id);
    setAccounts(remaining);
    if (activeAccountId === id) setActiveAccountId(remaining[0].id);
  };

  // FULL RESET for current account or entire app
  const resetCurrentAccountData = () => {
    if (!confirm(`Clear ALL trades for "${activeAccount?.name}"? Settings will stay.`)) return;
    setTrades([]);
  };

  const resetCurrentAccountEverything = () => {
    if (!confirm(`Reset "${activeAccount?.name}" completely (trades + settings)?`)) return;
    setAccounts((prev) =>
      prev.map((a) =>
        a.id === activeAccountId
          ? { ...a, trades: [], settings: { ...DEFAULT_SETTINGS } }
          : a
      )
    );
  };

  const resetAllAppData = () => {
    if (!confirm('⚠️ Wipe EVERYTHING? All accounts, trades, settings, playbooks, and import history?')) return;
    if (!confirm('This is permanent. Are you absolutely sure?')) return;

    const fresh = makeAccount('Main Account');
    setAccounts([fresh]);
    setActiveAccountId(fresh.id);
    setPlaybooks(DEFAULT_PLAYBOOKS);
    setActivityLog([]);

    // clear legacy keys too
    localStorage.removeItem('tradersstack_trades');
    localStorage.removeItem('tradersstack_settings');
    localStorage.removeItem('tradersstack_accounts');
    localStorage.removeItem('tradersstack_active_account');
    localStorage.removeItem('tradersstack_playbooks');
    localStorage.removeItem('tradersstack_activity_log');
    localStorage.removeItem('tradersstack_my_tickets');

    alert('All data cleared. Fresh start created.');
  };

  const handleNav = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      <button className="hamburger-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>

      <div className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside
        className={`ts-sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-color)',
          padding: '20px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          height: '100vh',
          flexShrink: 0,
          transition: 'width 0.2s ease',
        }}
      >
        <div>
          <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', paddingLeft: '4px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--accent-blue)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
              fontSize: '16px', color: '#fff', flexShrink: 0, boxShadow: '0 4px 12px rgba(41, 98, 255, 0.4)'
            }}>TS</div>
            {!sidebarCollapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#fff', margin: 0 }}>TradersStack</h2>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>PRO JOURNAL</span>
              </div>
            )}
          </div>

          <button className="collapse-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title={sidebarCollapsed ? 'Expand' : 'Collapse'}>
            {sidebarCollapsed ? '»' : '«'}
          </button>

          {!sidebarCollapsed && (
            <div className="account-switcher" style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px', paddingLeft: '4px' }}>
                Active Account
              </label>
              <select
                value={activeAccountId || ''}
                onChange={(e) => setActiveAccountId(e.target.value)}
                className="ts-input"
                style={{ fontSize: '13px', fontWeight: 600 }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.trades.length})</option>
                ))}
              </select>
              <button
                onClick={() => handleNav('accounts')}
                style={{
                  marginTop: '6px', width: '100%', background: 'transparent', border: '1px dashed var(--border-color)',
                  color: 'var(--text-secondary)', borderRadius: '6px', padding: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600,
                }}
              >
                ⚙ Manage Accounts
              </button>
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
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span className="number-font" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>{trades.length}</span> trades logged
            </div>
          </div>
        )}
      </aside>

      <main className="ts-main" style={{ flex: 1, padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'dashboard' && <Dashboard trades={trades} settings={settings} />}
        {activeTab === 'journal' && <Journal trades={trades} setTrades={setTrades} playbooks={playbooks} logActivity={logActivity} />}
        {activeTab === 'analytics' && <Analytics trades={trades} settings={settings} />}
        {activeTab === 'playbooks' && <Playbooks trades={trades} setTrades={setTrades} playbooks={playbooks} setPlaybooks={setPlaybooks} />}
        {activeTab === 'imports' && <Imports activityLog={activityLog} clearActivityLog={clearActivityLog} />}
        {activeTab === 'accounts' && (
          <AccountsPage
            accounts={accounts}
            activeAccountId={activeAccountId}
            setActiveAccountId={setActiveAccountId}
            addAccount={addAccount}
            renameAccount={renameAccount}
            deleteAccount={deleteAccount}
          />
        )}
        {activeTab === 'feedback' && <Feedback />}
        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            setSettings={setSettings}
            accountName={activeAccount?.name || 'Account'}
            resetCurrentAccountData={resetCurrentAccountData}
            resetCurrentAccountEverything={resetCurrentAccountEverything}
            resetAllAppData={resetAllAppData}
          />
        )}
      </main>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick, collapsed }) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        padding: collapsed ? '10px 0' : '10px 14px',
        backgroundColor: active ? 'rgba(41, 98, 255, 0.12)' : 'transparent',
        color: active ? '#60a5fa' : 'var(--text-secondary)',
        border: '1px solid',
        borderColor: active ? 'rgba(41, 98, 255, 0.3)' : 'transparent',
        borderRadius: 'var(--radius-sm)',
        textAlign: collapsed ? 'center' : 'left',
        cursor: 'pointer', fontSize: '13px',
        fontWeight: active ? 600 : 500,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '10px', transition: 'all 0.15s ease'
      }}
    >
      <span style={{ fontSize: '16px' }}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function AccountsPage({ accounts, activeAccountId, setActiveAccountId, addAccount, renameAccount, deleteAccount }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    addAccount(newName);
    setNewName('');
  };

  const startEdit = (a) => { setEditingId(a.id); setEditName(a.name); };
  const saveEdit = () => { renameAccount(editingId, editName); setEditingId(null); };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>⚙ Manage Accounts</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>Each account has its own trades AND its own settings.</p>
      </div>

      <form onSubmit={handleAdd} className="ts-card" style={{ marginBottom: '24px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input type="text" className="ts-input" placeholder="e.g. Prop Firm, Personal MT5, Demo" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1, minWidth: '200px' }} />
        <button type="submit" className="ts-btn ts-btn-success">+ Add Account</button>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
        {accounts.map((a) => {
          const netPnL = (a.trades || []).reduce((s, t) => s + (Number(t.profit) || 0), 0);
          const isActive = a.id === activeAccountId;
          return (
            <div key={a.id} className="ts-card" style={{ borderColor: isActive ? 'var(--accent-blue)' : 'var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                {editingId === a.id ? (
                  <input type="text" className="ts-input" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus onBlur={saveEdit} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} />
                ) : (
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#fff' }}>{a.name}</h3>
                    {isActive && <span style={{ fontSize: '10px', color: 'var(--accent-blue)', fontWeight: 700 }}>● ACTIVE</span>}
                  </div>
                )}
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