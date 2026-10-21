import { useEffect } from 'react';
import { X } from 'lucide-react';
import { filterTradesGlobal, sanitizeGlobalFilter } from '../utils/dateUtils';

const DIRECTIONS = [['buy', 'BUY'], ['sell', 'SELL']];
const OUTCOMES = [['win', 'Wins'], ['loss', 'Losses']];

// Options include current trades, current playbooks (for setups), and picked
// values. Keep old picks visible so they can be cleared after a rename/delete.
function unionOptions(fromTrades, picked) {
  return [...new Set([...(picked || []), ...fromTrades])].sort((a, b) =>
    String(a).localeCompare(String(b))
  );
}

export default function FilterSheet({ trades = [], playbooks = [], value = null, onChange, onClose }) {
  const gf = sanitizeGlobalFilter(value);
  const list = Array.isArray(trades) ? trades : [];
  const books = Array.isArray(playbooks) ? playbooks : [];

  const symbolOptions = unionOptions(
    [...new Set(list.map((t) => String(t?.symbol || '').trim()).filter(Boolean))],
    gf.symbols
  );
  const setupOptions = unionOptions(
    [
      ...list.map((t) => String(t?.setup || 'Untagged')),
      ...books.map((p) => typeof p?.title === 'string' ? p.title.trim() : '').filter(Boolean),
    ],
    gf.setups
  );

  const shown = filterTradesGlobal(list, gf).length;
  const activeCount = gf.symbols.length + gf.setups.length + gf.directions.length + gf.outcomes.length;

  // Escape closes; background scroll locks while open (same as other modals).
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const toggle = (key, val) => {
    if (!onChange) return;
    const cur = gf[key] || [];
    onChange({ ...gf, [key]: cur.includes(val) ? cur.filter((v) => v !== val) : [...cur, val] });
  };
  const clearAll = () => {
    if (onChange) onChange({ symbols: [], setups: [], directions: [], outcomes: [] });
  };
  const close = () => { if (onClose) onClose(); };

  return (
    <div style={overlayStyle} onClick={close}>
      <div className="ts-card modal-mobile" onClick={(e) => e.stopPropagation()} style={{ margin: 'auto', width: '560px', maxWidth: '94%', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Filters{activeCount > 0 ? ` (${activeCount})` : ''}</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>One filter shared by Dashboard, Analytics & Journal.</p>
          </div>
          <button onClick={close} aria-label="Close filters" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
        </div>

        <div style={{ marginTop: '16px' }}>
          <span style={labelStyle}>Symbols</span>
          {symbolOptions.length === 0 ? (
            <p style={emptyStyle}>No symbols in these trades yet.</p>
          ) : (
            <div style={chipRowStyle}>
              {symbolOptions.map((s) => (
                <Chip key={s} label={s} active={gf.symbols.includes(s)} onClick={() => toggle('symbols', s)} />
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px' }}>
          <span style={labelStyle}>Setups</span>
          {setupOptions.length === 0 ? (
            <p style={emptyStyle}>No playbooks or trade setups yet.</p>
          ) : (
            <div style={chipRowStyle}>
              {setupOptions.map((s) => (
                <Chip key={s} label={s} active={gf.setups.includes(s)} onClick={() => toggle('setups', s)} />
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: '16px' }}>
          <span style={labelStyle}>Direction</span>
          <div style={chipRowStyle}>
            {DIRECTIONS.map(([v, label]) => (
              <Chip key={v} label={label} active={gf.directions.includes(v)} onClick={() => toggle('directions', v)} />
            ))}
          </div>
        </div>

        <div style={{ marginTop: '16px' }}>
          <span style={labelStyle}>Outcome</span>
          <div style={chipRowStyle}>
            {OUTCOMES.map(([v, label]) => (
              <Chip key={v} label={label} active={gf.outcomes.includes(v)} onClick={() => toggle('outcomes', v)} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
          <button onClick={clearAll} disabled={activeCount === 0} className="ts-btn ts-btn-ghost" style={activeCount === 0 ? { opacity: 0.4, cursor: 'default' } : undefined}>
            Clear all
          </button>
          <span style={{ fontSize: '12px', color: shown === 0 ? 'var(--color-loss)' : 'var(--text-secondary)' }}>
            {shown === 0 ? 'No trades match — loosen filters or clear all' : `Showing ${shown} of ${list.length} trades`}
          </span>
          <button onClick={close} className="ts-btn ts-btn-primary">Done</button>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: '14px',
        fontSize: '12px',
        fontWeight: 600,
        cursor: 'pointer',
        border: active ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
        backgroundColor: active ? 'var(--accent-blue)' : 'transparent',
        color: active ? '#fff' : 'var(--text-bright)',
      }}
    >
      {label}
    </button>
  );
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '8px' };
const chipRowStyle = { display: 'flex', flexWrap: 'wrap', gap: '8px' };
const emptyStyle = { fontSize: '12px', color: 'var(--text-muted)', margin: 0 };
const overlayStyle = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', overflowY: 'auto', padding: '24px 12px', zIndex: 2000 };