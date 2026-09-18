import React, { useState, useMemo } from 'react';
import { calculateEmotionStats } from '../utils/tradeStats';

export default function EmotionAnalysis({ trades = [] }) {
  const [sortField, setSortField] = useState('count');

  const emotionStats = useMemo(() => {
    const data = calculateEmotionStats(trades);
    return data.sort((a, b) => {
      if (sortField === 'count') return b.count - a.count;
      if (sortField === 'netPnL') return b.netPnL - a.netPnL;
      if (sortField === 'winRate') return b.winRate - a.winRate;
      if (sortField === 'expectancy') return b.expectancy - a.expectancy;
      if (sortField === 'avgR') return b.avgR - a.avgR;
      if (sortField === 'profitFactor') {
        const pfA = a.profitFactor === '∞' ? 9999 : Number(a.profitFactor) || 0;
        const pfB = b.profitFactor === '∞' ? 9999 : Number(b.profitFactor) || 0;
        return pfB - pfA;
      }
      return 0;
    });
  }, [trades, sortField]);

  if (trades.length === 0) {
    return null;
  }

  return (
    <div className="ts-card" style={{ marginBottom: '24px' }}>
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>🧠 Emotion & Mindset Performance</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Observed historical outcomes grouped by recorded emotional state.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>Sort By:</span>
          <select
            className="ts-input"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            style={{ width: 'auto', padding: '4px 8px' }}
          >
            <option value="count">Most Tagged</option>
            <option value="netPnL">Net P&L</option>
            <option value="winRate">Win Rate %</option>
            <option value="expectancy">Expectancy ($)</option>
            <option value="avgR">Avg R</option>
            <option value="profitFactor">Profit Factor</option>
          </select>
        </div>
      </div>

      {/* Emotion Breakdown Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="ts-table">
          <thead>
            <tr>
              <th>Emotion / Mindset</th>
              <th>Trades</th>
              <th>Win Rate</th>
              <th>Net P&L</th>
              <th>Avg Win</th>
              <th>Avg Loss</th>
              <th>Avg R</th>
              <th>PF</th>
              <th>Expectancy</th>
            </tr>
          </thead>
          <tbody>
            {emotionStats.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px' }}>
                  No emotion tags recorded yet. Tag trades with emotions to view mindset insights.
                </td>
              </tr>
            ) : (
              emotionStats.map((row) => (
                <tr key={row.emotion}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{row.emotion}</span>
                      {row.isLowSample && (
                        <span
                          title="Sample size < 5 trades. Results may not be statistically significant."
                          style={{
                            fontSize: '10px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: 'rgba(234, 179, 8, 0.15)',
                            color: '#facc15',
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                          }}
                        >
                          n &lt; 5
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="number-font">{row.count}</td>
                  <td className="number-font" style={{ color: '#38bdf8' }}>
                    {row.count > 0 ? `${row.winRate}%` : '—'}
                  </td>
                  <td
                    className="number-font"
                    style={{
                      fontWeight: 700,
                      color: row.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)',
                    }}
                  >
                    {row.netPnL >= 0 ? `+$${row.netPnL.toFixed(2)}` : `-$${Math.abs(row.netPnL).toFixed(2)}`}
                  </td>
                  <td className="number-font" style={{ color: 'var(--color-win)' }}>
                    {row.wins > 0 ? `+$${row.avgWin.toFixed(2)}` : '—'}
                  </td>
                  <td className="number-font" style={{ color: 'var(--color-loss)' }}>
                    {row.losses > 0 ? `-$${row.avgLoss.toFixed(2)}` : '—'}
                  </td>
                  <td className="number-font" style={{ color: row.avgR >= 0 ? '#38bdf8' : 'var(--color-loss)' }}>
                    {row.countWithR > 0 ? `${row.avgR > 0 ? '+' : ''}${row.avgR}R` : '—'}
                  </td>
                  <td className="number-font">{row.profitFactor}</td>
                  <td
                    className="number-font"
                    style={{
                      fontWeight: 700,
                      color: row.expectancy >= 0 ? 'var(--color-win)' : 'var(--color-loss)',
                    }}
                  >
                    {row.expectancy >= 0 ? `+$${row.expectancy.toFixed(2)}` : `-$${Math.abs(row.expectancy).toFixed(2)}`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}