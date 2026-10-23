import { isTradeOpen } from './dateUtils.js';
import { optionalNumber } from './excursion.js';
import {
  ENTRY_EXECUTIONS,
  MARKET_CONDITIONS,
  normalizeTradeContext,
} from './tradeContext.js';
import {
  TRADE_MISTAKES,
  normalizeTradeMistakes,
} from './tradeMistakes.js';

const EMOTIONS = [
  'Calm', 'Confident', 'Disciplined', 'Patient', 'FOMO', 'Revenge Trading',
  'Anxious', 'Overconfident', 'Fearful', 'Greedy', 'Bored',
];

export const CONTEXT_ANALYSIS_GROUPS = [
  ['entryExecution', 'Entry execution'],
  ['marketCondition', 'Market condition'],
  ['mistakes', 'Mistakes'],
  ['emotions', 'Emotions'],
];

// A descriptive caution threshold, not a statistical significance test.
export const SMALL_SAMPLE_THRESHOLD = 10;

function selections(trade, group) {
  if (group === 'mistakes') {
    return normalizeTradeMistakes(trade.mistakes);
  }

  if (group === 'emotions') {
    const selected = new Set(
      Array.isArray(trade.emotions) ? trade.emotions : []
    );

    return EMOTIONS.filter((emotion) => selected.has(emotion));
  }

  const context = normalizeTradeContext(trade);
  return context[group] ? [context[group]] : [];
}

function optionsFor(group) {
  if (group === 'entryExecution') return ENTRY_EXECUTIONS;
  if (group === 'marketCondition') return MARKET_CONDITIONS;
  if (group === 'mistakes') return TRADE_MISTAKES;

  return EMOTIONS.map((label) => [label, label]);
}

function emptyRow(id, label, unrecorded = false) {
  return {
    id,
    label,
    unrecorded,
    tradeCount: 0,
    pnlCount: 0,
    netPnl: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    rCount: 0,
    totalR: 0,
  };
}

// The caller supplies Analytics' already period/global-filter-scoped trades.
// Closed-only is also enforced here so this utility is safe to reuse.
export function buildContextAnalysis(
  trades = [],
  group = 'entryExecution'
) {
  if (!CONTEXT_ANALYSIS_GROUPS.some(([id]) => id === group)) {
    return null;
  }

  const rows = new Map(
    optionsFor(group).map(([id, label]) => [
      id,
      emptyRow(id, label),
    ])
  );

  const missing = emptyRow('__unrecorded', 'Unrecorded', true);
  let total = 0;
  let recorded = 0;

  for (const trade of Array.isArray(trades) ? trades : []) {
    if (
      !trade ||
      typeof trade !== 'object' ||
      isTradeOpen(trade)
    ) {
      continue;
    }

    total++;

    const selected = selections(trade, group);
    if (selected.length) recorded++;

    const targets = selected.length
      ? selected.map((id) => rows.get(id))
      : [missing];

    const pnl = optionalNumber(trade.pnl ?? trade.profit);
    const risk = optionalNumber(trade.riskAmount);

    const rawR = pnl !== null && risk > 0
      ? pnl / risk
      : null;

    const realisedR = rawR !== null && Number.isFinite(rawR)
      ? rawR
      : null;

    for (const row of targets) {
      row.tradeCount++;

      if (pnl !== null) {
        row.pnlCount++;
        row.netPnl += pnl;

        if (pnl > 0) row.wins++;
        else if (pnl < 0) row.losses++;
        else row.breakevens++;
      }

      if (realisedR !== null) {
        row.rCount++;
        row.totalR += realisedR;
      }
    }
  }

  const finish = (row) => ({
    id: row.id,
    label: row.label,
    unrecorded: row.unrecorded,
    tradeCount: row.tradeCount,
    pnlCount: row.pnlCount,
    invalidPnlCount: row.tradeCount - row.pnlCount,
    netPnl: row.pnlCount ? row.netPnl : null,
    wins: row.wins,
    losses: row.losses,
    breakevens: row.breakevens,
    winRate: row.pnlCount
      ? row.wins / row.pnlCount * 100
      : null,
    rCount: row.rCount,
    averageNetR: row.rCount
      ? row.totalR / row.rCount
      : null,
    smallSample: row.tradeCount < SMALL_SAMPLE_THRESHOLD,
    smallRSample: row.rCount < SMALL_SAMPLE_THRESHOLD,
  });

  return {
    group,
    total,
    recorded,
    unrecorded: total - recorded,
    coverage: total ? recorded / total * 100 : null,
    overlapping: group === 'mistakes' || group === 'emotions',
    rows: [
      ...[...rows.values()]
        .filter((row) => row.tradeCount > 0)
        .map(finish),
      ...(missing.tradeCount ? [finish(missing)] : []),
    ],
  };
}