import { isTradeOpen } from './dateUtils.js';
import { getReviewPeriod, localReviewDay } from './reviewPeriods.js';
import {
  TRADE_MISTAKES,
  normalizeTradeMistakes,
} from './tradeMistakes.js';

// Manual date-only values keep their day. Explicit timezone timestamps use
// that timezone; timezone-free broker times use the account's UTC offset.
export function getReviewCloseDay(trade, brokerUtcOffset = 2) {
  const raw = String(trade?.closeAt || trade?.closeTime || '').trim();
  if (!raw) return '';

  const match = raw.match(
    /^(\d{4})[-./](\d{2})[-./](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?)?$/i
  );

  if (!match) return '';

  const [, y, m, d, hh, mm, ss = '0', fraction = '', zone] = match;
  const day = `${y}-${m}-${d}`;

  if (!getReviewPeriod('monthly', day)) return '';
  if (hh === undefined) return day;
  if (+hh > 23 || +mm > 59 || +ss > 59) return '';

  if (zone) {
    const instant = new Date(
      `${day}T${hh}:${mm}:${ss.padStart(2, '0')}${fraction ? '.' + fraction : ''}${zone.toUpperCase()}`
    );
    return localReviewDay(instant);
  }

  const offset = Number(brokerUtcOffset);
  if (!Number.isFinite(offset) || offset < -14 || offset > 14) return '';

  const instant = new Date(
    Date.UTC(
      +y,
      +m - 1,
      +d,
      +hh,
      +mm,
      +ss,
      +(fraction.padEnd(3, '0') || 0)
    ) - offset * 3600000
  );

  return localReviewDay(instant);
}

function netPnL(trade) {
  const raw = trade.pnl ?? trade.profit;

  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && !raw.trim()) return null;

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

// Call with ONLY the active account's trades; global filters are not applied.
export function buildReviewSummary(
  trades = [],
  type,
  day,
  brokerUtcOffset = 2
) {
  const period = getReviewPeriod(type, day);
  if (!period) return null;

  const scoped = [];
  let undatedClosed = 0;

  for (const trade of Array.isArray(trades) ? trades : []) {
    if (!trade || typeof trade !== 'object' || isTradeOpen(trade)) continue;

    const closeDay = getReviewCloseDay(trade, brokerUtcOffset);

    if (!closeDay) {
      undatedClosed++;
      continue;
    }

    if (closeDay >= period.start && closeDay < period.nextStart) {
      scoped.push(trade);
    }
  }

  let netPnl = 0;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let invalidPnl = 0;
  let withMistakes = 0;
  let noMistakeIdentified = 0;
  let unrecorded = 0;

  const counts = new Map();

  for (const trade of scoped) {
    const pnl = netPnL(trade);

    if (pnl === null) {
      invalidPnl++;
    } else {
      netPnl += pnl;
      if (pnl > 0) wins++;
      else if (pnl < 0) losses++;
      else breakevens++;
    }

    const mistakes = normalizeTradeMistakes(trade.mistakes);

    if (!mistakes.length) {
      unrecorded++;
    } else if (mistakes.includes('none')) {
      noMistakeIdentified++;
    } else {
      withMistakes++;

      for (const id of mistakes) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
  }

  const validPnlCount = wins + losses + breakevens;

  const mistakeCounts = TRADE_MISTAKES
    .filter(([id]) => id !== 'none' && counts.has(id))
    .map(([id, label]) => ({ id, label, count: counts.get(id) }))
    .sort((a, b) => b.count - a.count);

  return {
    period,
    closedCount: scoped.length,
    netPnl,
    wins,
    losses,
    breakevens,
    validPnlCount,
    invalidPnl,
    winRate: validPnlCount ? wins / validPnlCount * 100 : null,
    withMistakes,
    noMistakeIdentified,
    unrecorded,
    mistakeCounts,
    // Across the account, not attributed to this period:
    // these trades have no usable close date.
    undatedClosed,
  };
}