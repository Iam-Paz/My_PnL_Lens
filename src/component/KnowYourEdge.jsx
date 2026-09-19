import React, { useState, useMemo } from 'react';
import { Target } from 'lucide-react';
import { calculateEdgeMatrix } from '../utils/tradeStats';

const DIMENSION_FILTERS = [
  'All Dimensions',
  'Setup / Playbook',
  'Session',
  'Direction',
  'Day of Week',
  'Symbol',
  'Emotion / Mindset',
  'Rule Adherence',
];

export default function KnowYourEdge({
  trades = [],
  playbooks = [],
  brokerUtcOffset = 2,
  currency = '$',
}) {
  const [selectedDimension, setSelectedDimension] = useState('All Dimensions');
  const [minTrades, setMinTrades] = useState(3);
  const [sortField, setSortField] = useState('expectancy');

  const matrixData = useMemo(() => {
    const raw = calculateEdgeMatrix(trades, playbooks, brokerUtcOffset);

    return raw
      .filter((row) => {
        if (selectedDimension !== 'All Dimensions' && row.dimension !== selectedDimension) {
          return false;
        }
        return row.count >= minTrades;
      })
      .sort((a, b) => {
        if (sortField === 'expectancy') return b.expectancy - a.expectancy;
        if (sortField === 'netPnL') return b.netPnL - a.netPnL;
        if (sortField === 'winRate') return b.winRate - a.winRate;
        if (sortField === 'avgR') return b.avgR - a.avgR;
        if (sortField === 'count') return b.count - a.count;
        if (sortField === 'profitFactor') {
          const pfA = a.profitFactor === '∞' ? 9999 : Number(a.profitFactor) || 0;
          const pfB = b.profitFactor === '∞' ? 9999 : Number(b.profitFactor) || 0;
          return pfB - pfA;
        }
        return 0;
      });
  }, [trades, playbooks, brokerUtcOffset, selectedDimension, minTrades, sortField]);

  if (trades.length === 0) return null;

  return (
    <div className="ts-card" style={{ marginBottom: '28px' }}>
      {/* Title & Explanatory Subheader */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={20} /> Know Your Edge Matrix
        </h3>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
          Historical statistical breakdown across setups, sessions, directions, days, and behaviors.
        </p>
      </div>

      {/* Interactive Controls Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 14px',
          backgroundColor: 'var(--bg-main)',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
      >
        {/* Dimension Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Dimension:</span>
          <select
            className="ts-input"
            value={selectedDimension}
            onChange={(e) => setSelectedDimension(e.target.value)}
            style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
          >
            {DIMENSION_FILTERS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Minimum Sample Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Min Trades (Sample Context):</span>
          <select
            className="ts-input"
            value={minTrades}
            onChange={(e) => setMinTrades(Number(e.target.value))}
            style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
          >
            <option value={1}>≥ 1 trade (Show All)</option>
            <option value={3}>≥ 3 trades (Filter noise)</option>
            <option value={5}>≥ 5 trades (Recommended)</option>
            <option value={10}>≥ 10 trades (High confidence)</option>
          </select>
        </div>

        {/* Sort Metric */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Rank By:</span>
          <select
            className="ts-input"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
          >
            <option value="expectancy">Expectancy / Trade</option>
            <option value="netPnL">Net P&L</option>
            <option value="winRate">Win Rate %</option>
            <option value="avgR">Avg R-Multiple</option>
            <option value="profitFactor">Profit Factor</option>
            <option value="count">Sample Size (Count)</option>
          </select>
        </div>
      </div>

      {/* Edge Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="ts-table" style={{ fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Dimension</th>
              <th>Condition / Parameter</th>
              <th>Trades (n)</th>
              <th>Win Rate</th>
              <th>Net P&L</th>
              <th>Avg R</th>
              <th>PF</th>
              <th>Expectancy / Trade</th>
            </tr>
          </thead>
          <tbody>
            {matrixData.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No conditions met the minimum sample size threshold (≥ {minTrades} trades). Lower the filter to view smaller samples.
                </td>
              </tr>
            ) : (
              matrixData.map((row, idx) => (
                <tr key={`${row.dimension}-${row.condition}-${idx}`}>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{row.dimension}</td>
                  <td style={{ fontWeight: 700, color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{row.condition}</span>
                      {row.isLowSample && (
                        <span
                          title="Sample size < 5 trades. Treat with caution."
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
                    {row.winRate}%
                  </td>
                  <td
                    className="number-font"
                    style={{
                      fontWeight: 700,
                      color: row.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)',
                    }}
                  >
                    {row.netPnL >= 0 ? `+${currency}${row.netPnL.toFixed(2)}` : `-${currency}${Math.abs(row.netPnL).toFixed(2)}`}
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
                    {row.expectancy >= 0 ? `+${currency}${row.expectancy.toFixed(2)}` : `-${currency}${Math.abs(row.expectancy).toFixed(2)}`}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '14px 0 0 0' }}>
        * Rankings reflect recorded historical sample data. Edge is statistical probability based on your past execution, not a future guarantee.
      </p>
    </div>
  );
}