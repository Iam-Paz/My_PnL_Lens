/**
 * Shared date helpers — MT5-safe
 */

export function toDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    return isNaN(dateVal.getTime()) ? null : dateVal;
  }

  let s = String(dateVal).trim();
  if (!s) return null;

  // Already ISO-ish
  if (s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }

  // Normalize slashes
  s = s.replace(/\//g, '-');

  // MT5: 2026.01.08 17:00:04  or  2026.01.08  or  2026-01-08 17:00
  const mt5 = s.match(
    /^(\d{4})[.-](\d{2})[.-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (mt5) {
    const [, y, m, d, hh = '00', mm = '00', ss = '00'] = mt5;
    const iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
    const dt = new Date(iso);
    if (!isNaN(dt.getTime())) return dt;
  }

  // Fallback attempts
  const cleaned = s.replace(/\./g, '-').replace(' ', 'T');
  const d2 = new Date(cleaned);
  if (!isNaN(d2.getTime())) return d2;

  const d3 = new Date(s);
  return isNaN(d3.getTime()) ? null : d3;
}

export function formatDateTime(dateVal) {
  const d = toDate(dateVal);
  if (!d) {
    const raw = String(dateVal || '').trim();
    return raw || 'N/A';
  }
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatDateShort(dateVal) {
  const d = toDate(dateVal);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * The date a trade's RESULT belongs to: close time first (that's when P&L is
 * realized), falling back to open time, then plain date.
 *
 * Every period filter, calendar bucket, and equity/streak ordering in the app
 * goes through this one function, so "30D" always means the same trades on
 * the Dashboard, Analytics, and Share Card.
 */
export function getTradeResultDate(trade) {
  if (!trade) return null;
  return toDate(
    trade.closeAt || trade.closeTime || trade.openAt || trade.openTime || trade.date
  );
}

// Accepts both short ids ('7d') and legacy labels ('7 days').
const PERIOD_ALIASES = {
  'today': 'today',
  '7 days': '7d',
  '30 days': '30d',
  '60 days': '60d',
  '90 days': '90d',
  'this month': 'month',
  'all time': 'all',
};

/**
 * Open vs Closed, derived — no stored flag, nothing to migrate.
 * Open = no close time AND no exit price. Imports carry close times and old
 * manual logs carry exit prices, so all history classifies as Closed; only
 * freshly-logged "still open" trades (and close-less CSV rows) are Open.
 */
export function isTradeOpen(t) {
  if (!t) return false;
  const ct = t.closeAt || t.closeTime;
  return !ct && !Number(t.exitPrice);
}

/**
 * The ONE period filter for the whole app (Dashboard, Analytics, Share Card).
 * Calendar-day boundaries on the result date — same rules on every page.
 * Realized-only: open trades are excluded here, centrally.
 */
export function filterTradesByPeriod(trades = [], period = 'all', customRange = null) {
  if (!Array.isArray(trades)) return [];
  // Realized-only: open trades live in the Journal; every scoped stat is closed-only.
  const closed = trades.filter((t) => !isTradeOpen(t));
  const raw = String(period).toLowerCase();
  const key = PERIOD_ALIASES[raw] || raw;
  if (key === 'all') return closed;

  const now = new Date();
  now.setHours(23, 59, 59, 999);
  let start = new Date(now);
  let end = new Date(now);

  if (key === 'today') start.setHours(0, 0, 0, 0);
  else if (key === '7d') { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
  else if (key === '30d') { start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0); }
  else if (key === '60d') { start.setDate(start.getDate() - 59); start.setHours(0, 0, 0, 0); }
  else if (key === '90d') { start.setDate(start.getDate() - 89); start.setHours(0, 0, 0, 0); }
  else if (key === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (key === 'custom') {
    const cs = toDate(customRange && customRange.start);
    const ce = toDate(customRange && customRange.end);
    if (!cs || !ce) return [];
    start = new Date(cs.getFullYear(), cs.getMonth(), cs.getDate());
    end = new Date(ce.getFullYear(), ce.getMonth(), ce.getDate(), 23, 59, 59, 999);
  }
  else return closed; // unknown period id → don't filter rather than hide everything

  return closed.filter((t) => {
    const d = getTradeResultDate(t);
    return d && d >= start && d <= end;
  });
}

export function sortTradesByDate(trades = [], newestFirst = true) {
  return [...trades].sort((a, b) => {
    const dateA = toDate(a.openAt || a.openTime || a.date) || new Date(0);
    const dateB = toDate(b.openAt || b.openTime || b.date) || new Date(0);
    return newestFirst ? dateB - dateA : dateA - dateB;
  });
}

/**
 * Prop-firm inactivity guard: the last day with ANY trade activity (an open
 * OR a close counts — firms reset the clock on any executed trade), plus the
 * consecutive inactive calendar days from then through today.
 * Returns null when there are no dated trades (brand-new account: show it
 * as new, never flag it as inactive).
 */
export function getLastActivityDate(trades = []) {
  let latest = null;
  for (const t of trades || []) {
    if (!t) continue;
    const raws = [t.openAt, t.openTime, t.closeAt, t.closeTime, t.date];
    for (const raw of raws) {
      const d = toDate(raw);
      if (d && (!latest || d > latest)) latest = d;
    }
  }
  return latest;
}

export function getInactiveDays(trades = [], now = new Date()) {
  const last = getLastActivityDate(trades);
  if (!last) return null;
  const a = new Date(last); a.setHours(0, 0, 0, 0);
  const b = new Date(now); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b - a) / 86400000);
  return Math.max(0, diff);
}