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

/**
 * Shape-guard for the persisted global filter. Anything that isn't an array
 * of strings falls back to unconstrained, and direction/outcome picks are
 * restricted to their known vocabularies — so a corrupt or tampered stored
 * value can never crash a page, it just means "show everything".
 */
export function sanitizeGlobalFilter(v) {
  const clean = (arr) => (Array.isArray(arr)
    ? arr.filter((x) => typeof x === 'string').slice(0, 200)
    : []);
  const src = v && typeof v === 'object' ? v : {};
  return {
    symbols: clean(src.symbols),
    setups: clean(src.setups),
    directions: clean(src.directions).filter((d) => d === 'buy' || d === 'sell'),
    outcomes: clean(src.outcomes).filter((o) => o === 'win' || o === 'loss'),
  };
}

/**
 * Cross-page global filter (Dashboard, Analytics, Journal): keeps a trade
 * only when it matches EVERY constrained dimension. An empty dimension
 * matches everything, so the default filter is a pure pass-through.
 * Orthogonal to open/closed status — that stays the period filter's job.
 * Pure: same input always gives same output, safe to call during render.
 */
export function filterTradesGlobal(trades = [], gf = null) {
  if (!Array.isArray(trades)) return [];
  const f = sanitizeGlobalFilter(gf);
  const wantSymbols = f.symbols.length > 0;
  const wantSetups = f.setups.length > 0;
  const wantDirs = f.directions.length > 0;
  const wantOutcomes = f.outcomes.length > 0;
  if (!wantSymbols && !wantSetups && !wantDirs && !wantOutcomes) return trades;
  const symSet = new Set(f.symbols);
  const setupSet = new Set(f.setups);
  const dirSet = new Set(f.directions);
  const outSet = new Set(f.outcomes);
  return trades.filter((t) => {
    if (!t) return false;
    if (wantSymbols && !symSet.has(String(t.symbol || ''))) return false;
    if (wantSetups && !setupSet.has(String(t.setup || 'Untagged'))) return false;
    if (wantDirs) {
      const raw = String(t.direction || t.type || '').trim().toLowerCase();
      const dir = raw.includes('sell') || raw === 'short' ? 'sell' : 'buy';
      if (!dirSet.has(dir)) return false;
    }
    if (wantOutcomes) {
      const pnl = Number(t.pnl ?? t.profit) || 0;
      const out = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'flat';
      if (!outSet.has(out)) return false; // flat/breakeven matches neither
    }
    return true;
  });
}

/**
 * Active-selection count for the "Filters (N)" badges. Sanitized first so a
 * corrupt stored value shows 0 instead of crashing.
 */
export function countGlobalFilter(gf) {
  const f = sanitizeGlobalFilter(gf);
  return f.symbols.length + f.setups.length + f.directions.length + f.outcomes.length;
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

/**
 * Vocabularies for the Journal's own filter bar (search/sort/review/status).
 * Persisted separately from the cross-page global filter.
 */
export const JOURNAL_SORTS = ['newest', 'oldest', 'pnlHigh', 'pnlLow'];
export const JOURNAL_REVIEWS = ['all', 'unreviewed', 'reviewed'];
export const JOURNAL_STATUSES = ['all', 'open', 'closed'];

/**
 * Shape-guard for the persisted journal filter bar. Corrupt or tampered
 * stored values fall back per-field, so storage can never break the page.
 * Pure: same input always gives same output.
 */
export function sanitizeJournalFilters(v) {
  const src = v && typeof v === 'object' ? v : {};
  const search = typeof src.search === 'string' ? src.search.slice(0, 120) : '';
  const sort = JOURNAL_SORTS.includes(src.sort) ? src.sort : 'newest';
  const review = JOURNAL_REVIEWS.includes(src.review) ? src.review : 'all';
  const status = JOURNAL_STATUSES.includes(src.status) ? src.status : 'all';
  return { search, sort, review, status };
}

/**
 * Shape-guard for persisted journal column prefs: {visible:[ids], order:[ids]}.
 * - order is repaired into a permutation of allIds (unknown ids dropped,
 *   dupes collapsed, missing ids appended in default position)
 * - visible keeps known ids only (defaults to all when absent)
 * Pure: same input always gives same output.
 */
export function sanitizeJournalColumns(v, allIds = []) {
  const known = Array.isArray(allIds) ? allIds.filter((x) => typeof x === 'string') : [];
  const src = v && typeof v === 'object' ? v : {};
  const seen = {};
  const order = [];
  if (Array.isArray(src.order)) {
    for (const id of src.order) {
      if (typeof id === 'string' && known.includes(id) && !seen[id]) {
        seen[id] = true;
        order.push(id);
      }
    }
  }
  for (const id of known) {
    if (!seen[id]) {
      seen[id] = true;
      order.push(id);
    }
  }
  let visible;
  if (Array.isArray(src.visible)) {
    visible = src.visible.filter((id) => typeof id === 'string' && known.includes(id));
  } else {
    visible = known.slice();
  }
  return { visible, order };
}

/**
 * Move one column id up (dir=-1) or down (dir=+1) inside order.
 * Clamped at the ends; unknown ids leave order untouched.
 * Pure: never mutates, always returns a new array.
 */
export function moveColumnId(order, id, dir) {
  const list = Array.isArray(order) ? order.slice() : [];
  const i = list.indexOf(id);
  if (i === -1) return list;
  const j = dir < 0 ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return list;
  const tmp = list[i];
  list[i] = list[j];
  list[j] = tmp;
  return list;
}