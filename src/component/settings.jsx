import { useState, useEffect } from 'react';

export default function Settings({
  settings,
  setSettings,
  accountName = 'Account',
  resetCurrentAccountData,
  resetCurrentAccountEverything,
  resetAllAppData,
  defaultPage = 'journal',
  setDefaultPage,
  displayName = 'my',
  setDisplayName,
  appName = 'My_PnL_Lens',
}) {
  const [savedMsg, setSavedMsg] = useState(false);
  const [nameDraft, setNameDraft] = useState(displayName);

  useEffect(() => {
    setNameDraft(displayName);
  }, [displayName]);

  const commitDisplayName = () => {
    if (setDisplayName) setDisplayName(nameDraft);
  };

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>⚙️ Settings</h1>

      <div style={{ marginBottom: '32px' }}>
        <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: '16px' }}>
          Global App Settings
        </p>
        <div className="ts-card" style={{ maxWidth: '520px' }}>
          <h3 style={sectionTitle}>Personalization</h3>

          <label style={labelStyle}>Display Name</label>
          <input
            type="text"
            className="ts-input"
            value={nameDraft}
            maxLength={40}
            placeholder="e.g. paz"
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitDisplayName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitDisplayName();
                e.target.blur();
              }
            }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
            App name preview:{' '}
            {/* Added brand font styling to the preview tag */}
            <strong style={{ color: '#fff', fontFamily: 'var(--font-brand)', fontWeight: 700, letterSpacing: '0.02em' }}>
              {appName}
            </strong>
            {' '}(letters & numbers only; empty becomes My_PnL_Lens)
          </span>

          <label style={{ ...labelStyle, marginTop: '16px' }}>Default Page</label>
          <select
            className="ts-input"
            value={defaultPage}
            onChange={(e) => setDefaultPage?.(e.target.value)}
          >
            <option value="dashboard">Dashboard</option>
            <option value="journal">Journal</option>
            <option value="analytics">Analytics</option>
            <option value="playbooks">Playbooks</option>
            <option value="imports">Imports</option>
            <option value="feedback">Feedback</option>
            <option value="settings">Settings</option>
          </select>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
            Opens on this page when you launch or refresh the app.
          </span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', margin: '32px 0', maxWidth: '520px' }} />

      <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: '24px' }}>
        Settings for <strong style={{ color: '#fff' }}>{accountName}</strong> only. Other accounts keep their own settings.
      </p>

      <form onSubmit={handleSave} style={{ maxWidth: '520px' }}>
        <div className="ts-card" style={{ marginBottom: '16px' }}>
          <h3 style={sectionTitle}>Profile</h3>
          <label style={labelStyle}>Trader Name (Account)</label>
          <input type="text" className="ts-input" value={settings.traderName || ''} onChange={(e) => handleChange('traderName', e.target.value)} />
          <label style={{ ...labelStyle, marginTop: '14px' }}>Account Currency</label>
          <select className="ts-input" value={settings.currency || 'USD'} onChange={(e) => handleChange('currency', e.target.value)}>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="NGN">NGN (₦)</option>
          </select>
        </div>

        <div className="ts-card" style={{ marginBottom: '16px' }}>
          <h3 style={sectionTitle}>Broker & Timezone</h3>
          <label style={labelStyle}>Broker Server Timezone (UTC Offset)</label>
          <select className="ts-input" value={settings.brokerUtcOffset ?? 2} onChange={(e) => handleChange('brokerUtcOffset', Number(e.target.value))}>
            <option value={-5}>UTC-5 (EST - US East)</option>
            <option value={0}>UTC+0 (GMT / London)</option>
            <option value={1}>UTC+1 (WAT / CET - Nigeria / Europe)</option>
            <option value={2}>UTC+2 (EET - Standard MT5 Default)</option>
            <option value={3}>UTC+3 (EEST - Summer MT5 Offset)</option>
          </select>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
            Used to convert broker times to your local time (Nigeria WAT) and for session analysis.
          </span>
        </div>

        <div className="ts-card" style={{ marginBottom: '16px' }}>
          <h3 style={sectionTitle}>Risk Defaults</h3>
          <label style={labelStyle}>Starting Balance</label>
          <input type="number" step="any" className="ts-input" value={settings.startingBalance ?? 10000} onChange={(e) => handleChange('startingBalance', Number(e.target.value))} />
          <label style={{ ...labelStyle, marginTop: '14px' }}>Default Risk Per Trade (%)</label>
          <input type="number" step="0.1" min="0.1" max="100" className="ts-input" value={settings.riskPerTrade ?? 1} onChange={(e) => handleChange('riskPerTrade', Number(e.target.value))} />
          <label style={{ ...labelStyle, marginTop: '14px' }}>Maximum Drawdown Limit (%)</label>
          <input type="number" step="0.1" min="0" max="100" className="ts-input" value={settings.maxDrawdownPercent ?? 10} onChange={(e) => handleChange('maxDrawdownPercent', Number(e.target.value))} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
            Set to 0 to hide the max drawdown card on the dashboard.
          </span>
          <label style={{ ...labelStyle, marginTop: '14px' }}>Maximum Daily Drawdown Limit (%)</label>
          <input type="number" step="0.1" min="0" max="100" className="ts-input" value={settings.maxDailyDrawdownPercent ?? 3} onChange={(e) => handleChange('maxDailyDrawdownPercent', Number(e.target.value))} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
            Set to 0 to hide the daily drawdown card on the dashboard.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button type="submit" className="ts-btn ts-btn-primary">💾 Save Settings</button>
          {savedMsg && <span style={{ color: 'var(--color-win)', fontSize: '14px' }}>Saved for {accountName}!</span>}
        </div>
      </form>

      <div className="ts-card" style={{ maxWidth: '520px', border: '1px solid #7f1d1d' }}>
        <h3 style={{ ...sectionTitle, color: '#ff5252' }}>Danger Zone</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button type="button" onClick={resetCurrentAccountData} className="ts-btn ts-btn-ghost" style={{ justifyContent: 'flex-start' }}>🧹 Clear trades only (this account)</button>
          <button type="button" onClick={resetCurrentAccountEverything} className="ts-btn ts-btn-danger" style={{ justifyContent: 'flex-start' }}>♻️ Reset this account (trades + settings)</button>
          <button type="button" onClick={resetAllAppData} className="ts-btn ts-btn-danger" style={{ justifyContent: 'flex-start', backgroundColor: '#7f1d1d' }}>💣 Wipe ALL app data (all accounts)</button>
        </div>
      </div>
    </div>
  );
}

const sectionTitle = { marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#d1d4dc' };
const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' };