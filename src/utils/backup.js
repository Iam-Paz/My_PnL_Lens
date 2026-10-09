// Full-device JSON backup: export every mypnllens_* key to one file, restore it back.
// The Settings page owns the UI; this module owns the format + localStorage I/O.
import { STORAGE_KEYS } from './storageKeys.js';

export const BACKUP_APP = 'My_PnL_Lens';
export const BACKUP_VERSION = 1;

// [backup field, localStorage key] — legacy single-account keys ride along when present.
const BACKUP_KEYS = [
  ['accounts', STORAGE_KEYS.accounts],
  ['activeAccount', STORAGE_KEYS.activeAccount],
  ['playbooks', STORAGE_KEYS.playbooks],
  ['activityLog', STORAGE_KEYS.activityLog],
  ['defaultPage', STORAGE_KEYS.defaultPage],
  ['displayName', STORAGE_KEYS.displayName],
  ['sidebarCollapsed', STORAGE_KEYS.sidebarCollapsed],
  ['myTickets', STORAGE_KEYS.myTickets],
  ['enteredApp', STORAGE_KEYS.enteredApp],
  ['theme', STORAGE_KEYS.theme],
  ['legacyTrades', STORAGE_KEYS.legacyTrades],
  ['legacySettings', STORAGE_KEYS.legacySettings],
];

function readKey(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      return raw; // plain-string keys (theme, display name, …) aren't JSON
    }
  } catch {
    return undefined;
  }
}

function writeKey(key, value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  localStorage.setItem(key, raw);
}

export function buildBackup() {
  const data = {};
  for (const [name, key] of BACKUP_KEYS) {
    const v = readKey(key);
    if (v !== undefined) data[name] = v;
  }
  return {
    app: BACKUP_APP,
    kind: 'full-backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function backupSummary(backup) {
  const d = (backup && backup.data) || {};
  const accounts = Array.isArray(d.accounts) ? d.accounts : [];
  const trades = accounts.reduce((n, a) => n + (Array.isArray(a.trades) ? a.trades.length : 0), 0);
  const playbooks = Array.isArray(d.playbooks) ? d.playbooks.length : 0;
  return {
    accounts: accounts.length,
    trades,
    playbooks,
    exportedAt: backup?.exportedAt || null,
  };
}

export function downloadBackup(backup, filename) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupFileName(prefix = 'mypnl-lens-backup') {
  const t = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${prefix}-${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}.json`;
}

// Throws an Error with a human-readable message when the file isn't a usable backup.
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(String(text || ''));
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!obj || typeof obj !== 'object' || obj.app !== BACKUP_APP || obj.kind !== 'full-backup' || !obj.data || typeof obj.data !== 'object') {
    throw new Error('Not a My_PnL_Lens backup file (missing backup header).');
  }
  if (obj.data.accounts !== undefined && !Array.isArray(obj.data.accounts)) {
    throw new Error('Backup is corrupt: the accounts list is damaged.');
  }
  return obj;
}

export function applyBackup(backup) {
  const d = (backup && backup.data) || {};
  for (const [name, key] of BACKUP_KEYS) {
    if (d[name] === undefined) continue;
    try {
      writeKey(key, d[name]);
    } catch (err) {
      console.warn('Backup restore skipped key', key, err);
    }
  }
}