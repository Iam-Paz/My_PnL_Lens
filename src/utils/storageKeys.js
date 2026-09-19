// Single source of truth for every localStorage key used by My_PnL_Lens.
// Nothing outside this file should contain a raw 'mypnllens_*' string.

export const STORAGE_KEYS = {
  accounts: 'mypnllens_accounts',
  activeAccount: 'mypnllens_active_account',
  playbooks: 'mypnllens_playbooks',
  activityLog: 'mypnllens_activity_log',
  defaultPage: 'mypnllens_default_page',
  displayName: 'mypnllens_display_name',
  sidebarCollapsed: 'mypnllens_sidebar_collapsed',
  myTickets: 'mypnllens_my_tickets',
  // Very old single-account format (kept so old installs still migrate)
  legacyTrades: 'mypnllens_trades',
  legacySettings: 'mypnllens_settings',
};

// Old 'tradersstack_*' keys from before the rebrand -> their new home.
// Runs once at startup so existing users keep their data.
const LEGACY_KEY_MAP = {
  tradersstack_accounts: STORAGE_KEYS.accounts,
  tradersstack_active_account: STORAGE_KEYS.activeAccount,
  tradersstack_playbooks: STORAGE_KEYS.playbooks,
  tradersstack_activity_log: STORAGE_KEYS.activityLog,
  tradersstack_default_page: STORAGE_KEYS.defaultPage,
  tradersstack_display_name: STORAGE_KEYS.displayName,
  tradersstack_sidebar_collapsed: STORAGE_KEYS.sidebarCollapsed,
  tradersstack_my_tickets: STORAGE_KEYS.myTickets,
  tradersstack_trades: STORAGE_KEYS.legacyTrades,
  tradersstack_settings: STORAGE_KEYS.legacySettings,
};

export function migrateLegacyKeys() {
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEY_MAP)) {
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldValue);
      }
      if (oldValue !== null) {
        localStorage.removeItem(oldKey);
      }
    }
  } catch (err) {
    console.warn('Storage migration failed, continuing with fresh keys:', err);
  }
}

export function clearAllAppStorage() {
  try {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    Object.keys(LEGACY_KEY_MAP).forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn('Failed to clear storage:', err);
  }
}