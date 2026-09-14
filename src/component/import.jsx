export default function Imports({ activityLog = [], clearActivityLog }) {
  const imports = activityLog.filter(a => a.type === 'import');
  const exports = activityLog.filter(a => a.type === 'export');
  const totalTradesImported = imports.reduce((s, a) => s + (a.tradeCount || 0), 0);

  return (
    <div>
      <div className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>📦 Imports & Exports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>Complete history of all CSV imports and exports across all accounts.</p>
        </div>
        {activityLog.length > 0 && <button onClick={clearActivityLog} className="ts-btn ts-btn-danger">🗑️ Clear History</button>}
      </div>

      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <Stat label="Total Actions" value={activityLog.length} color="#fff" />
        <Stat label="Imports" value={imports.length} color="var(--accent-blue)" />
        <Stat label="Exports" value={exports.length} color="#a78bfa" />
        <Stat label="Trades Imported" value={totalTradesImported} color="var(--color-win)" />
      </div>

      <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '12px' }}>Activity Log</h3>

      <div className="ts-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ts-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th>Account</th>
                <th>Filename</th>
                <th className="num">Trades</th>
              </tr>
            </thead>
            <tbody>
              {activityLog.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No imports or exports yet. Import a CSV in the Journal page to start tracking.
                </td></tr>
              ) : activityLog.map(entry => {
                const dt = new Date(entry.timestamp);
                return (
                  <tr key={entry.id}>
                    <td className="number-font" style={{ color: 'var(--text-secondary)' }}>
                      {dt.toLocaleDateString()} <span style={{ color: 'var(--text-muted)' }}>{dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td>
                      <span style={{
                        padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                        backgroundColor: entry.type === 'import' ? 'rgba(41, 98, 255, 0.15)' : 'rgba(167, 139, 250, 0.15)',
                        color: entry.type === 'import' ? '#60a5fa' : '#c4b5fd',
                        border: `1px solid ${entry.type === 'import' ? 'rgba(96, 165, 250, 0.3)' : 'rgba(196, 181, 253, 0.3)'}`
                      }}>
                        {entry.type === 'import' ? '📥 IMPORT' : '📤 EXPORT'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#fff' }}>{entry.accountName}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{entry.filename}</td>
                    <td className="num number-font" style={{ fontWeight: 700, color: 'var(--accent-blue)' }}>{entry.tradeCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div className="ts-card" style={{ padding: '14px 16px' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 6px 0' }}>{label}</p>
      <h2 className="number-font" style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: color || '#fff' }}>{value}</h2>
    </div>
  );
}