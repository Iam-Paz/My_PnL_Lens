import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { parseTimestamp } from '../utils/tradeStats';

// Shared by the Dashboard + Analytics calendars: tap a trading day, see the day.
function getTradePnL(t) {
  return Number(t.pnl ?? t.profit) || 0;
}

function resultTimeMs(t) {
  return parseTimestamp(t.closeTime || t.closeAt || t.openTime || t.openAt || t.date) || 0;
}

function rowTime(t) {
  const raw = String(t.closeTime || t.closeAt || t.openTime || t.openAt || '');
  if (!/:\d{2}/.test(raw)) return '—'; // dateless/manual trades carry no clock time
  const ms = parseTimestamp(raw);
  if (!ms) return '—';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function directionOf(t) {
  const raw = String(t.direction || t.type || '').toLowerCase();
  return raw.includes('sell') || raw === 'short' ? 'SHORT' : 'LONG';
}

function dayLabel(dateKey) {
  const [y, m, d] = String(dateKey || '').split('-').map(Number);
  if (!y || !m || !d) return String(dateKey || '');
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export default function DayTradesModal({ dateKey, trades = [], sym = '$', onClose }) {
  const rows = useMemo(
    () => [...(trades || [])].sort((a, b) => resultTimeMs(a) - resultTimeMs(b)),
    [trades]
  );
  const dayPnl = rows.reduce((s, t) => s + getTradePnL(t), 0);
  const wins = rows.filter((t) => getTradePnL(t) > 0).length;
  const losses = rows.filter((t) => getTradePnL(t) < 0).length;
  const winRate = rows.length ? ((wins / rows.length) * 100).toFixed(0) : '0';

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Lock background scroll while open (phones).
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle} className="modal-mobile">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--text-bright)' }}>{dayLabel(dateKey)}</h2>
          <button onClick={onClose} className="ts-btn ts-btn-ghost" style={{ padding: '6px 10px' }} aria-label="Close day detail">
            <X size={16} />
          </button>
        </div>

        <div className="number-font" style={{ fontSize: '30px', fontWeight: 700, color: dayPnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)', marginBottom: '4px' }}>
          {dayPnl >= 0 ? '+' : '-'}{sym}{Math.abs(dayPnl).toFixed(2)}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {rows.length} trade{rows.length === 1 ? '' : 's'} · {wins}W / {losses}L · {winRate}% win
        </div>

        {rows.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No trades recorded for this day.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map((t, i) => {
              const p = getTradePnL(t);
              const dir = directionOf(t);
              const isShort = dir === 'SHORT';
              const setup = t.setup && t.setup !== 'Untagged' ? t.setup : '';
              return (
                <div key={`${t.id || t.ticket || t.brokerId || 'r'}-${i}`} style={rowStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="number-font" style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '38px' }}>{rowTime(t)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.symbol || '—'}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                      color: isShort ? 'var(--color-loss)' : 'var(--color-win)',
                      backgroundColor: isShort ? 'rgba(255,82,82,0.12)' : 'rgba(0,230,118,0.12)',
                    }}>
                      {dir}
                    </span>
                    <span className="number-font" style={{ fontSize: '13px', fontWeight: 700, color: p >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                      {p >= 0 ? '+' : '-'}{sym}{Math.abs(p).toFixed(2)}
                    </span>
                  </div>
                  {setup ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', paddingLeft: '46px' }}>{setup}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  zIndex: 2000,
  display: 'flex',
  overflowY: 'auto',
  padding: '24px 16px',
};

const modalStyle = {
  margin: 'auto',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '20px',
  width: 'min(480px, calc(100vw - 32px))',
  maxHeight: '85vh',
  overflowY: 'auto',
};

const rowStyle = {
  backgroundColor: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '8px 10px',
};