import { useState } from 'react';
import {
  buildContextAnalysis,
  CONTEXT_ANALYSIS_GROUPS,
  SMALL_SAMPLE_THRESHOLD,
} from '../utils/contextAnalysis.js';

export default function ContextAnalysis({
  trades = [],
  currency = 'USD',
}) {
  const [group, setGroup] = useState('entryExecution');
  const summary = buildContextAnalysis(trades, group);

  const symbol = (
    { USD: '$', EUR: '€', GBP: '£', NGN: '₦' }
  )[currency] || currency;

  const money = (value) => value === null
    ? '—'
    : `${value < 0 ? '-' : ''}${symbol}${Math.abs(value).toFixed(2)}`;

  return (
    <section
      className="ts-card"
      style={{ marginTop: '20px', minWidth: 0 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '18px' }}>
          Context &amp; Psychology
        </h2>

        <label style={{ fontSize: '13px' }}>
          Compare by
          <select
            className="ts-input"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
            style={{ marginTop: '4px' }}
          >
            {CONTEXT_ANALYSIS_GROUPS.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <p style={hintStyle}>
        Closed trades in this account, using the Analytics period and global
        filters. Descriptive comparisons only—not proof that a tag caused
        a result.
      </p>

      <p aria-live="polite" style={{ fontSize: '13px' }}>
        Recorded on{' '}
        <strong>{summary.recorded} of {summary.total}</strong> trades
        {summary.coverage === null
          ? ''
          : ` (${summary.coverage.toFixed(1)}%)`}.
        {' '}Unrecorded: <strong>{summary.unrecorded}</strong>.
      </p>

      {summary.overlapping && (
        <p style={hintStyle}>
          Multi-select groups overlap: one trade may appear in several rows.
          Do not add row counts or P&amp;L together. Coverage counts each
          trade once.
        </p>
      )}

      {group === 'mistakes' && (
        <p style={hintStyle}>
          “No mistake identified” is an explicit selection. Unrecorded does
          not mean mistake-free. These figures do not estimate the cost of
          a mistake.
        </p>
      )}

      {group === 'emotions' && (
        <p style={hintStyle}>
          Emotions describe your recorded state, not a diagnosis or a rule
          violation. Missing emotions are not treated as calm.
        </p>
      )}

      {summary.total === 0 ? (
        <p>No closed trades in this selection.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="ts-table">
            <caption
              style={{
                textAlign: 'left',
                padding: '8px 0',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              Only choices with trades are shown. “Unrecorded” is shown
              separately when present.
            </caption>

            <thead>
              <tr>
                <th>Choice</th>
                <th className="num">Trades</th>
                <th className="num">Net P&amp;L</th>
                <th className="num">Win rate</th>
                <th className="num">Average net R</th>
                <th>Sample caution</th>
              </tr>
            </thead>

            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row" style={{ textAlign: 'left' }}>
                    {row.label}
                  </th>

                  <td className="num">{row.tradeCount}</td>

                  <td className="num">
                    {money(row.netPnl)}
                    <small style={detailStyle}>
                      {row.pnlCount}/{row.tradeCount} valid P&amp;L
                      {row.invalidPnlCount
                        ? `; ${row.invalidPnlCount} missing/invalid`
                        : ''}
                    </small>
                  </td>

                  <td className="num">
                    {row.winRate === null
                      ? '—'
                      : `${row.winRate.toFixed(1)}%`}
                    <small style={detailStyle}>
                      {row.wins}W / {row.losses}L / {row.breakevens}BE
                    </small>
                  </td>

                  <td className="num">
                    {row.averageNetR === null
                      ? '—'
                      : `${row.averageNetR.toFixed(2)}R`}
                    <small style={detailStyle}>
                      {row.rCount}/{row.tradeCount} R-eligible
                    </small>
                  </td>

                  <td style={{ fontSize: '12px' }}>
                    {row.smallSample
                      ? `Fewer than ${SMALL_SAMPLE_THRESHOLD} trades. `
                      : ''}

                    {row.pnlCount < SMALL_SAMPLE_THRESHOLD
                      ? `Fewer than ${SMALL_SAMPLE_THRESHOLD} valid P&L results. `
                      : ''}

                    {row.smallRSample
                      ? `Fewer than ${SMALL_SAMPLE_THRESHOLD} R-eligible trades.`
                      : ''}

                    {!row.smallSample &&
                      row.pnlCount >= SMALL_SAMPLE_THRESHOLD &&
                      !row.smallRSample
                      ? 'Still descriptive; no causal conclusion.'
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={hintStyle}>
        Win rate includes breakevens and uses valid Net P&amp;L results only.
        Average net R = the average of each eligible trade’s Net P&amp;L /
        positive original risk amount. Missing risk is not zero R. Missing
        P&amp;L is not breakeven. Dashes mean no eligible values.
      </p>

      <p style={{ ...hintStyle, marginBottom: 0 }}>
        The fewer-than-{SMALL_SAMPLE_THRESHOLD} caution is a review aid,
        not a statistical significance test. Larger samples can still be
        biased by setup, market, timing and which trades you chose to annotate.
      </p>
    </section>
  );
}

const hintStyle = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
};

const detailStyle = {
  ...hintStyle,
  display: 'block',
  marginTop: '4px',
  whiteSpace: 'nowrap',
};