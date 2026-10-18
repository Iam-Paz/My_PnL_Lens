import { isTradeOpen } from './dateUtils.js';

// Blank is unknown; zero is an explicitly recorded observation.
export function optionalNumber(value) {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

// Excursions and closing P&L use the SAME net-of-costs basis.
// Original risk is fixed for the trade, not the current/moved stop risk.
export function getExcursion(t) {
  const rawMfe = optionalNumber(t.mfeR);
  const rawMae = optionalNumber(t.maeR);
  const risk = optionalNumber(t.riskAmount);
  const pnl = optionalNumber(t.pnl ?? t.profit);
  const open = isTradeOpen(t);
  const realisedR = !open && risk > 0 && pnl !== null ? pnl / risk : null;
  const mfeR = rawMfe !== null && rawMfe >= 0 ? rawMfe : null;
  const maeR = rawMae !== null && rawMae <= 0 ? rawMae : null;
  let error = '';
  if (t.mfeR != null && String(t.mfeR).trim() && (rawMfe === null || rawMfe < 0)) error = 'MFE must be a finite number, zero or positive.';
  else if (t.maeR != null && String(t.maeR).trim() && (rawMae === null || rawMae > 0)) error = 'MAE must be a finite number, zero or negative.';
  else if (realisedR > 0 && mfeR !== null && realisedR - mfeR > 1e-9) error = 'MFE cannot be below positive realised R. Check risk and use the same net-of-costs basis.';
  else if (realisedR < 0 && maeR !== null && maeR - realisedR > 1e-9) error = 'MAE cannot be above negative realised R. Include the closing result in the recorded extremes.';
  const capture = !error && realisedR > 0 && mfeR > 0 ? realisedR / mfeR * 100 : null;
  let outcome;
  if (open) outcome = 'Open';
  else if (pnl === null) outcome = 'Result not recorded';
  else if (error) outcome = 'Check excursion data';
  else if (t.exitType === 'be' && pnl < 0) outcome = 'Breakeven exit - net loss';
  else if (pnl > 0) outcome = capture >= 90 - 1e-9 ? 'Maximum Profit Captured' : capture >= 60 - 1e-9 ? 'Strong Capture' : mfeR === null ? 'Profit' : 'Profit Taken';
  else if (pnl < 0) outcome = mfeR > 0 ? 'Winner Turned Loser' : mfeR === 0 ? 'Loss - No Favourable Excursion' : 'Loss';
  else outcome = mfeR > 0 ? 'Winner to Breakeven' : 'Breakeven';
  const money = (r) => {
    if (r === null || !(risk > 0)) return null;
    const value = r * risk;
    return Number.isFinite(value) ? roundMoney(value) : null;
  };
  return { mfeR, maeR, mfeMoney: money(mfeR), maeMoney: money(maeR), realisedR, capture, outcome, error };
}
