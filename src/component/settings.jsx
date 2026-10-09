import { useState, useEffect } from 'react';
import { SettingsIcon, Save, Eraser, Recycle, Bomb, Moon, Sun, TrendingUp, Monitor, Download, Upload, TriangleAlert, CircleCheck, CircleX } from 'lucide-react';
import { THEME_MODES } from '../utils/themeConfig.js';
import { buildBackup, backupSummary, downloadBackup, backupFileName, parseBackup, applyBackup } from '../utils/backup.js';

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
  themeMode = 'system',
  setThemeMode,
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

  // ---- Backup & Restore (full-device JSON) ----
  const [backupOk, setBackupOk] = useState('');
  const [backupErr, setBackupErr] = useState('');
  const [pending, setPending] = useState(null); // { backup, summary, fileName }

  const clearBackupMsgs = () => { setBackupOk(''); setBackupErr(''); };

  const handleExportBackup = () => {
    clearBackupMsgs();
    setPending(null);
    try {
      const b = buildBackup();
      const s = backupSummary(b);
      downloadBackup(b, backupFileName());
      setBackupOk(`Backup downloaded (${s.accounts} account${s.accounts === 1 ? '' : 's'}, ${s.trades} trades, ${s.playbooks} playbooks)`);
    } catch (err) {
      console.error(err);
      setBackupErr('Export failed: ' + (err?.message || 'unknown error'));
    }
  };

  const handleBackupFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    clearBackupMsgs();
    setPending(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const b = parseBackup(ev.target.result);
        setPending({ backup: b, summary: backupSummary(b), fileName: file.name });
      } catch (err) {
        setBackupErr(err?.message || 'Could not read backup file.');
      }
    };
    reader.onerror = () => setBackupErr('Could not read that file.');
    reader.readAsText(file);
  };

  const cancelRestore = () => { setPending(null); clearBackupMsgs(); };

  const confirmRestore = () => {
    if (!pending) return;
    const s = pending.summary;
    const when = s.exportedAt ? new Date(s.exportedAt).toLocaleString() : 'unknown date';
    if (!confirm(`Restore backup "${pending.fileName}"?\n\nThis REPLACES all data on this device with:\n- ${s.accounts} accounts, ${s.trades} trades, ${s.playbooks} playbooks\n- Exported: ${when}\n\nYour current data is auto-downloaded first as a safety copy.`)) return;
    try {
      downloadBackup(buildBackup(), backupFileName('mypnl-lens-pre-restore'));
      applyBackup(pending.backup);
      alert('Backup restored. The app will now reload.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      setBackupErr('Restore failed: ' + (err?.message || 'unknown error'));
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}><SettingsIcon size={24} /> Settings</h1>

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
            <strong style={{ color: 'var(--text-bright)', fontFamily: 'var(--font-brand)', fontWeight: 700, letterSpacing: '0.02em' }}>
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

          <label style={{ ...labelStyle, marginTop: '16px' }}>Appearance</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {THEME_MODES.map((m) => {
              const active = themeMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setThemeMode?.(m.id)}
                  className="ts-btn"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    backgroundColor: active ? 'var(--accent-blue)' : 'var(--bg-main)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    border: '1px solid ' + (active ? 'var(--accent-blue)' : 'var(--border-color)'),
                    padding: '8px 6px',
                    fontSize: '12px',
                  }}
                >
                  {m.id === 'system' ? <Monitor size={13} /> : m.id === 'dark' ? <Moon size={13} /> : m.id === 'light' ? <Sun size={13} /> : <TrendingUp size={13} />}
                  {m.label}
                </button>
              );
            })}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
            Saved on this device only. System follows your device's light/dark setting. P&L Based glows green in profit and red in loss, from the active account's total P&L.
          </span>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', margin: '32px 0', maxWidth: '520px' }} />

      <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: '24px' }}>
        Settings for <strong style={{ color: 'var(--text-bright)' }}>{accountName}</strong> only. Other accounts keep their own settings.
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
          <label style={{ ...labelStyle, marginTop: '14px' }}>Maximum Daily Drawdown Limit (%)</label>
          <input type="number" step="0.1" min="0" max="100" className="ts-input" value={settings.maxDailyDrawdownPercent ?? 3} onChange={(e) => handleChange('maxDailyDrawdownPercent', Number(e.target.value))} />
          <label style={{ ...labelStyle, marginTop: '14px' }}>Maximum Drawdown Limit (%)</label>
          <input type="number" step="0.1" min="0" max="100" className="ts-input" value={settings.maxDrawdownPercent ?? 10} onChange={(e) => handleChange('maxDrawdownPercent', Number(e.target.value))} />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
            Set either limit to 0% to hide its card on the Dashboard.
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <button type="submit" className="ts-btn ts-btn-primary"><Save size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Save Settings</button>
          {savedMsg && <span style={{ color: 'var(--color-win)', fontSize: '14px' }}>Saved for {accountName}!</span>}
        </div>
      </form>

      <div className="ts-card" style={{ maxWidth: '520px', marginBottom: '16px' }}>
        <h3 style={sectionTitle}>Backup & Restore</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0 }}>
          One JSON file holds <strong style={{ color: 'var(--text-bright)' }}>everything</strong>: all accounts, trades, playbooks, tickets and preferences. Export before big changes or a new device.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleExportBackup} className="ts-btn ts-btn-primary">
            <Download size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Export Backup
          </button>
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleBackupFile}
            id="backup-file-input"
            style={{ display: 'none' }}
          />
          <label htmlFor="backup-file-input" className="ts-btn" style={{ cursor: 'pointer', display: 'inline-block' }}>
            <Upload size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Import Backup
          </label>
        </div>
        {backupOk && (
          <p style={{ color: 'var(--color-win)', fontSize: '13px', marginBottom: 0 }}>
            <CircleCheck size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{backupOk}
          </p>
        )}
        {backupErr && (
          <p style={{ color: 'var(--color-loss)', fontSize: '13px', marginBottom: 0 }}>
            <CircleX size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{backupErr}
          </p>
        )}
        {pending && (
          <div style={{ marginTop: '14px', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 14px', backgroundColor: 'var(--bg-main)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '4px' }}>
              {pending.fileName}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {pending.summary.accounts} accounts · {pending.summary.trades} trades · {pending.summary.playbooks} playbooks
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
              Exported: {pending.summary.exportedAt ? new Date(pending.summary.exportedAt).toLocaleString() : 'unknown date'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-amber-text)', marginBottom: '12px' }}>
              <TriangleAlert size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
              Restoring replaces ALL data on this device. Your current data is auto-downloaded first as a safety copy.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={cancelRestore} className="ts-btn ts-btn-ghost">Cancel</button>
              <button type="button" onClick={confirmRestore} className="ts-btn ts-btn-danger">Restore This Backup</button>
            </div>
          </div>
        )}
      </div>

      <div className="ts-card" style={{ maxWidth: '520px', border: '1px solid #7f1d1d' }}>
        <h3 style={{ ...sectionTitle, color: 'var(--color-loss)' }}>Danger Zone</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button type="button" onClick={resetCurrentAccountData} className="ts-btn ts-btn-ghost" style={{ justifyContent: 'flex-start' }}><Eraser size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Clear trades only (this account)</button>
          <button type="button" onClick={resetCurrentAccountEverything} className="ts-btn ts-btn-danger" style={{ justifyContent: 'flex-start' }}><Recycle size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Reset this account (trades + settings)</button>
          <button type="button" onClick={resetAllAppData} className="ts-btn ts-btn-danger" style={{ justifyContent: 'flex-start', backgroundColor: '#7f1d1d' }}><Bomb size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Wipe ALL app data (all accounts)</button>
        </div>
      </div>
    </div>
  );
}

const sectionTitle = { marginTop: 0, marginBottom: '16px', fontSize: '16px', color: 'var(--text-bright)' };
const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' };