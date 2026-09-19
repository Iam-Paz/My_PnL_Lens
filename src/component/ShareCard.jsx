import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { filterTradesByPeriod } from '../utils/dateUtils';
import { calculateTradeStats } from '../utils/tradeStats';

const CUR = { USD: '$', EUR: '€', GBP: '£', NGN: '₦' };

const SHARE_PERIODS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: 'all', label: 'All Time' },
];

export default function ShareCard({ trades = [], settings, onClose }) {
  const [period, setPeriod] = useState('30d');
  const [hideAmounts, setHideAmounts] = useState(false);
  const [generating, setGenerating] = useState(false);
  const cardRef = useRef(null);

  const startingBalance = Number(settings?.startingBalance) || 10000;
  const sym = CUR[settings?.currency] || '$';

  const scoped = useMemo(() => filterTradesByPeriod(trades, period), [trades, period]);
  const stats = useMemo(() => calculateTradeStats(scoped), [scoped]);

  const periodLabel = SHARE_PERIODS.find((p) => p.id === period)?.label || period;
  const netPct = startingBalance > 0 ? (stats.netPnL / startingBalance) * 100 : 0;
  const isProfit = stats.netPnL >= 0;
  const heroColor = isProfit ? '#00e676' : '#ff5252';
  const heroValue = hideAmounts
    ? `${netPct >= 0 ? '+' : ''}${netPct.toFixed(2)}%`
    : `${stats.netPnL < 0 ? '-' : '+'}${sym}${Math.abs(stats.netPnL).toFixed(2)}`;

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = async () => {
    if (!cardRef.current || generating) return;
    setGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: '#141822',
      });
      const link = document.createElement('a');
      link.download = `mypnl-lens-${period}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Share image failed:', err);
      alert('Could not generate the image. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={modalStyle} className="modal-mobile">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>📤 Share Performance</h2>
          <button onClick={onClose} className="ts-btn ts-btn-ghost" style={{ padding: '6px 12px' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {SHARE_PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className="ts-btn"
              style={{
                backgroundColor: period === p.id ? 'var(--accent-blue)' : 'var(--bg-main)',
                color: period === p.id ? '#fff' : 'var(--text-secondary)',
                border: '1px solid ' + (period === p.id ? 'var(--accent-blue)' : 'var(--border-color)'),
                padding: '6px 12px',
                fontSize: '12px',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Card preview wrapper (scrolls on small screens, fixed 480px for clean capture) */}
        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <div ref={cardRef} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <span style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: '18px', fontWeight: 700, color: '#ffffff' }}>
                My_PnL_Lens
              </span>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#788296', backgroundColor: '#0b0e14', border: '1px solid #232836', borderRadius: '20px', padding: '4px 12px' }}>
                {periodLabel}
              </span>
            </div>

            <div style={{ fontSize: '11px', fontWeight: 700, color: '#788296', letterSpacing: '1px', marginBottom: '4px' }}>
              {hideAmounts ? 'NET RETURN' : 'NET P&L'}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '46px', fontWeight: 700, color: heroColor, lineHeight: 1.1, marginBottom: '20px' }}>
              {heroValue}
            </div>

            <div style={{ height: '1px', backgroundColor: '#232836', marginBottom: '20px' }} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div>
                <div style={statLabel}>WIN RATE</div>
                <div style={statValue}>{stats.winRate}%</div>
              </div>
              <div>
                <div style={statLabel}>TRADES</div>
                <div style={statValue}>{stats.count}</div>
              </div>
              <div>
                <div style={statLabel}>PROFIT FACTOR</div>
                <div style={statValue}>{stats.profitFactor}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#4a5468' }}>
              <span>📈 Made with My_PnL_Lens</span>
              <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={hideAmounts}
            onChange={(e) => setHideAmounts(e.target.checked)}
            style={{ width: '18px', height: '18px', accentColor: '#2962ff', cursor: 'pointer' }}
          />
          🔒 Hide $ amounts (show % only)
        </label>

        <button
          onClick={handleDownload}
          disabled={generating}
          className="ts-btn ts-btn-primary"
          style={{ width: '100%', justifyContent: 'center', padding: '12px', opacity: generating ? 0.6 : 1 }}
        >
          {generating ? 'Generating...' : '⬇ Download PNG'}
        </button>
      </div>
    </div>
  );
}

// Modal chrome (not part of the captured image — CSS vars are fine here)
const overlayStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  zIndex: 1200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '16px',
};

const modalStyle = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '24px',
  width: 'min(560px, calc(100vw - 32px))',
  maxHeight: '90vh',
  overflowY: 'auto',
};

// Captured card — hard-coded colors only (no CSS vars) so the PNG always looks right
const cardStyle = {
  width: '480px',
  maxWidth: 'none',
  margin: '0 auto',
  backgroundColor: '#141822',
  border: '1px solid #232836',
  borderRadius: '16px',
  padding: '28px',
  fontFamily: "'Inter', -apple-system, sans-serif",
};

const statLabel = { fontSize: '10px', fontWeight: 700, color: '#788296', letterSpacing: '0.8px', marginBottom: '4px' };
const statValue = { fontFamily: "'JetBrains Mono', monospace", fontSize: '20px', fontWeight: 700, color: '#ffffff' };