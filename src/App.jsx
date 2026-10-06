import { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, TrendingUp, Library, Package, Settings as SettingsIcon,
  Users, BookOpen, MessageCircle, PanelLeftOpen, PanelLeftClose,
  Coffee, MoreHorizontal, X
} from 'lucide-react';
import Dashboard from './pages/dashboard.jsx';
import Analytics from './pages/analytics.jsx';
import Playbooks from './pages/playbooks.jsx';
import Imports from './pages/imports.jsx';
import Settings from './pages/settings.jsx';
import AccountsPage from './pages/accounts.jsx';
import Journal from './pages/journal.jsx';
import Feedback from './pages/feedback.jsx';
import { STORAGE_KEYS, loadAccounts, loadSettings } from './lib/storageKeys.js';

// Selar "Show Love" tipping link — the Buy-Me-A-Coffee equivalent for Nigeria.
const SHOW_LOVE_URL = 'https://selar.com/showlove/mypnllens';

// Tabs that live inside the mobile "More" sheet. When one of them is active,
// the More tab in the bottom bar glows so the user knows where they are.
const MORE_SHEET_TABS = ['playbooks', 'imports', 'accounts', 'feedback', 'settings'];

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

export default function App() {
  // Load persisted accounts immediately (lazy useState initializer).
  const [accounts, setAccounts] = useState(() => loadAccounts());
  const [activeAccountId, setActiveAccountId] = useState(() => accounts[0]?.id || null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsVersion, setSettingsVersion] = useState(0);

  // Desktop pinned sidebar: expanded panel <-> 76px icon rail. Persisted so
  // the user's choice of full sidebar vs slim rail survives reloads.
  const [navCollapsed, setNavCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === 'true'
  );
  useEffect(
    () => localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, String(navCollapsed)),
    [navCollapsed]
  );

  // Mobile "More" bottom sheet visibility. Closed by selecting an entry,
  // tapping the backdrop, pressing Escape, or tapping the More tab again.
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') setMoreSheetOpen(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Apply Capitalize Names + theme mode to the whole app (re-run after Settings saves).
  useEffect(() => {
    const settings = loadSettings();
    document.documentElement.classList.toggle('capitalize-names', settings.capitalizeNames === true);
    // THEME: apply the saved mode (dark / light / system).
    const root = document.documentElement;
    root.classList.remove('theme-dark', 'theme-light');
    const mode = settings.themeMode || 'dark';
    if (mode === 'system') {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      root.classList.add(prefersLight ? 'theme-light' : 'theme-dark');
    } else {
      root.classList.add(mode === 'light' ? 'theme-light' : 'theme-dark');
    }
  }, [settingsVersion]);

  const activeAccount = accounts.find((a) => a.id === activeAccountId) || accounts[0] || null;
  const trades = useMemo(
    () => (activeAccount ? [...activeAccount.trades].sort((a, b) => new Date(b.date) - new Date(a.date)) : []),
    [activeAccount]
  );

  const updateActiveAccountTrades = (newTrades) => {
    setAccounts((prev) => prev.map((a) => (a.id === activeAccount?.id ? { ...a, trades: newTrades } : a)));
  };

  // Desktop nav click — the pinned sidebar never closes on navigation.
  const handleNav = (tab) => { setActiveTab(tab); };

  // Mobile nav click — also closes the More sheet (direct tabs render the
  // sheet closed anyway; sheet entries close it after navigating).
  const handleMobileNav = (tab) => { setActiveTab(tab); setMoreSheetOpen(false); };

  // Custom Event Name or Fallback
  const settings = loadSettings();
  const appName = settings.appName && settings.appName.trim() !== '' ? settings.appName : 'My_PnL_Lens';

  // Nickname for the mobile header: first word of account name, max 12 chars.
  const activeNickname = (activeAccount?.name || 'Account').split(' ')[0].slice(0, 12);

  return (
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

      <main className="ts-main" style={{ flex: 1, minWidth: 0, padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {activeTab === 'dashboard' && <Dashboard trades={trades} />}
        {activeTab === 'journal' && <Journal trades={trades} setTrades={updateActiveAccountTrades} accounts={accounts} setAccounts={setAccounts} activeAccount={activeAccount} />}
        {activeTab === 'analytics' && <Analytics trades={trades} />}
        {activeTab === 'playbooks' && <Playbooks />}
        {activeTab === 'imports' && <Imports trades={trades} setTrades={updateActiveAccountTrades} />}
        {activeTab === 'feedback' && <Feedback />}
        {activeTab === 'settings' && <Settings onSettingsSaved={() => setSettingsVersion((v) => v + 1)} />}
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
    </div>
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