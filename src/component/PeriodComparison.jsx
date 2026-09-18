import React, { useState, useMemo } from 'react';
import {
  calculateTradeStats,
  calculateDrawdown,
  calculateStreaks,
  parseTimestamp,
} from '../utils/tradeStats';

const COMPARISON_PRESETS = [
  { id: '30d_vs_prior30d', label: 'Last 30 Days vs Prior 30 Days' },
  { id: 'month_vs_lastmonth', label: 'This Month vs Last Month' },
  { id: '7d_vs_prior7d', label: 'Last 7 Days vs Prior 7 Days' },
  { id: '90d_vs_prior90d', label: 'Last 90 Days vs Prior 90 Days' },
];

function getTradeDate(t) {
  const time = parseTimestamp(t.closeTime || t.openTime || t.closeAt || t.openAt);
  return time ? new Date(time) : null;
}

function filterTradesBetween(trades, start, end) {
  return trades.filter((t) => {
    const d = getTradeDate(t);
    return d && d >= start && d <= end;
  });
}

export default function PeriodComparison({ trades = [], startingBalance = 10000, currency = '$' }) {
  const [selectedPreset, setSelectedPreset] = useState('30d_vs_prior30d');

  // Compute the exact date boundaries and filtered trade arrays for Period A and B
  const { periodALabel, periodBLabel, tradesA, tradesB } = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    if (selectedPreset === 'month_vs_lastmonth') {
      // Period A: This Month (1st of this month -> now)
      const startA = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const endA = new Date(now);

      // Period B: Last Month (1st of last month -> last day of last month)
      const startB = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const endB = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

      return {
        periodALabel: 'This Month',
        periodBLabel: 'Last Month',
        tradesA: filterTradesBetween(trades, startA, endA),
        tradesB: filterTradesBetween(trades, startB, endB),
      };
    }

    if (selectedPreset === '7d_vs_prior7d') {
      // Period A: Last 7 Days
      const startA = new Date(now);
      startA.setDate(startA.getDate() - 6);
      startA.setHours(0, 0, 0, 0);
      const endA = new Date(now);

      // Period B: Prior 7 Days
      const startB = new Date(startA);
      startB.setDate(startB.getDate() - 7);
      const endB = new Date(startA);
      endB.setMilliseconds(endB.getMilliseconds() - 1);

      return {
        periodALabel: 'Last 7 Days',
        periodBLabel: 'Prior 7 Days',
        tradesA: filterTradesBetween(trades, startA, endA),
        tradesB: filterTradesBetween(trades, startB, endB),
      };
    }

    if (selectedPreset === '90d_vs_prior90d') {
      // Period A: Last 90 Days
      const startA = new Date(now);
      startA.setDate(startA.getDate() - 89);
      startA.setHours(0, 0, 0, 0);
      const endA = new Date(now);

      // Period B: Prior 90 Days
      const startB = new Date(startA);
      startB.setDate(startB.getDate() - 90);
      const endB = new Date(startA);
      endB.setMilliseconds(endB.getMilliseconds() - 1);

      return {
        periodALabel: 'Last 90 Days',
        periodBLabel: 'Prior 90 Days',
        tradesA: filterTradesBetween(trades, startA, endA),
        tradesB: filterTradesBetween(trades, startB, endB),
      };
    }

    // Default: 30d vs prior 30d
    const startA = new Date(now);
    startA.setDate(startA.getDate() - 29);
    startA.setHours(0, 0, 0, 0);
    const endA = new Date(now);

    const startB = new Date(startA);
    startB.setDate(startB.getDate() - 30);
    const endB = new Date(startA);
    endB.setMilliseconds(endB.getMilliseconds() - 1);

    return {
      periodALabel: 'Last 30 Days',
      periodBLabel: 'Prior 30 Days',
      tradesA: filterTradesBetween(trades, startA, endA),
      tradesB: filterTradesBetween(trades, startB, endB),
    };
  }, [trades, selectedPreset]);

  // Compute stats for both periods using the standardized trade engine
  const statsA = useMemo(() => calculateTradeStats(tradesA), [tradesA]);
  const statsB = useMemo(() => calculateTradeStats(tradesB), [tradesB]);

  const ddA = useMemo(() => calculateDrawdown(tradesA, startingBalance), [tradesA, startingBalance]);
  const ddB = useMemo(() => calculateDrawdown(tradesB, startingBalance), [tradesB, startingBalance]);

  const streaksA = useMemo(() => calculateStreaks(tradesA), [tradesA]);
  const streaksB = useMemo(() => calculateStreaks(tradesB), [tradesB]);

  // Helper function to calculate deltas
  const delta = (valA, valB) => {
    const numA = Number(valA) || 0;
    const numB = Number(valB) || 0;
    return numA - numB;
  };

  const renderDelta = (diff, formatFn, isPositiveGood = true) => {
    if (diff === 0 || isNaN(diff)) {
      return <span style={{ color: 'var(--text-muted)' }}>0</span>;
    }
    const isGood = isPositiveGood ? diff > 0 : diff < 0;
    const color = isGood ? 'var(--color-win)' : 'var(--color-loss)';
    const sign = diff > 0 ? '+' : '';
    return (
      <span className="number-font" style={{ color, fontWeight: 700 }}>
        {sign}{formatFn ? formatFn(diff) : diff.toFixed(2)}
      </span>
    );
  };

  const fmtCurrency = (n) => {
    const abs = Math.abs(n).toFixed(2);
    return n < 0 ? `-${currency}${abs}` : `${currency}${abs}`;
  };

  return (
    <div className="ts-card" style={{ marginBottom: '28px' }}>
      {/* Header & Controls */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>🔄 Period Comparison</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Compare performance metrics side-by-side across two distinct trading windows.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {COMPARISON_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPreset(p.id)}
              className="ts-btn"
              style={{
                backgroundColor: selectedPreset === p.id ? 'var(--accent-blue)' : 'var(--bg-main)',
                color: selectedPreset === p.id ? '#fff' : 'var(--text-secondary)',
                border: '1px solid ' + (selectedPreset === p.id ? 'var(--accent-blue)' : 'var(--border-color)'),
                padding: '6px 10px',
                fontSize: '11px',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="ts-table" style={{ fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Performance Metric</th>
              <th style={{ color: '#38bdf8' }}>{periodALabel} (A)</th>
              <th style={{ color: '#a78bfa' }}>{periodBLabel} (B)</th>
              <th>Difference (A vs B)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Total Trades</td>
              <td className="number-font">{statsA.count}</td>
              <td className="number-font">{statsB.count}</td>
              <td>{renderDelta(delta(statsA.count, statsB.count), (d) => `${d} trades`, true)}</td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Net P&L</td>
              <td className="number-font" style={{ fontWeight: 700, color: statsA.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                {fmtCurrency(statsA.netPnL)}
              </td>
              <td className="number-font" style={{ fontWeight: 700, color: statsB.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                {fmtCurrency(statsB.netPnL)}
              </td>
              <td>{renderDelta(delta(statsA.netPnL, statsB.netPnL), fmtCurrency, true)}</td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Win Rate</td>
              <td className="number-font" style={{ color: '#38bdf8' }}>
                {statsA.count > 0 ? `${statsA.winRate}%` : '—'}
              </td>
              <td className="number-font" style={{ color: '#a78bfa' }}>
                {statsB.count > 0 ? `${statsB.winRate}%` : '—'}
              </td>
              <td>
                {statsA.count > 0 && statsB.count > 0
                  ? renderDelta(delta(statsA.winRate, statsB.winRate), (d) => `${d.toFixed(1)}%`, true)
                  : '—'}
              </td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Average R-Multiple</td>
              <td className="number-font">
                {statsA.countWithR > 0 ? `${statsA.avgR > 0 ? '+' : ''}${statsA.avgR}R` : '—'}
              </td>
              <td className="number-font">
                {statsB.countWithR > 0 ? `${statsB.avgR > 0 ? '+' : ''}${statsB.avgR}R` : '—'}
              </td>
              <td>
                {statsA.countWithR > 0 && statsB.countWithR > 0
                  ? renderDelta(delta(statsA.avgR, statsB.avgR), (d) => `${d.toFixed(2)}R`, true)
                  : '—'}
              </td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Profit Factor</td>
              <td className="number-font">{statsA.count > 0 ? statsA.profitFactor : '—'}</td>
              <td className="number-font">{statsB.count > 0 ? statsB.profitFactor : '—'}</td>
              <td>
                {statsA.profitFactor !== '∞' && statsB.profitFactor !== '∞' && statsA.count > 0 && statsB.count > 0
                  ? renderDelta(delta(statsA.profitFactor, statsB.profitFactor), (d) => d.toFixed(2), true)
                  : '—'}
              </td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Expectancy / Trade</td>
              <td className="number-font" style={{ fontWeight: 700, color: statsA.expectancy >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                {statsA.count > 0 ? fmtCurrency(statsA.expectancy) : '—'}
              </td>
              <td className="number-font" style={{ fontWeight: 700, color: statsB.expectancy >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                {statsB.count > 0 ? fmtCurrency(statsB.expectancy) : '—'}
              </td>
              <td>{renderDelta(delta(statsA.expectancy, statsB.expectancy), fmtCurrency, true)}</td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Average Win</td>
              <td className="number-font" style={{ color: 'var(--color-win)' }}>
                {statsA.wins > 0 ? `+${fmtCurrency(statsA.avgWin)}` : '—'}
              </td>
              <td className="number-font" style={{ color: 'var(--color-win)' }}>
                {statsB.wins > 0 ? `+${fmtCurrency(statsB.avgWin)}` : '—'}
              </td>
              <td>{renderDelta(delta(statsA.avgWin, statsB.avgWin), fmtCurrency, true)}</td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Average Loss</td>
              <td className="number-font" style={{ color: 'var(--color-loss)' }}>
                {statsA.losses > 0 ? `-${fmtCurrency(statsA.avgLoss)}` : '—'}
              </td>
              <td className="number-font" style={{ color: 'var(--color-loss)' }}>
                {statsB.losses > 0 ? `-${fmtCurrency(statsB.avgLoss)}` : '—'}
              </td>
              {/* Note: A reduction in average loss is good (isPositiveGood = false) */}
              <td>{renderDelta(delta(statsA.avgLoss, statsB.avgLoss), fmtCurrency, false)}</td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Max Drawdown ($)</td>
              <td className="number-font" style={{ color: 'var(--color-loss)' }}>
                {ddA.maxDrawdownDollars > 0 ? `-${currency}${ddA.maxDrawdownDollars.toFixed(2)}` : `${currency}0.00`}
              </td>
              <td className="number-font" style={{ color: 'var(--color-loss)' }}>
                {ddB.maxDrawdownDollars > 0 ? `-${currency}${ddB.maxDrawdownDollars.toFixed(2)}` : `${currency}0.00`}
              </td>
              {/* Note: A lower drawdown in Period A is good (isPositiveGood = false) */}
              <td>{renderDelta(delta(ddA.maxDrawdownDollars, ddB.maxDrawdownDollars), fmtCurrency, false)}</td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Max Win Streak</td>
              <td className="number-font">{streaksA.maxWinStreak} trades</td>
              <td className="number-font">{streaksB.maxWinStreak} trades</td>
              <td>{renderDelta(delta(streaksA.maxWinStreak, streaksB.maxWinStreak), (d) => `${d} trades`, true)}</td>
            </tr>

            <tr>
              <td style={{ fontWeight: 600 }}>Max Loss Streak</td>
              <td className="number-font">{streaksA.maxLossStreak} trades</td>
              <td className="number-font">{streaksB.maxLossStreak} trades</td>
              {/* Note: A lower losing streak in Period A is good (isPositiveGood = false) */}
              <td>{renderDelta(delta(streaksA.maxLossStreak, streaksB.maxLossStreak), (d) => `${d} trades`, false)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}