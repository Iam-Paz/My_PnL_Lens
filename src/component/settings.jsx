export default function Settings({
  settings,
  setSettings,
  accountName = 'Account',
  resetCurrentAccountData,
  resetCurrentAccountEverything,
  resetAllAppData,
}) {
  const [savedMsg, setSavedMsg] = useState(false);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    // already live-saved through setSettings, just show confirmation
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>⚙️ Settings</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: '24px' }}>
        Settings for <strong style={{ color: '#fff' }}>{accountName}</strong> only. Other accounts keep their own settings.
      </p>

      <form onSubmit={handleSave} style={{ maxWidth: '520px' }}>
        <div className="ts-card" style={{ marginBottom: '16px' }}>
          <h3 style={sectionTitle}>Profile</h3>

          <label style={labelStyle}>Display Name</label>
          <input
            type="text"
            className="ts-input"
            value={settings.traderName || ''}
            onChange={(e) => handleChange('traderName', e.target.value)}
          />

          <label style={{ ...labelStyle, marginTop: '14px' }}>Account Currency</label>
          <select
            className="ts-input"
            value={settings.currency || 'USD'}
            onChange={(e) => handleChange('currency', e.target.value)}
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="NGN">NGN (₦)</option>
          </select>
        </div>

        <div className="ts-card" style={{ marginBottom: '16px' }}>
          <h3 style={sectionTitle}>Risk Defaults</h3>

          <label style={labelStyle}>Starting Balance</label>
          <input
            type="number"
            step="any"
            className="ts-input"
            value={settings.startingBalance ?? 10000}
            onChange={(e) => handleChange('startingBalance', Number(e.target.value))}
          />

          <label style={{ ...labelStyle, marginTop: '14px' }}>Default Risk Per Trade (%)</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="100"
            className="ts-input"
            value={settings.riskPerTrade ?? 1}
            onChange={(e) => handleChange('riskPerTrade', Number(e.target.value))}
          />

          <label style={{ ...labelStyle, marginTop: '14px' }}>Maximum Drawdown Limit (%)</label>
          <input
            type="number"
            step="0.1"
            min="1"
            max="100"
            className="ts-input"
            value={settings.maxDrawdownPercent ?? 10}
            onChange={(e) => handleChange('maxDrawdownPercent', Number(e.target.value))}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button type="submit" className="ts-btn ts-btn-primary">💾 Save Settings</button>
          {savedMsg && <span style={{ color: 'var(--color-win)', fontSize: '14px' }}>Saved for {accountName}!</span>}
        </div>
      </form>

      <div className="ts-card" style={{ maxWidth: '520px', border: '1px solid #7f1d1d' }}>
        <h3 style={{ ...sectionTitle, color: '#ff5252' }}>Danger Zone</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: 0, marginBottom: '14px' }}>
          These actions affect data permanently.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button type="button" onClick={resetCurrentAccountData} className="ts-btn ts-btn-ghost" style={{ justifyContent: 'flex-start' }}>
            🧹 Clear trades only (this account)
          </button>

          <button type="button" onClick={resetCurrentAccountEverything} className="ts-btn ts-btn-danger" style={{ justifyContent: 'flex-start' }}>
            ♻️ Reset this account (trades + settings)
          </button>

          <button type="button" onClick={resetAllAppData} className="ts-btn ts-btn-danger" style={{ justifyContent: 'flex-start', backgroundColor: '#7f1d1d' }}>
            💣 Wipe ALL app data (all accounts)
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionTitle = { marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#d1d4dc' };
const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' };

import { useState } from 'react';