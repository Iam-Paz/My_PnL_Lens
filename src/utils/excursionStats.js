import { isTradeOpen } from './dateUtils.js';
import { getExcursion, optionalNumber } from './excursion.js';

// Each metric has its own eligible sample; missing data never becomes zero.
const average = (values) => values.length
  ? values.reduce((mean, value) => mean + value / values.length, 0)
  : null;

export function calculateExcursionStats(trades = []) {
  const result = {
    closedCount: 0, ignoredOpenCount: 0, invalidCount: 0, validCount: 0,
    missingMfeCount: 0, missingMaeCount: 0, missingRiskCount: 0,
    pairedCount: 0, avgPairedMfeR: null, avgPairedRealisedR: null,
    captureCount: 0, avgCapture: null,
    winnerMaeCount: 0, avgWinnerMaeR: null,
    favourableCount: 0, winnerTurnedLoserCount: 0, winnerToBeCount: 0,
    favourableBeNetLossCount: 0, outcomes: [],
  };
  const pairedMfe = [];
  const pairedRealised = [];
  const captures = [];
  const winnerMae = [];
  const outcomeCounts = new Map();

  for (const trade of Array.isArray(trades) ? trades : []) {
    if (!trade || typeof trade !== 'object' || Array.isArray(trade)) continue;
    if (isTradeOpen(trade)) {
      result.ignoredOpenCount++;
      continue;
    }
    result.closedCount++;
    const ex = getExcursion(trade);
    const pnl = optionalNumber(trade.pnl ?? trade.profit);
    const risk = optionalNumber(trade.riskAmount);
    if (pnl === null || ex.error || (ex.realisedR !== null && !Number.isFinite(ex.realisedR))) {
      result.invalidCount++;
      continue;
    }
    result.validCount++;
    if (ex.mfeR === null) result.missingMfeCount++;
    if (ex.maeR === null) result.missingMaeCount++;
    if (!(risk > 0)) result.missingRiskCount++;
    outcomeCounts.set(ex.outcome, (outcomeCounts.get(ex.outcome) || 0) + 1);

    // Use the SAME trades on both sides of the MFE / realised-R comparison.
    if (ex.mfeR !== null && ex.realisedR !== null) {
      pairedMfe.push(ex.mfeR);
      pairedRealised.push(ex.realisedR);
    }
    // Capture is a per-trade percentage, averaged only over eligible winners.
    if (ex.capture !== null && Number.isFinite(ex.capture)) captures.push(ex.capture);
    // Recorded MAE is already in R, so this metric does not require money risk.
    if (pnl > 0 && ex.maeR !== null) winnerMae.push(ex.maeR);
    if (ex.mfeR > 0) {
      result.favourableCount++;
      if (ex.outcome === 'Winner Turned Loser') result.winnerTurnedLoserCount++;
      if (ex.outcome === 'Winner to Breakeven') result.winnerToBeCount++;
      if (ex.outcome === 'Breakeven exit - net loss') result.favourableBeNetLossCount++;
    }
  }

  result.pairedCount = pairedMfe.length;
  result.avgPairedMfeR = average(pairedMfe);
  result.avgPairedRealisedR = average(pairedRealised);
  result.captureCount = captures.length;
  result.avgCapture = average(captures);
  result.winnerMaeCount = winnerMae.length;
  result.avgWinnerMaeR = average(winnerMae);
  result.outcomes = [...outcomeCounts].map(([outcome, count]) => ({
    outcome, count, percent: count / result.validCount * 100,
  })).sort((a, b) => b.count - a.count || a.outcome.localeCompare(b.outcome));
  return result;
}