import { useState, useMemo } from 'react';
import { calculateTradeStats } from '../utils/tradeStats';

export default function Playbooks({ trades = [], setTrades, playbooks = [], setPlaybooks }) {
  const [sortField, setSortField] = useState('netPnL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [title, setTitle] = useState('');
  const [timeframe, setTimeframe] = useState('15m');
  const [riskPercent, setRiskPercent] = useState('1%');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState(['']);

  const handleDeletePlaybook = (id, pbTitle) => {
    if (!confirm(`Delete "${pbTitle}"? Trades tagged with it will become Untagged.`)) return;
    setPlaybooks(playbooks.filter((p) => p.id !== id));
    if (setTrades) {
      setTrades(trades.map((t) => (t.setup === pbTitle ? { ...t, setup: 'Untagged' } : t)));
    }
  };

  const handleCreatePlaybook = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const nb = {
      id: 'pb-' + Date.now(),
      title: title.trim(),
      timeframe: timeframe || '15m',
      riskPercent: riskPercent || '1%',
      description: description.trim(),
      rules: rules.filter((r) => r.trim() !== ''),
    };
    setPlaybooks([...playbooks, nb]);
    setIsCreateOpen(false);
    setTitle('');
    setTimeframe('15m');
    setRiskPercent('1%');
    setDescription('');
    setRules(['']);
  };

  const handleOpenEdit = (pb) => {
    setEditing({ ...pb, rules: [...(pb.rules || [])], _original: pb.title });
    setIsEditOpen(true);
  };

  const handleUpdatePlaybook = (e) => {
    e.preventDefault();
    if (!editing || !editing.title.trim()) return;
    const newTitle = editing.title.trim();
    const orig = editing._original;
    const updated = {
      id: editing.id,
      title: newTitle,
      timeframe: editing.timeframe,
      riskPercent: editing.riskPercent,
      description: editing.description,
      rules: (editing.rules || []).filter((r) => r.trim() !== ''),
    };
    setPlaybooks(playbooks.map((p) => (p.id === updated.id ? updated : p)));
    if (orig !== newTitle && setTrades) {
      setTrades(trades.map((t) => (t.setup === orig ? { ...t, setup: newTitle } : t)));
    }
    setIsEditOpen(false);
    setEditing(null);
  };

  const handleRuleChange = (i, v) => {
    const u = [...rules];
    u[i] = v;
    setRules(u);
  };

  const handleEditRuleChange = (i, v) => {
    const u = [...(editing.rules || [])];
    u[i] = v;
    setEditing({ ...editing, rules: u });
  };

  // Group trades by playbook and calculate stats deterministically
  const edgeData = useMemo(() => {
    const groups = {};
    for (const pb of playbooks) groups[pb.title] = [];
    groups['Untagged'] = groups['Untagged'] || [];

    for (const t of trades) {
      const s = t.setup || 'Untagged';
      if (!groups[s]) groups[s] = [];
      groups[s].push(t);
    }

    return Object.entries(groups)
      .map(([pbTitle, tList]) => {
        const stats = calculateTradeStats(tList);
        return {
          title: pbTitle,
          ...stats,
          isLowSample: stats.count > 0 && stats.count < 5,
        };
      })
      .sort((a, b) => {
        if (sortField === 'netPnL') return b.netPnL - a.netPnL;
        if (sortField === 'expectancy') return b.expectancy - a.expectancy;
        if (sortField === 'winRate') return b.winRate - a.winRate;
        if (sortField === 'avgR') return b.avgR - a.avgR;
        if (sortField === 'profitFactor') {
          const pfA = a.profitFactor === '∞' ? 9999 : Number(a.profitFactor) || 0;
          const pfB = b.profitFactor === '∞' ? 9999 : Number(b.profitFactor) || 0;
          return pfB - pfA;
        }
        if (sortField === 'count') return b.count - a.count;
        return 0;
      });
  }, [trades, playbooks, sortField]);

  return (
    <div>
      {/* Header Bar */}
      <div
        className="header-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>📚 Playbooks & Edge Analysis</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Manage strategies and evaluate historical performance by setup.
          </p>
        </div>
        <button onClick={() => setIsCreateOpen(true)} className="ts-btn ts-btn-primary">
          + Add New Strategy
        </button>
      </div>

      {/* Section Title & Sort Controls */}
      <div
        className="section-title-row"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <h3
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          🎯 Strategy Edge Comparison
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>Sort By:</span>
          <select
            className="ts-input"
            value={sortField}
            onChange={(e) => setSortField(e.target.value)}
            style={{ width: 'auto', padding: '4px 8px' }}
          >
            <option value="netPnL">Net P&L</option>
            <option value="expectancy">Expectancy ($)</option>
            <option value="winRate">Win Rate %</option>
            <option value="avgR">Avg R</option>
            <option value="profitFactor">Profit Factor</option>
            <option value="count">Most Traded</option>
          </select>
        </div>
      </div>

      {/* Strategy Comparison Table */}
      <div className="ts-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '32px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ts-table">
            <thead>
              <tr>
                <th>Strategy</th>
                <th>Trades</th>
                <th>Win Rate</th>
                <th>Net P&L</th>
                <th>Avg Win</th>
                <th>Avg Loss</th>
                <th>Avg R</th>
                <th>PF</th>
                <th>Expectancy</th>
                <th>Best Trade</th>
                <th>Worst Trade</th>
              </tr>
            </thead>
            <tbody>
              {edgeData.map((row) => (
                <tr key={row.title}>
                  <td style={{ fontWeight: 700, color: '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{row.title}</span>
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
                  <td className="number-font" style={{ color: 'var(--color-win)' }}>
                    {row.bestTradePnl > 0 ? `+$${row.bestTradePnl.toFixed(2)}` : '—'}
                  </td>
                  <td className="number-font" style={{ color: 'var(--color-loss)' }}>
                    {row.worstTradePnl < 0 ? `-$${Math.abs(row.worstTradePnl).toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Frameworks List */}
      <h3
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          marginBottom: '12px',
        }}
      >
        📖 Active Frameworks ({playbooks.length})
      </h3>

      <div
        className="playbook-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '16px',
        }}
      >
        {playbooks.map((pb) => (
          <div key={pb.id} className="ts-card" style={{ position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '8px',
                paddingRight: '64px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>{pb.title}</h3>
              <span className="badge-buy">TF: {pb.timeframe}</span>
            </div>
            <div style={{ position: 'absolute', top: '14px', right: '12px', display: 'flex', gap: '4px' }}>
              <button onClick={() => handleOpenEdit(pb)} style={iconBtn} title="Edit playbook">
                ✏️
              </button>
              <button onClick={() => handleDeletePlaybook(pb.id, pb.title)} style={iconBtn} title="Delete playbook">
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 12px 0' }}>
              {pb.description}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <span style={miniBadge}>🛡️ Risk: {pb.riskPercent}</span>
            </div>
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700 }}>RULES:</span>
              <ul
                style={{
                  margin: '6px 0 0 18px',
                  padding: 0,
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                }}
              >
                {(pb.rules || []).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create Playbook */}
      {isCreateOpen && (
        <Modal title="➕ Create Strategy Playbook" onClose={() => setIsCreateOpen(false)}>
          <form onSubmit={handleCreatePlaybook}>
            <label style={labelStyle}>Strategy Title</label>
            <input
              type="text"
              className="ts-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fair Value Gap"
              required
            />
            <div
              className="modal-mobile-grid"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}
            >
              <div>
                <label style={labelStyle}>Timeframe</label>
                <input
                  type="text"
                  className="ts-input"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                />
              </div>
              <div>
                <label style={labelStyle}>Risk per Trade</label>
                <input
                  type="text"
                  className="ts-input"
                  value={riskPercent}
                  onChange={(e) => setRiskPercent(e.target.value)}
                />
              </div>
            </div>
            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                rows="2"
                className="ts-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Checklist Rules</label>
              {rules.map((rule, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="ts-input"
                    placeholder={`Rule ${idx + 1}...`}
                    value={rule}
                    onChange={(e) => handleRuleChange(idx, e.target.value)}
                  />
                  {rules.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                      className="ts-btn ts-btn-danger"
                      style={{ padding: '0 10px' }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRules([...rules, ''])}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-blue)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                + Add rule
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button type="button" onClick={() => setIsCreateOpen(false)} className="ts-btn ts-btn-ghost">
                Cancel
              </button>
              <button type="submit" className="ts-btn ts-btn-success">
                Save Playbook
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Edit Playbook */}
      {isEditOpen && editing && (
        <Modal
          title="✏️ Edit Strategy Playbook"
          onClose={() => {
            setIsEditOpen(false);
            setEditing(null);
          }}
        >
          <form onSubmit={handleUpdatePlaybook}>
            <label style={labelStyle}>Strategy Title (renaming updates tagged trades)</label>
            <input
              type="text"
              className="ts-input"
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              required
            />
            <div
              className="modal-mobile-grid"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}
            >
              <div>
                <label style={labelStyle}>Timeframe</label>
                <input
                  type="text"
                  className="ts-input"
                  value={editing.timeframe}
                  onChange={(e) => setEditing({ ...editing, timeframe: e.target.value })}
                />
              </div>
              <div>
                <label style={labelStyle}>Risk per Trade</label>
                <input
                  type="text"
                  className="ts-input"
                  value={editing.riskPercent}
                  onChange={(e) => setEditing({ ...editing, riskPercent: e.target.value })}
                />
              </div>
            </div>
            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                rows="2"
                className="ts-input"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>
            <div style={{ marginTop: '12px' }}>
              <label style={labelStyle}>Checklist Rules</label>
              {(editing.rules || []).map((rule, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="ts-input"
                    value={rule}
                    onChange={(e) => handleEditRuleChange(idx, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({ ...editing, rules: editing.rules.filter((_, i) => i !== idx) })
                    }
                    className="ts-btn ts-btn-danger"
                    style={{ padding: '0 10px' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setEditing({ ...editing, rules: [...(editing.rules || []), ''] })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-blue)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
              >
                + Add rule
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditing(null);
                }}
                className="ts-btn ts-btn-ghost"
              >
                Cancel
              </button>
              <button type="submit" className="ts-btn ts-btn-success">
                💾 Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <div
        className="ts-card modal-mobile"
        style={{
          width: '500px',
          maxWidth: '94%',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>{title}</h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' };
const iconBtn = {
  background: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
  padding: '4px 8px',
};
const miniBadge = {
  backgroundColor: '#0d47a1',
  color: '#d1d4dc',
  fontSize: '11px',
  padding: '3px 8px',
  borderRadius: '4px',
};