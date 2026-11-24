import { STORAGE_KEYS } from './storageKeys.js';
import {
  getReviewPeriod,
  reviewRecordKey,
} from './reviewPeriods.js';

export const BACKUP_APP = 'My_PnL_Lens';
export const BACKUP_VERSION = 1;

export const BACKUP_KEYS = [
  ['accounts', STORAGE_KEYS.accounts],
  ['activeAccount', STORAGE_KEYS.activeAccount],
  ['playbooks', STORAGE_KEYS.playbooks],
  ['activityLog', STORAGE_KEYS.activityLog],
  ['defaultPage', STORAGE_KEYS.defaultPage],
  ['lastTab', STORAGE_KEYS.lastTab],
  ['dashboardPeriod', STORAGE_KEYS.dashboardPeriod],
  ['dashboardCustomRange', STORAGE_KEYS.dashboardCustomRange],
  ['analyticsPeriod', STORAGE_KEYS.analyticsPeriod],
  ['globalFilter', STORAGE_KEYS.globalFilter],
  ['journalFilters', STORAGE_KEYS.journalFilters],
  ['journalColumns', STORAGE_KEYS.journalColumns],
  ['periodReviews', STORAGE_KEYS.periodReviews],
  ['displayName', STORAGE_KEYS.displayName],
  ['sidebarCollapsed', STORAGE_KEYS.sidebarCollapsed],
  ['myTickets', STORAGE_KEYS.myTickets],
  ['enteredApp', STORAGE_KEYS.enteredApp],
  ['theme', STORAGE_KEYS.theme],
  ['legacyTrades', STORAGE_KEYS.legacyTrades],
  ['legacySettings', STORAGE_KEYS.legacySettings],
];

const has = (object, key) => Object.hasOwn(object, key);

const object = (value) => !!value &&
  typeof value === 'object' &&
  !Array.isArray(value);

const fail = (message) => {
  throw new Error(message);
};

const identifier = (value) =>
  (typeof value === 'string' && !!value.trim()) ||
  (typeof value === 'number' && Number.isFinite(value));

const STRING_FIELDS = new Set([
  'activeAccount',
  'defaultPage',
  'lastTab',
  'dashboardPeriod',
  'analyticsPeriod',
  'displayName',
  'sidebarCollapsed',
  'enteredApp',
  'theme',
]);

function records(value, label) {
  if (
    !Array.isArray(value) ||
    value.some((item) => !object(item))
  ) {
    fail(
      `Backup is damaged: ${label} must be a list of records.`
    );
  }
}

function checkTrades(trades, label) {
  records(trades, label);

  for (const [index, trade] of trades.entries()) {
    const where = `${label}, trade ${index + 1}`;

    if (!identifier(trade.id)) {
      fail(`Backup is damaged: ${where} has no valid ID.`);
    }

    for (const key of ['symbol', 'notes', 'setup', 'screenshot']) {
      if (
        has(trade, key) &&
        trade[key] !== null &&
        typeof trade[key] !== 'string'
      ) {
        fail(
          `Backup is damaged: ${where}, ${key} must be text.`
        );
      }
    }

    for (const key of ['emotions', 'mistakes', 'rulesChecked']) {
      if (
        has(trade, key) &&
        (
          !Array.isArray(trade[key]) ||
          trade[key].some((value) => typeof value !== 'string')
        )
      ) {
        fail(
          `Backup is damaged: ${where}, ${key} must be a list of text values.`
        );
      }
    }

    if (
      has(trade, 'reviewed') &&
      typeof trade.reviewed !== 'boolean'
    ) {
      fail(
        `Backup is damaged: ${where}, reviewed must be true or false.`
      );
    }
  }
}

// Structural validation, not a recalculation or normalisation of trade data.
// Unknown fields inside valid records are preserved exactly as supplied.
export function validateBackup(backup) {
  if (
    !object(backup) ||
    backup.app !== BACKUP_APP ||
    backup.kind !== 'full-backup' ||
    !object(backup.data)
  ) {
    fail(
      'Not a My_PnL_Lens backup file (missing or invalid backup header).'
    );
  }

  if (backup.version !== BACKUP_VERSION) {
    fail(
      `Unsupported backup version. This app supports version ${BACKUP_VERSION}.`
    );
  }

  const data = backup.data;
  const known = new Set(BACKUP_KEYS.map(([name]) => name));

  for (const name of Object.keys(data)) {
    if (!known.has(name)) {
      fail(
        `Backup contains an unsupported storage field: ${name}. Nothing has been restored.`
      );
    }
  }

  if (!has(data, 'accounts')) {
    fail(
      'Backup has no accounts list. Incomplete or legacy-only backups require migration before restore.'
    );
  }

  if (has(data, 'accounts')) {
    records(data.accounts, 'accounts');

    if (!data.accounts.length) {
      fail('Backup contains an empty accounts list.');
    }

    const ids = new Set();

    for (const account of data.accounts) {
      if (
        typeof account.id !== 'string' ||
        !account.id.trim() ||
        ids.has(account.id)
      ) {
        fail(
          'Backup account IDs must be non-empty, unique text values.'
        );
      }

      ids.add(account.id);

      if (
        typeof account.name !== 'string' ||
        !account.name.trim()
      ) {
        fail(
          'Backup has an account with a missing or invalid name.'
        );
      }

      if (
        has(account, 'settings') &&
        !object(account.settings)
      ) {
        fail('Backup account settings must be an object.');
      }

      checkTrades(account.trades, `account ${account.name}`);
    }
  }

  if (has(data, 'legacyTrades')) {
    checkTrades(data.legacyTrades, 'legacy trades');
  }

  if (has(data, 'playbooks')) {
    records(data.playbooks, 'playbooks');

    for (const playbook of data.playbooks) {
      if (
        !identifier(playbook.id) ||
        typeof playbook.title !== 'string' ||
        !playbook.title.trim()
      ) {
        fail(
          'Backup has a playbook with an invalid ID or title.'
        );
      }

      if (
        has(playbook, 'rules') &&
        (
          !Array.isArray(playbook.rules) ||
          playbook.rules.some((value) => typeof value !== 'string')
        )
      ) {
        fail(
          'Backup playbook rules must be a list of text values.'
        );
      }
    }
  }

  for (const name of ['activityLog', 'myTickets']) {
    if (has(data, name)) records(data[name], name);
  }

  for (const name of [
    'legacySettings',
    'dashboardCustomRange',
    'globalFilter',
    'journalFilters',
    'journalColumns',
  ]) {
    if (has(data, name) && !object(data[name])) {
      fail(`Backup ${name} must be an object.`);
    }
  }

  for (const name of STRING_FIELDS) {
    // Older exporters parsed plain scalar strings as JSON (e.g. "true").
    // Accept those scalar values, but not null, arrays or objects.
    if (
      has(data, name) &&
      !['string', 'number', 'boolean'].includes(typeof data[name])
    ) {
      fail(
        `Backup ${name} must be a text or scalar preference value.`
      );
    }
  }

  if (has(data, 'periodReviews')) {
    records(data.periodReviews, 'period reviews');
    const seen = new Set();

    for (const review of data.periodReviews) {
      const period = getReviewPeriod(review.type, review.start);

      const key = reviewRecordKey(
        review.accountId,
        review.type,
        review.start
      );

      if (
        !period ||
        period.start !== review.start ||
        !key ||
        !object(review.answers) ||
        seen.has(key)
      ) {
        fail(
          'Backup contains a damaged or duplicate period review.'
        );
      }

      if (
        Object.values(review.answers).some(
          (value) => typeof value !== 'string'
        )
      ) {
        fail('Backup review answers must be text.');
      }

      seen.add(key);
    }
  }

  return backup;
}

export function parseBackup(text) {
  let backup;

  try {
    backup = JSON.parse(String(text ?? ''));
  } catch {
    fail('That file is not valid JSON.');
  }

  return validateBackup(backup);
}

export function buildBackup(storage = localStorage) {
  const data = {};

  for (const [name, key] of BACKUP_KEYS) {
    let raw;

    try {
      raw = storage.getItem(key);
    } catch {
      fail(
        `Backup export stopped: could not read ${name}. No complete backup was created.`
      );
    }

    if (raw === null) continue;

    if (STRING_FIELDS.has(name)) {
      data[name] = raw;
    } else {
      try {
        data[name] = JSON.parse(raw);
      } catch {
        fail(
          `Backup export stopped: saved ${name} is not valid JSON. Stored data has not been changed.`
        );
      }
    }
  }

  return validateBackup({
    app: BACKUP_APP,
    kind: 'full-backup',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  });
}

export function backupSummary(backup) {
  validateBackup(backup);

  const data = backup.data;
  const accounts = data.accounts || [];

  return {
    accounts: accounts.length,
    trades: has(data, 'accounts')
      ? accounts.reduce(
          (total, account) => total + account.trades.length,
          0
        )
      : data.legacyTrades.length,
    playbooks: data.playbooks?.length || 0,
    reviews: data.periodReviews?.length || 0,
    exportedAt: backup.exportedAt || null,
    included: BACKUP_KEYS
      .filter(([name]) => has(data, name))
      .map(([name]) => name),
    preserved: BACKUP_KEYS
      .filter(([name]) => !has(data, name))
      .map(([name]) => name),
  };
}

export function applyBackup(backup, storage = localStorage) {
  // Clone to serialisable JSON, validate again and prepare all writes BEFORE
  // touching storage. Callers cannot bypass checks by skipping parseBackup.
  let prepared;

  try {
    prepared = JSON.stringify(backup);
  } catch {
    fail('Backup cannot be serialised. Nothing has been changed.');
  }

  const checked = parseBackup(prepared);

  const writes = BACKUP_KEYS
    .filter(([name]) => has(checked.data, name))
    .map(([name, key]) => ({
      name,
      key,
      raw: typeof checked.data[name] === 'string'
        ? checked.data[name]
        : JSON.stringify(checked.data[name]),
    }));

  const snapshot = new Map();

  try {
    for (const { key } of writes) {
      snapshot.set(key, storage.getItem(key));
    }
  } catch {
    fail(
      'Restore stopped: current storage could not be read for rollback. Nothing has been changed.'
    );
  }

  const attempted = [];

  try {
    for (const write of writes) {
      attempted.push(write);
      storage.setItem(write.key, write.raw);

      if (storage.getItem(write.key) !== write.raw) {
        throw new Error(`Could not verify ${write.name}.`);
      }
    }
  } catch {
    for (const { key } of attempted.reverse()) {
      try {
        const old = snapshot.get(key);

        if (old === null) storage.removeItem(key);
        else storage.setItem(key, old);
      } catch {
        // Verify the resulting state below, even after rollback errors.
      }
    }

    const failed = [];

    for (const { name, key } of writes) {
      try {
        if (storage.getItem(key) !== snapshot.get(key)) {
          failed.push(name);
        }
      } catch {
        failed.push(name);
      }
    }

    const error = new Error(
      failed.length
        ? `Restore failed and rollback could not be fully verified for: ${failed.join(', ')}. Storage may be partially changed. Do not reload or retry; keep your safety backup.`
        : 'Restore failed. Previous storage values were restored and verified. No success reload should be performed.'
    );

    error.rollbackFailed = failed.length > 0;
    throw error;
  }

  return {
    restored: writes.map(({ name }) => name),
    preserved: backupSummary(checked).preserved,
  };
}

export function downloadBackup(backup, filename) {
  validateBackup(backup);

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function backupFileName(prefix = 'mypnl-lens-backup') {
  const now = new Date();
  const pad = (number) => String(number).padStart(2, '0');

  return `${prefix}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}