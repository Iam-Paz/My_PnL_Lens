import React, { useMemo } from 'react';
import { ClipboardList, Scale, ListChecks } from 'lucide-react';
import { calculateRuleAdherenceStats } from '../utils/tradeStats';

export default function RuleAdherence({ trades = [], playbooks = [] }) {
  // 1. Calculate side-by-side performance stats
  const stats = useMemo(() => {
    return calculateRuleAdherenceStats(trades, playbooks);
  }, [trades, playbooks]);

  // 2. Calculate rule-by-rule execution rates
  const ruleBreakdown = useMemo(() => {
    const rulesMap = {};

    for (const pb of playbooks) {
      if (!pb.rules) continue;
      const cleanRules = pb.rules.filter((r) => r.trim() !== '');
      for (const rule of cleanRules) {
        // Unique key combining playbook and rule to avoid collisions if multiple playbooks have "Risk 1%"
        const key = `${pb.title} | ${rule}`;
        rulesMap[key] = {
          playbook: pb.title,
          rule: rule,
          totalOpportunites: 0,
          timesFollowed: 0,
        };
      }
    }

    // Pass through trades to check individual rules
    for (const t of trades) {
      if (!t.setup || t.setup === 'Untagged') continue;

      const pb = playbooks.find((p) => p.title === t.setup);
      if (!pb || !pb.rules) continue;

      const cleanRules = pb.rules.filter((r) => r.trim() !== '');
      const checked = Array.isArray(t.rulesChecked) ? t.rulesChecked : [];

      for (const rule of cleanRules) {
        const key = `${t.setup} | ${rule}`;
        if (rulesMap[key]) {
          rulesMap[key].totalOpportunites += 1;
          if (checked.includes(rule)) {
            rulesMap[key].timesFollowed += 1;
          }
        }
      }
    }

    return Object.values(rulesMap)
      .filter((r) => r.totalOpportunites > 0) // Only show rules that have actually been tested in live trades
      .map((r) => {
        const rate = (r.timesFollowed / r.totalOpportunites) * 100;
        return {
          ...r,
          rate: Number(rate.toFixed(1)),
        };
      })
      .sort((a, b) => a.rate - b.rate); // Sort from most violated/lowest rate to highest
  }, [trades, playbooks]);

  // If there are no trades, or no playbooks with rules, don't show the card
  const hasPlaybooksWithRules = playbooks.some((p) => p.rules && p.rules.filter(r => r.trim() !== '').length > 0);
  const totalTaggedTrades = trades.filter((t) => t.setup && t.setup !== 'Untagged').length;

  if (trades.length === 0 || !hasPlaybooksWithRules || totalTaggedTrades === 0) {
    return (
      <div className="ts-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#fff' }}>
          <ClipboardList size={18} style={{ verticalAlign: '-3px', marginRight: '6px' }} /> Playbook Rule Adherence
        </h3>
        <p style={{ margin: 0, fontSize: '13px' }}>
          Rule adherence tracking will appear here once you assign trades to a Playbook and record your checklist rules.
        </p>
      </div>
    );
  }

  const p = stats.perfect;
  const i = stats.imperfect;

  // Render helper for currency formatting
  const fmtVal = (val, isPnL = false) => {
    const formatted = val >= 0 ? `+$${val.toFixed(2)}` : `-$${Math.abs(val).toFixed(2)}`;
    if (!isPnL) return val.toFixed(2);
    return formatted;
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '24px' }}>

      {/* CARD 1: Side-by-Side Stats */}
      <div className="ts-card">
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scale size={18} /> Discipline Comparison
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Historical outcomes comparing disciplined execution vs rule violations.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table className="ts-table" style={{ fontSize: '13px' }}>
            <thead>
              <tr>
                <th>Metric</th>
                <th style={{ color: 'var(--color-win)' }}>Perfect Adherence</th>
                <th style={{ color: 'var(--color-loss)' }}>Imperfect Adherence</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Total Trades</td>
                <td className="number-font">{p.count}</td>
                <td className="number-font">{i.count}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Win Rate</td>
                <td className="number-font" style={{ color: '#38bdf8' }}>{p.count > 0 ? `${p.winRate}%` : '—'}</td>
                <td className="number-font" style={{ color: '#38bdf8' }}>{i.count > 0 ? `${i.winRate}%` : '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Net P&L</td>
                <td className="number-font" style={{ fontWeight: 700, color: p.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  {p.count > 0 ? fmtVal(p.netPnL, true) : '—'}
                </td>
                <td className="number-font" style={{ fontWeight: 700, color: i.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  {i.count > 0 ? fmtVal(i.netPnL, true) : '—'}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Avg Win</td>
                <td className="number-font" style={{ color: 'var(--color-win)' }}>{p.wins > 0 ? `+$${p.avgWin.toFixed(2)}` : '—'}</td>
                <td className="number-font" style={{ color: 'var(--color-win)' }}>{i.wins > 0 ? `+$${i.avgWin.toFixed(2)}` : '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Avg Loss</td>
                <td className="number-font" style={{ color: 'var(--color-loss)' }}>{p.losses > 0 ? `-$${p.avgLoss.toFixed(2)}` : '—'}</td>
                <td className="number-font" style={{ color: 'var(--color-loss)' }}>{i.losses > 0 ? `-$${i.avgLoss.toFixed(2)}` : '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Avg R-Multiple</td>
                <td className="number-font" style={{ color: p.avgR >= 0 ? '#38bdf8' : 'var(--color-loss)' }}>
                  {p.countWithR > 0 ? `${p.avgR > 0 ? '+' : ''}${p.avgR}R` : '—'}
                </td>
                <td className="number-font" style={{ color: i.avgR >= 0 ? '#38bdf8' : 'var(--color-loss)' }}>
                  {i.countWithR > 0 ? `${i.avgR > 0 ? '+' : ''}${i.avgR}R` : '—'}
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Profit Factor</td>
                <td className="number-font">{p.count > 0 ? p.profitFactor : '—'}</td>
                <td className="number-font">{i.count > 0 ? i.profitFactor : '—'}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Expectancy</td>
                <td className="number-font" style={{ fontWeight: 700, color: p.expectancy >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  {p.count > 0 ? fmtVal(p.expectancy, true) : '—'}
                </td>
                <td className="number-font" style={{ fontWeight: 700, color: i.expectancy >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                  {i.count > 0 ? fmtVal(i.expectancy, true) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CARD 2: Rule-by-Rule Compliance Tracker */}
      <div className="ts-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ListChecks size={18} /> Checklist Rule Compliance
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
          Tracking execution rates per rule (sorted from most skipped/broken to most followed).
        </p>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '310px' }}>
          {ruleBreakdown.length === 0 ? (
            <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: '13px' }}>
              No rules have been tested in trades yet. Check rules off in your journal!
            </div>
          ) : (
            ruleBreakdown.map((item) => {
              const barColor = item.rate >= 80
                ? 'var(--color-win)'
                : item.rate >= 50
                ? '#facc15'
                : 'var(--color-loss)';

              return (
                <div key={`${item.playbook}-${item.rule}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px', gap: '8px' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase' }}>
                      [{item.playbook}]
                    </span>
                    <span style={{ fontWeight: 700, color: barColor }} className="number-font">
                      {item.rate}% ({item.timesFollowed}/{item.totalOpportunites})
                    </span>
                  </div>
                  <div style={{ color: '#fff', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>
                    {item.rule}
                  </div>
                  {/* Progress Bar Container */}
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${item.rate}%`, height: '100%', backgroundColor: barColor, transition: 'width 0.3s' }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}