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

export function filterTradesByPeriod(trades = [], period = 'All Time') {
  if (!Array.isArray(trades) || period === 'All Time' || period === 'all') return trades;

  const now = new Date();
  now.setHours(23, 59, 59, 999);

  return trades.filter((trade) => {
    const tradeDate = toDate(trade.openAt || trade.openTime || trade.date);
    if (!tradeDate) return false;

    const diffInDays = (now - tradeDate) / (1000 * 60 * 60 * 24);

    switch (period) {
      case 'Today':
      case 'today':
        return tradeDate.toDateString() === now.toDateString();
      case '7 days':
      case '7d':
        return diffInDays <= 7 && diffInDays >= 0;
      case '30 days':
      case '30d':
        return diffInDays <= 30 && diffInDays >= 0;
      case '60 days':
      case '60d':
        return diffInDays <= 60 && diffInDays >= 0;
      case '90 days':
      case '90d':
        return diffInDays <= 90 && diffInDays >= 0;
      case 'This Month':
      case 'month':
        return (
          tradeDate.getMonth() === now.getMonth() &&
          tradeDate.getFullYear() === now.getFullYear()
        );
      default:
        return true;
    }
  });
}

export function sortTradesByDate(trades = [], newestFirst = true) {
  return [...trades].sort((a, b) => {
    const dateA = toDate(a.openAt || a.openTime || a.date) || new Date(0);
    const dateB = toDate(b.openAt || b.openTime || b.date) || new Date(0);
    return newestFirst ? dateB - dateA : dateA - dateB;
  });
}