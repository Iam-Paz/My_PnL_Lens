import { useMemo, useState } from 'react';
import { calculateExcursionStats, calculateExcursionGroups } from '../utils/excursionStats.js';

const valueR = (value) => value === null ? 'Not available' : `${value.toFixed(2)}R`;
const percentage = (value) => value === null ? 'Not available' : `${value.toFixed(1)}%`;
const sample = (count) => `n = ${count}${count > 0 && count < 5 ? ' / small sample' : ''}`;

function Metric({ label, value, note }) {
  return (
    <div style={{ padding:'14px', border:'1px solid var(--border-color)', borderRadius:'8px', background:'var(--bg-main)' }}>
      <div style={{ fontSize:'12px', color:'var(--text-secondary)' }}>{label}</div>
      <div className="number-font" style={{ fontSize:'22px', fontWeight:700, margin:'8px 0', color:'var(--text-bright)' }}>{value}</div>
      <div style={{ fontSize:'12px', color:'var(--text-secondary)' }}>{note}</div>
    </div>
  );
}

function Breakdown({ rows, dimension }) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table className="ts-table">
        <caption style={{ textAlign:'left', padding:'8px 0', color:'var(--text-secondary)' }}>
          Execution by {dimension}. Sorted by closed-trade count, not a ranking of strategy quality.
        </caption>
        <thead>
          <tr><th>{dimension === 'setup' ? 'Setup / Playbook' : 'Symbol'}</th><th>Coverage</th><th>Avg MFE</th><th>Avg realised R</th><th>Avg winner capture</th><th>Avg winner MAE</th><th>Winner to loss</th><th>Winner to BE</th><th>BE exit - net loss</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={9}>No closed trades in this scope.</td></tr> : rows.map((row) => {
            const rate = (count) => row.favourableCount > 0 ? count / row.favourableCount * 100 : null;
            const detail = { fontSize:'11px', color:'var(--text-secondary)', marginTop:'4px' };
            return (
              <tr key={row.label}>
                <td style={{ fontWeight:700 }}>{row.label}</td>
                <td>
                  <div>{row.validCount} usable / {row.closedCount} closed</div>
                  <div style={detail}>{row.invalidCount} excluded</div>
                  <div style={detail}>Missing MFE: {row.missingMfeCount}; MAE: {row.missingMaeCount}; positive risk: {row.missingRiskCount}</div>
                </td>
                <td className="number-font">{valueR(row.avgPairedMfeR)}<div style={detail}>{sample(row.pairedCount)}</div></td>
                <td className="number-font">{valueR(row.avgPairedRealisedR)}<div style={detail}>{sample(row.pairedCount)} / matched</div></td>
                <td className="number-font">{percentage(row.avgCapture)}<div style={detail}>{sample(row.captureCount)}</div></td>
                <td className="number-font">{valueR(row.avgWinnerMaeR)}<div style={detail}>{sample(row.winnerMaeCount)}</div></td>
                <td className="number-font">{percentage(rate(row.winnerTurnedLoserCount))}<div style={detail}>{row.winnerTurnedLoserCount} of {row.favourableCount}; {sample(row.favourableCount)}</div></td>
                <td className="number-font">{percentage(rate(row.winnerToBeCount))}<div style={detail}>{row.winnerToBeCount} of {row.favourableCount}; {sample(row.favourableCount)}</div></td>
                <td className="number-font">{percentage(rate(row.favourableBeNetLossCount))}<div style={detail}>{row.favourableBeNetLossCount} of {row.favourableCount}; {sample(row.favourableCount)}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function ExcursionAnalysis({ trades = [] }) {
  const [dimension, setDimension] = useState('setup');
  const groups = useMemo(() => calculateExcursionGroups(trades), [trades]);
  const stats = useMemo(() => calculateExcursionStats(trades), [trades]);
  const rate = (count) => stats.favourableCount > 0 ? count / stats.favourableCount * 100 : null;
  return (
    <section className="ts-card" style={{ marginBottom:'28px' }} aria-labelledby="excursion-review-title">
      <h2 id="excursion-review-title" style={{ margin:'0 0 8px', fontSize:'18px' }}>Execution Review: MFE / MAE</h2>
      <p style={{ fontSize:'13px', color:'var(--text-secondary)' }}>
        Follows the Analytics period and global filters. Closed trades only. R uses original risk and the same net-of-costs basis as the Journal.
      </p>
      <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
        {stats.closedCount} closed in scope / {stats.validCount} usable / {stats.invalidCount} excluded for invalid excursion data, missing result or non-finite realised R.
        {' '}{stats.ignoredOpenCount} open ignored.
      </p>
      {stats.closedCount === 0 ? (
        <p>No closed trades in this scope. Log a closed trade or adjust the filters.</p>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:'12px', margin:'16px 0' }}>
            <Metric label="Average MFE (matched trades)" value={valueR(stats.avgPairedMfeR)} note={`${sample(stats.pairedCount)} / needs MFE and positive risk`} />
            <Metric label="Average realised R (same trades)" value={valueR(stats.avgPairedRealisedR)} note={`${sample(stats.pairedCount)} / same sample as average MFE`} />
            <Metric label="Average capture (eligible winners)" value={percentage(stats.avgCapture)} note={`${sample(stats.captureCount)} / mean of per-trade capture, not ratio of totals`} />
            <Metric label="Average MAE of winners" value={valueR(stats.avgWinnerMaeR)} note={`${sample(stats.winnerMaeCount)} / positive net result and recorded MAE`} />
          </div>
          <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
            Among usable trades: {stats.missingMfeCount} missing MFE / {stats.missingMaeCount} missing MAE / {stats.missingRiskCount} without positive original risk. These groups can overlap. Recorded zero is included; missing data is not replaced with zero.
          </p>
          {stats.validCount > 0 && stats.missingMfeCount === stats.validCount && stats.missingMaeCount === stats.validCount && (
            <p>Add Max R reached and Max adverse R in Journal to unlock excursion insights. Basic outcomes below can still be shown.</p>
          )}
          <h3 style={{ fontSize:'15px', marginTop:'22px' }}>What happened after a favourable move?</h3>
          <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
            Denominator: {stats.favourableCount} usable trades with recorded MFE greater than zero. This is not a percentage of all trades.
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:'12px', marginBottom:'20px' }}>
            <Metric label="Winner Turned Loser" value={percentage(rate(stats.winnerTurnedLoserCount))} note={`${stats.winnerTurnedLoserCount} of ${stats.favourableCount} / ${sample(stats.favourableCount)}`} />
            <Metric label="Winner to Breakeven" value={percentage(rate(stats.winnerToBeCount))} note={`${stats.winnerToBeCount} of ${stats.favourableCount} / ${sample(stats.favourableCount)}`} />
            <Metric label="Breakeven exit - net loss" value={percentage(rate(stats.favourableBeNetLossCount))} note={`${stats.favourableBeNetLossCount} of ${stats.favourableCount} / Exit Type explicitly marked Breakeven`} />
          </div>
          <h3 style={{ fontSize:'15px' }}>Where do execution patterns differ?</h3>
          <div role="group" aria-label="Execution breakdown grouping" style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'12px' }}>
            <button type="button" className="ts-btn" aria-pressed={dimension === 'setup'} onClick={() => setDimension('setup')}>By setup</button>
            <button type="button" className="ts-btn" aria-pressed={dimension === 'symbol'} onClick={() => setDimension('symbol')}>By symbol</button>
          </div>
          <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
            Each row uses only that group's filtered closed trades. MFE and realised R share a matched sample. Capture uses eligible winners; MAE uses winners with recorded MAE. Reversal percentages use trades with positive recorded MFE. Missing counts apply to usable trades and may overlap. Each metric shows its own sample; fewer than five is flagged, not a statistical confidence test.
          </p>
          <Breakdown rows={dimension === 'setup' ? groups.setups : groups.symbols} dimension={dimension} />
          <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
            Untagged setups and UNKNOWN symbols remain visible. Symbol case and outer whitespace are combined; broker suffixes are kept separate. These are descriptive comparisons, not automatic recommendations to change exits, stops or risk.
          </p>
          <h3 style={{ fontSize:'15px' }}>Outcome breakdown</h3>
          <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>Percentages below use all {stats.validCount} usable closed trades, including those with basic outcomes because MFE is unknown.</p>
          <div style={{ overflowX:'auto' }}>
            <table className="ts-table">
              <thead><tr><th>Outcome</th><th>Trades</th><th>Share of usable closed trades</th></tr></thead>
              <tbody>
                {stats.outcomes.length === 0 ? (
                  <tr><td colSpan={3}>No usable results. Check excursion values and closing P&amp;L in Journal.</td></tr>
                ) : stats.outcomes.map((row) => (
                  <tr key={row.outcome}><td>{row.outcome}</td><td className="number-font">{row.count}</td><td className="number-font">{row.percent.toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <p style={{ fontSize:'12px', color:'var(--text-secondary)', marginBottom:0 }}>
        Review prompts, not trading verdicts: low capture is not proof of a bad exit, and observed MAE is not a stop-loss recommendation. Small samples and incomplete journaling can distort patterns. No excursion data is inferred from price history or closing P&amp;L.
      </p>
    </section>
  );
}