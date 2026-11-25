import {
  useState,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';

import {
  SettingsIcon, Eraser, Recycle, Bomb, Moon, Sun,
  TrendingUp, Monitor, Download, Upload, TriangleAlert,
  CircleCheck, CircleX,
} from 'lucide-react';

import { THEME_MODES } from '../utils/themeConfig.js';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

import {
  getSaveFailures,
  subscribeSaveFailures,
} from '../utils/persistence.js';

import {
  buildBackup,
  backupSummary,
  downloadBackup,
  backupFileName,
  parseBackup,
  applyBackup,
} from '../utils/backup.js';

export default function Settings({
  settings,
  setSettings,
  accountName = 'Account',
  resetCurrentAccountData,
  resetCurrentAccountEverything,
  resetAllAppData,
  displayName = 'my',
  setDisplayName,
  appName = 'My_PnL_Lens',
  themeMode = 'system',
  setThemeMode,
}) {
  const failures = useSyncExternalStore(
    subscribeSaveFailures,
    getSaveFailures,
    getSaveFailures
  );

  const persistenceBlocked = failures.length > 0;

  const accountSaveFailed = failures.some(
    (failure) => failure.key === STORAGE_KEYS.accounts
  );

  const [nameEdit, setNameEdit] = useState({
    base: displayName,
    value: displayName,
  });

  const nameDraft = nameEdit.base === displayName
    ? nameEdit.value
    : displayName;

  const setNameDraft = (value) => setNameEdit({
    base: displayName,
    value,
  });

  const commitDisplayName = () => {
    if (setDisplayName) setDisplayName(nameDraft);
  };

  const handleChange = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  // Backups cover persisted data, not unsaved form drafts.
  const [backupOk, setBackupOk] = useState('');
  const [backupErr, setBackupErr] = useState('');
  const [pending, setPending] = useState(null);
  const [reading, setReading] = useState(false);
  const [safetyData, setSafetyData] = useState('');
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [restoreBlocked, setRestoreBlocked] = useState(false);

  const fileVersion = useRef(0);
  const restoring = useRef(false);

  useEffect(() => () => {
    fileVersion.current++;
  }, []);

  const clearBackupMsgs = () => {
    setBackupOk('');
    setBackupErr('');
  };

  const resetSafety = () => {
    setSafetyData('');
    setSafetyChecked(false);
  };

  const requireSavedData = () => {
    if (!getSaveFailures().length) return true;

    setBackupOk('');
    setBackupErr(
      'Backup action blocked: some latest changes are not confirmed saved. Use the warning above to retry saving or download the partial unsaved recovery JSON. A recovery download does not enable restore; tracked saves must succeed first.'
    );

    return false;
  };

  const handleExportBackup = () => {
    if (restoreBlocked || !requireSavedData()) return;

    clearBackupMsgs();

    try {
      const backup = buildBackup();
      const summary = backupSummary(backup);

      downloadBackup(backup, backupFileName());

      setBackupOk(
        `Download requested: ${summary.accounts} accounts, ${summary.trades} trades, ${summary.playbooks} playbooks, ${summary.reviews} period reviews. Check Downloads; the app cannot verify that the file saved.`
      );
    } catch (error) {
      setBackupErr(error.message || 'Backup export failed.');
    }
  };

  const handleBackupFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || restoreBlocked || !requireSavedData()) return;

    const version = ++fileVersion.current;

    clearBackupMsgs();
    resetSafety();
    setPending(null);
    setReading(true);

    try {
      const text = await file.text();

      if (version !== fileVersion.current) return;

      const backup = parseBackup(text);

      setPending({
        backup,
        summary: backupSummary(backup),
        fileName: file.name,
      });
    } catch (error) {
      if (version === fileVersion.current) {
        setBackupErr(
          error.message || 'Could not read backup.'
        );
      }
    } finally {
      if (version === fileVersion.current) {
        setReading(false);
      }
    }
  };

  const cancelRestore = () => {
    fileVersion.current++;
    setReading(false);
    setPending(null);
    resetSafety();
    clearBackupMsgs();
  };

  const downloadSafetyCopy = () => {
    if (!pending || restoreBlocked || !requireSavedData()) return;

    clearBackupMsgs();
    resetSafety();

    try {
      const backup = buildBackup();

      downloadBackup(
        backup,
        backupFileName('mypnl-lens-pre-restore')
      );

      setSafetyData(JSON.stringify(backup.data));

      setBackupOk(
        'Safety-copy download requested. Locate the JSON file and check that it saved before ticking the confirmation below.'
      );
    } catch (error) {
      setBackupErr(
        `Cannot prepare safety copy. Restore remains disabled. ${error.message || ''}`
      );
    }
  };

  const confirmRestore = () => {
    if (
      !pending ||
      !safetyData ||
      !safetyChecked ||
      restoreBlocked ||
      restoring.current
    ) {
      return;
    }

    clearBackupMsgs();

    if (!requireSavedData()) return;

    try {
      if (JSON.stringify(buildBackup().data) !== safetyData) {
        resetSafety();

        setBackupErr(
          'Saved data changed after the safety copy. Download and check a fresh safety copy before restoring.'
        );
        return;
      }

      const summary = backupSummary(pending.backup);

      const preserved = summary.preserved.length
        ? summary.preserved.join(', ')
        : 'None';

      const approved = confirm(
        `Restore "${pending.fileName}"?\n\nIncluded fields REPLACE saved values; trades are not merged.\n${summary.accounts} accounts, ${summary.trades} trades, ${summary.playbooks} playbooks, ${summary.reviews} included period reviews.\n\nOmitted fields left untouched: ${preserved}\n\nUse only this app tab during restore. Continue?`
      );

      if (!approved || !requireSavedData()) return;

      restoring.current = true;

      applyBackup(pending.backup);

      alert(
        'Included backup fields were written and verified. The app will reload. Omitted fields were left untouched.'
      );

      window.location.reload();
    } catch (error) {
      setBackupErr(
        error.message ||
        'Restore failed. No success reload was performed.'
      );

      resetSafety();

      if (error.rollbackFailed) {
        setRestoreBlocked(true);
      }
    } finally {
      restoring.current = false;
    }
  };

  return (
    <div>
      <h1
        style={{
          fontSize: '24px',
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <SettingsIcon size={24} /> Settings
      </h1>

      <div style={{ marginBottom: '32px' }}>
        <p
          style={{
            color: 'var(--text-secondary)',
            marginTop: 0,
            marginBottom: '16px',
          }}
        >
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
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitDisplayName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitDisplayName();
                event.target.blur();
              }
            }}
          />

          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'block',
              marginTop: '6px',
            }}
          >
            App name preview:{' '}
            <strong
              style={{
                color: 'var(--text-bright)',
                fontFamily: 'var(--font-brand)',
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              {appName}
            </strong>
            {' '}(letters &amp; numbers only; empty becomes My_PnL_Lens)
          </span>

          <label style={{ ...labelStyle, marginTop: '16px' }}>
            Appearance
          </label>

          <div style={{ display: 'flex', gap: '6px' }}>
            {THEME_MODES.map((mode) => {
              const active = themeMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setThemeMode?.(mode.id)}
                  className="ts-btn"
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    backgroundColor: active
                      ? 'var(--accent-blue)'
                      : 'var(--bg-main)',
                    color: active
                      ? '#fff'
                      : 'var(--text-secondary)',
                    border: '1px solid ' + (
                      active
                        ? 'var(--accent-blue)'
                        : 'var(--border-color)'
                    ),
                    padding: '8px 6px',
                    fontSize: '12px',
                  }}
                >
                  {mode.id === 'system'
                    ? <Monitor size={13} />
                    : mode.id === 'dark'
                      ? <Moon size={13} />
                      : mode.id === 'light'
                        ? <Sun size={13} />
                        : <TrendingUp size={13} />}
                  {mode.label}
                </button>
              );
            })}
          </div>

          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'block',
              marginTop: '6px',
            }}
          >
            Saved on this device only. System follows your
            device&apos;s light/dark setting. P&amp;L Based glows
            green in profit and red in loss, from the active
            account&apos;s total P&amp;L.
          </span>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          margin: '32px 0',
          maxWidth: '520px',
        }}
      />

      <p
        style={{
          color: 'var(--text-secondary)',
          marginTop: 0,
          marginBottom: '24px',
        }}
      >
        Settings for{' '}
        <strong style={{ color: 'var(--text-bright)' }}>
          {accountName}
        </strong>{' '}
        only. Other accounts keep their own settings.
      </p>

      <form
        onSubmit={(event) => event.preventDefault()}
        style={{ maxWidth: '520px' }}
      >
        <div className="ts-card" style={{ marginBottom: '16px' }}>
          <h3 style={sectionTitle}>Profile</h3>

          <label style={labelStyle}>Trader Name (Account)</label>
          <input
            type="text"
            className="ts-input"
            value={settings.traderName || ''}
            onChange={(event) => handleChange(
              'traderName',
              event.target.value
            )}
          />

          <label style={{ ...labelStyle, marginTop: '14px' }}>
            Account Currency
          </label>
          <select
            className="ts-input"
            value={settings.currency || 'USD'}
            onChange={(event) => handleChange(
              'currency',
              event.target.value
            )}
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="NGN">NGN (₦)</option>
          </select>
        </div>

        <div className="ts-card" style={{ marginBottom: '16px' }}>
          <h3 style={sectionTitle}>Broker &amp; Timezone</h3>

          <label style={labelStyle}>
            Broker Server Timezone (UTC Offset)
          </label>
          <select
            className="ts-input"
            value={settings.brokerUtcOffset ?? 2}
            onChange={(event) => handleChange(
              'brokerUtcOffset',
              Number(event.target.value)
            )}
          >
            <option value={-5}>UTC-5 (EST - US East)</option>
            <option value={0}>UTC+0 (GMT / London)</option>
            <option value={1}>UTC+1 (WAT / CET - Nigeria / Europe)</option>
            <option value={2}>UTC+2 (EET - Standard MT5 Default)</option>
            <option value={3}>UTC+3 (EEST - Summer MT5 Offset)</option>
          </select>

          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'block',
              marginTop: '6px',
            }}
          >
            Used to convert broker times to your local time
            (Nigeria WAT) and for session analysis.
          </span>
        </div>

        <div className="ts-card" style={{ marginBottom: '16px' }}>
          <h3 style={sectionTitle}>Risk Defaults</h3>

          <label style={labelStyle}>Starting Balance</label>
          <input
            type="number"
            step="any"
            className="ts-input"
            value={settings.startingBalance ?? 10000}
            onChange={(event) => handleChange(
              'startingBalance',
              Number(event.target.value)
            )}
          />

          <label style={{ ...labelStyle, marginTop: '14px' }}>
            Default Risk Per Trade (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="100"
            className="ts-input"
            value={settings.riskPerTrade ?? 1}
            onChange={(event) => handleChange(
              'riskPerTrade',
              Number(event.target.value)
            )}
          />

          <label style={{ ...labelStyle, marginTop: '14px' }}>
            Maximum Daily Drawdown Limit (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            className="ts-input"
            value={settings.maxDailyDrawdownPercent ?? 3}
            onChange={(event) => handleChange(
              'maxDailyDrawdownPercent',
              Number(event.target.value)
            )}
          />

          <label style={{ ...labelStyle, marginTop: '14px' }}>
            Maximum Drawdown Limit (%)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            className="ts-input"
            value={settings.maxDrawdownPercent ?? 10}
            onChange={(event) => handleChange(
              'maxDrawdownPercent',
              Number(event.target.value)
            )}
          />

          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'block',
              marginTop: '6px',
            }}
          >
            Set either limit to 0% to hide its card on the Dashboard.
          </span>
        </div>

        <div className="ts-card" style={{ marginBottom: '16px' }}>
          <h3 style={sectionTitle}>Prop Firm Rules</h3>

          <label style={labelStyle}>Inactivity Limit (days)</label>
          <input
            type="number"
            step="1"
            min="0"
            max="365"
            className="ts-input"
            value={settings.inactivityLimitDays ?? 30}
            onChange={(event) => handleChange(
              'inactivityLimitDays',
              Number(event.target.value)
            )}
          />

          <span
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              display: 'block',
              marginTop: '6px',
            }}
          >
            Most firms breach idle accounts after 30 days without
            a trade. The Dashboard guards this limit—set to 0
            to hide the guard.
          </span>
        </div>

        <p
          role="status"
          style={{
            fontSize: '13px',
            color: accountSaveFailed
              ? 'var(--color-loss)'
              : 'var(--text-secondary)',
            marginBottom: '28px',
          }}
        >
          Account settings apply automatically.{' '}
          {accountSaveFailed
            ? 'The latest account changes are NOT confirmed saved. Use the warning above to retry or download recovery JSON.'
            : 'No account-save failure is currently reported.'}
          {' '}Display name and appearance are not yet covered
          by this save tracker.
        </p>
      </form>

      <div
        className="ts-card"
        style={{ maxWidth: '640px', marginBottom: '16px' }}
      >
        <h3 style={sectionTitle}>Backup &amp; Restore</h3>

        <p style={helpStyle}>
          Full JSON backups cover saved accounts and trades,
          annotations, excursions, playbooks, period reviews,
          tickets and preferences—not unsaved form drafts.
          Journal CSV is not a full backup.
        </p>

        <p style={helpStyle}>
          Restore affects this browser origin/profile across all
          accounts, not just {accountName}. Close other tabs of
          this app before restoring.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={restoreBlocked || persistenceBlocked}
            className="ts-btn ts-btn-primary"
          >
            <Download size={14} /> Export Backup
          </button>

          <label style={labelStyle}>
            <Upload size={14} /> Select JSON backup
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleBackupFile}
              disabled={restoreBlocked || persistenceBlocked}
              style={{
                display: 'block',
                marginTop: '6px',
                maxWidth: '100%',
              }}
            />
          </label>
        </div>

        {persistenceBlocked && (
          <p
            role="alert"
            style={{
              color: 'var(--color-loss)',
              fontSize: '13px',
            }}
          >
            Full-backup export and restore are paused because some
            latest data is unsaved or unverified. Keep this tab open.
            Use the save warning above for retry and partial recovery
            download.
          </p>
        )}

        {reading && (
          <p role="status">Reading and validating backup…</p>
        )}

        {backupOk && !persistenceBlocked && (
          <p
            role="status"
            style={{
              color: 'var(--color-win)',
              fontSize: '13px',
            }}
          >
            <CircleCheck size={14} /> {backupOk}
          </p>
        )}

        {backupErr && (
          <p
            role="alert"
            style={{
              color: 'var(--color-loss)',
              fontSize: '13px',
              whiteSpace: 'pre-wrap',
            }}
          >
            <CircleX size={14} /> {backupErr}
          </p>
        )}

        {restoreBlocked && (
          <p role="alert" style={{ color: 'var(--color-loss)' }}>
            Restore controls are locked because rollback could
            not be verified. Do not reload, retry, or edit data.
            Keep the safety copy and report the error before
            continuing.
          </p>
        )}

        {pending && !restoreBlocked && (
          <div
            style={{
              marginTop: '14px',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '14px',
              backgroundColor: 'var(--bg-main)',
            }}
          >
            <h4
              style={{
                marginTop: 0,
                overflowWrap: 'anywhere',
              }}
            >
              {pending.fileName}
            </h4>

            <p style={helpStyle}>
              {pending.summary.accounts} accounts ·{' '}
              {pending.summary.trades} trades ·{' '}
              {pending.summary.playbooks} playbooks ·{' '}
              {pending.summary.reviews} included period reviews
            </p>

            <p style={helpStyle}>
              Exported:{' '}
              {pending.summary.exportedAt &&
              Number.isFinite(Date.parse(pending.summary.exportedAt))
                ? new Date(
                    pending.summary.exportedAt
                  ).toLocaleString()
                : 'Unknown date'}
            </p>

            <p style={helpStyle}>
              <strong>Saved fields replaced:</strong>{' '}
              {pending.summary.included.join(', ')}
            </p>

            <p style={helpStyle}>
              <strong>Omitted fields left untouched:</strong>{' '}
              {pending.summary.preserved.length
                ? pending.summary.preserved.join(', ')
                : 'None'}
            </p>

            <p style={helpStyle}>
              An included empty list clears that list.
              An omitted list stays unchanged. Accounts and trades
              are replaced as a whole, not matched or merged.
              Omitted reviews may refer to accounts not present
              in this backup.
            </p>

            <p
              style={{
                ...helpStyle,
                color: 'var(--color-amber-text)',
              }}
            >
              <TriangleAlert size={14} /> Restore is not an atomic
              browser transaction. Failed writes trigger a rollback
              attempt and verification, not a success reload.
            </p>

            <button
              type="button"
              onClick={downloadSafetyCopy}
              disabled={persistenceBlocked}
              className="ts-btn ts-btn-primary"
            >
              1. Download pre-restore safety copy
            </button>

            <label
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                margin: '14px 0',
                fontSize: '13px',
              }}
            >
              <input
                type="checkbox"
                checked={safetyChecked}
                disabled={!safetyData || persistenceBlocked}
                onChange={(event) => setSafetyChecked(
                  event.target.checked
                )}
              />
              I located the safety JSON file and checked that
              it saved. I understand that included data will
              be replaced.
            </label>

            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={cancelRestore}
                className="ts-btn ts-btn-ghost"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmRestore}
                disabled={
                  !safetyData ||
                  !safetyChecked ||
                  persistenceBlocked
                }
                className="ts-btn ts-btn-danger"
              >
                2. Restore This Backup
              </button>
            </div>
          </div>
        )}
      </div>

      <div
        className="ts-card"
        style={{
          maxWidth: '520px',
          border: '1px solid #7f1d1d',
        }}
      >
        <h3 style={{ ...sectionTitle, color: 'var(--color-loss)' }}>
          Danger Zone
        </h3>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <button
            type="button"
            disabled={restoreBlocked || persistenceBlocked}
            onClick={resetCurrentAccountData}
            className="ts-btn ts-btn-ghost"
            style={{ justifyContent: 'flex-start' }}
          >
            <Eraser size={14} /> Clear trades only (this account)
          </button>

          <button
            type="button"
            disabled={restoreBlocked || persistenceBlocked}
            onClick={resetCurrentAccountEverything}
            className="ts-btn ts-btn-danger"
            style={{ justifyContent: 'flex-start' }}
          >
            <Recycle size={14} /> Reset this account
            (trades + settings)
          </button>

          <button
            type="button"
            disabled={restoreBlocked || persistenceBlocked}
            onClick={resetAllAppData}
            className="ts-btn ts-btn-danger"
            style={{
              justifyContent: 'flex-start',
              backgroundColor: '#7f1d1d',
            }}
          >
            <Bomb size={14} /> Wipe ALL app data (all accounts)
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionTitle = {
  marginTop: 0,
  marginBottom: '16px',
  fontSize: '16px',
  color: 'var(--text-bright)',
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--text-secondary)',
  marginBottom: '6px',
};

const helpStyle = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
  overflowWrap: 'anywhere',
};