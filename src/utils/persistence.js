// Session-only save failures. Do not put status in localStorage: the storage
// service itself may be the thing that is failing.
const listeners = new Set();
const pending = new Map();
let snapshot = Object.freeze([]);

export function subscribeSaveFailures(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSaveFailures() {
  // Stable reference between changes, suitable for useSyncExternalStore.
  return snapshot;
}

function publish() {
  snapshot = Object.freeze(
    [...pending.entries()].map(([key, item]) =>
      Object.freeze({
        key,
        label: item.label,
        message: item.message,
      })
    )
  );

  for (const listener of listeners) listener();
}

function failureMessage(error) {
  if (error?.name === 'QuotaExceededError') {
    return 'Browser storage is full or its quota was exceeded.';
  }

  if (error?.name === 'SecurityError') {
    return 'The browser blocked access to local storage.';
  }

  return 'The latest data could not be written and verified in browser storage.';
}

// Never show success merely because React updated. Writing and read-back
// verification must both succeed. This does not replace a full backup.
export function saveJSON(key, value, label = key, storage) {
  try {
    const raw = JSON.stringify(value);

    if (typeof raw !== 'string') {
      throw new Error('The value cannot be saved as JSON.');
    }

    const target = storage ?? globalThis.localStorage;
    target.setItem(key, raw);

    if (target.getItem(key) !== raw) {
      throw new Error('Saved data could not be verified.');
    }

    if (pending.delete(key)) publish();

    return true;
  } catch (error) {
    // Keep the latest value, not the first failed edit. React state remains
    // the user's working copy; do not roll it back or reload on failure.
    pending.set(key, {
      value,
      label,
      message: failureMessage(error),
    });

    publish();
    return false;
  }
}

export function retryFailedSaves(storage) {
  // Snapshot the entries because successful saves remove themselves.
  for (const [key, item] of [...pending.entries()]) {
    saveJSON(key, item.value, item.label, storage);
  }

  return pending.size === 0;
}

// Recovery code can obtain the in-memory values separately from the small
// public warning snapshot. These are NOT a complete full-device backup.
export function getPendingSaveValues() {
  return [...pending.entries()].map(([key, item]) => ({
    key,
    value: item.value,
  }));
}