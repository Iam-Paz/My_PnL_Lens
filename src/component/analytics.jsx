import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';

const PERIODS = [
  { id: 'today', label: 'Today' }, { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' }, { id: '60d', label: '60 Days' },
  { id: '90d', label: '90 Days' }, { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const CUR = { USD: '$', EUR: '€', GBP: '£', NGN: '₦' };

function parseTradeDate(str) {
  if (!str) return null;
  const d = new Date(String(str).replace(/\./g, '-').split(' ')[0]);
  return isNaN(d) ? null : d;
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function filterByPeriod(trades, period) {
  if (period === 'all') return trades;
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  let start = new Date(now);
  if (period === 'today') start.setHours(0, 0, 0, 0);
  else if (period === '7d') { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
  else if (period === '30d') { start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0); }
  else if (period === '60d') { start.setDate(start.getDate() - 59); start.setHours(0, 0, 0, 0); }
  else if (period === '90d') { start.setDate(start.getDate() - 89); start.setHours(0, 0, 0, 0); }
  else if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1);
  return trades.filter((t) => {
    const d = parseTradeDate(t.openTime);
    return d && d >= start && d <= now;
  });
}

export default function Analytics({ trades = [], settings }) {
  const cfg = settings || { startingBalance: 10000, currency: 'USD' };
  const sym = CUR[cfg.currency] || '$';

  const [period, setPeriod] = useState('all');
  const [symbolSort, setSymbolSort] = useState('netPnL');

  const scoped = useMemo(() => filterByPeriod(trades, period), [trades, period]);
  const overview = useMemo(() => computeOverview(scoped), [scoped]);
  const cumData = useMemo(() => buildCumulative(scoped), [scoped]);
  const dailyData = useMemo(() => buildDaily(scoped), [scoped]);
  const symbolRows = useMemo(() => buildSymbolRows(scoped), [scoped]);

  const sortedSymbols = useMemo(() => {
    const c = [...symbolRows];
    if (symbolSort === 'netPnL') c.sort((a, b) => b.netPnL - a.netPnL);
    else if (symbolSort === 'expectancy') c.sort((a, b) => b.expectancy - a.expectancy);
    else if (symbolSort === 'winRate') c.sort((a, b) => b.winRate - a.winRate);
    else if (symbolSort === 'count') c.sort((a, b) => b.count - a.count);
    return c;
  }, [symbolRows, symbolSort]);

  const symbolChart = sortedSymbols.slice(0, 8).map((r) => ({
    symbol: r.symbol.length > 10 ? r.symbol.slice(0, 10) : r.symbol,
    pnl: Number(r.netPnL.toFixed(2)),
  }));

  const buySell = useMemo(() => buildBuySell(scoped), [scoped]);
  const dowRows = useMemo(() => buildDow(scoped), [scoped]);
  const monthlyRows = useMemo(() => buildMonthly(scoped), [scoped]);

  const directionBarData = [
    { name: 'BUYS', pnl: Number(buySell.buys.netPnL.toFixed(2)), count: buySell.buys.count },
    { name: 'SELLS', pnl: Number(buySell.sells.netPnL.toFixed(2)), count: buySell.sells.count },
  ];

  return (
    <div>
      <div className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>📈 Performance Analytics</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>{scoped.length} trades in scope</p>
        </div>
        <div className="period-filters" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className="ts-btn"
              style={{
                backgroundColor: period === p.id ? 'var(--accent-blue)' : 'var(--bg-surface)',
                color: period === p.id ? '#fff' : 'var(--text-secondary)',
                border: '1px solid ' + (period === p.id ? 'var(--accent-blue)' : 'var(--border-color)'),
                padding: '7px 12px',
                fontSize: '12px',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <Stat label="Net P&L" value={fmt(overview.netPnL, sym, true)} color={overview.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)'} />
        <Stat label="Expectancy / Trade" value={fmt(overview.expectancy, sym, true)} color={overview.expectancy >= 0 ? 'var(--color-win)' : 'var(--color-loss)'} />
        <Stat label="Profit Factor" value={overview.pf} color="#a78bfa" hint="> 1.5 is strong" />
        <Stat label="Win Rate" value={`${overview.winRate}%`} color="#38bdf8" />
        <Stat label="Avg Win" value={fmt(overview.avgWin, sym, true)} color="var(--color-win)" />
        <Stat label="Avg Loss" value={fmt(-overview.avgLoss, sym, true)} color="var(--color-loss)" />
      </div>

      <SectionTitle>Cumulative P&L Growth</SectionTitle>
      <div className="ts-card chart-container" style={{ height: '280px', marginBottom: '28px' }}>
        {cumData.length === 0 ? <EmptyMsg /> : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="acum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2962ff" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#2962ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${v}`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
              <Area type="monotone" dataKey="cumulative" stroke="#2962ff" strokeWidth={2.5} fill="url(#acum)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <SectionTitle>Daily P&L Distribution (last 60 days)</SectionTitle>
      <div className="ts-card chart-container" style={{ height: '260px', marginBottom: '28px' }}>
        {dailyData.length === 0 ? <EmptyMsg /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${v}`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {dailyData.map((d, i) => (
                  <Cell key={i} fill={d.pnl >= 0 ? '#00e676' : '#ff5252'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="analytics-grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        <div className="ts-card">
          <h3 style={cardH}>Direction Edge: Buys vs Sells</h3>
          {buySell.buys.count + buySell.sells.count === 0 ? (
            <EmptyMsg />
          ) : (
            <>
              <div style={{ height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={directionBarData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${v}`} />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
                    <Bar dataKey="pnl" radius={[6, 6, 0, 0]}>
                      <Cell fill={buySell.buys.netPnL >= 0 ? '#38bdf8' : '#ff5252'} />
                      <Cell fill={buySell.sells.netPnL >= 0 ? '#00e676' : '#f87171'} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '12px' }}>
                <div style={miniBox}>
                  <span style={{ color: '#38bdf8', fontWeight: 700 }}>BUYS ({buySell.buys.count})</span>
                  <div className="number-font" style={{ fontWeight: 700, color: buySell.buys.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                    {fmt(buySell.buys.netPnL, sym, true)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Win {buySell.buys.winRate}%</div>
                </div>
                <div style={miniBox}>
                  <span style={{ color: '#f87171', fontWeight: 700 }}>SELLS ({buySell.sells.count})</span>
                  <div className="number-font" style={{ fontWeight: 700, color: buySell.sells.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                    {fmt(buySell.sells.netPnL, sym, true)}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Win {buySell.sells.winRate}%</div>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="ts-card">
          <h3 style={cardH}>Day-of-Week Edge</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="ts-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th className="num">Trades</th>
                  <th className="num">Win %</th>
                  <th className="num">Net P&L</th>
                </tr>
              </thead>
              <tbody>
                {dowRows.map((r) => (
                  <tr key={r.day}>
                    <td style={{ fontWeight: 700 }}>{r.day}</td>
                    <td className="num number-font">{r.count}</td>
                    <td className="num number-font" style={{ color: '#38bdf8' }}>{r.winRate}%</td>
                    <td className="num number-font" style={{ fontWeight: 700, color: r.pnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                      {fmt(r.pnl, sym, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <SectionTitle
        right={
          <select
            className="ts-input"
            value={symbolSort}
            onChange={(e) => setSymbolSort(e.target.value)}
            style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
          >
            <option value="netPnL">Sort: Net P&L</option>
            <option value="expectancy">Sort: Expectancy</option>
            <option value="winRate">Sort: Win Rate</option>
            <option value="count">Sort: Trades</option>
          </select>
        }
      >
        Symbol Performance
      </SectionTitle>

      <div className="ts-card chart-container" style={{ height: '240px', marginBottom: '16px' }}>
        {symbolChart.length === 0 ? <EmptyMsg /> : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={symbolChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
              <XAxis dataKey="symbol" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${v}`} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
              <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                {symbolChart.map((s, i) => (
                  <Cell key={i} fill={s.pnl >= 0 ? '#00e676' : '#ff5252'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="ts-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '28px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ts-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="num">Trades</th>
                <th className="num">Win %</th>
                <th className="num">Net P&L</th>
                <th className="num">Avg Win</th>
                <th className="num">Avg Loss</th>
                <th className="num">PF</th>
                <th className="num">Expectancy</th>
              </tr>
            </thead>
            <tbody>
              {sortedSymbols.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No data.</td>
                </tr>
              ) : (
                sortedSymbols.map((r) => (
                  <tr key={r.symbol}>
                    <td style={{ fontWeight: 700 }}>{r.symbol}</td>
                    <td className="num number-font">{r.count}</td>
                    <td className="num number-font" style={{ color: '#38bdf8' }}>{r.winRate.toFixed(1)}%</td>
                    <td className="num number-font" style={{ fontWeight: 700, color: r.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                      {fmt(r.netPnL, sym, true)}
                    </td>
                    <td className="num number-font" style={{ color: 'var(--color-win)' }}>+{sym}{r.avgWin.toFixed(2)}</td>
                    <td className="num number-font" style={{ color: 'var(--color-loss)' }}>-{sym}{r.avgLoss.toFixed(2)}</td>
                    <td className="num number-font">{r.pf}</td>
                    <td className="num number-font" style={{ fontWeight: 700, color: r.expectancy >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                      {fmt(r.expectancy, sym, true)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SectionTitle>Monthly Breakdown</SectionTitle>
      <div className="ts-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ts-table">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Trades</th>
                <th className="num">Win %</th>
                <th className="num">Net P&L</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>No data.</td>
                </tr>
              ) : (
                monthlyRows.map((r) => (
                  <tr key={r.month}>
                    <td style={{ fontWeight: 700 }}>{r.month}</td>
                    <td className="num number-font">{r.trades}</td>
                    <td className="num number-font" style={{ color: '#38bdf8' }}>{r.winRate}%</td>
                    <td className="num number-font" style={{ fontWeight: 700, color: r.pnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                      {fmt(r.pnl, sym, true)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function computeOverview(trades) {
  const total = trades.length;
  const wins = trades.filter((t) => Number(t.profit) > 0);
  const losses = trades.filter((t) => Number(t.profit) < 0);
  const grossProfit = wins.reduce((s, t) => s + Number(t.profit), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.profit), 0));
  const netPnL = grossProfit - grossLoss;
  const winRate = total ? ((wins.length / total) * 100).toFixed(1) : '0.0';
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const pf = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : '0.00';
  const expectancy = total ? (wins.length / total) * avgWin - (losses.length / total) * avgLoss : 0;
  return { total, netPnL, winRate, avgWin, avgLoss, pf, expectancy };
}

function buildCumulative(trades) {
  const sorted = [...trades].sort((a, b) => (parseTradeDate(a.openTime)?.getTime() || 0) - (parseTradeDate(b.openTime)?.getTime() || 0));
  let cum = 0;
  return sorted.map((t, i) => {
    cum += Number(t.profit) || 0;
    return {
      date: (t.openTime || '').split(' ')[0] || `#${i + 1}`,
      cumulative: Number(cum.toFixed(2)),
    };
  });
}

function buildDaily(trades) {
  const m = {};
  for (const t of trades) {
    const d = parseTradeDate(t.openTime);
    if (!d) continue;
    const k = ymd(d);
    if (!m[k]) m[k] = { pnl: 0, count: 0 };
    m[k].pnl += Number(t.profit) || 0;
    m[k].count += 1;
  }
  return Object.entries(m)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-60)
    .map(([full, v]) => ({
      date: full.slice(5),
      fullDate: full,
      pnl: Number(v.pnl.toFixed(2)),
      trades: v.count,
    }));
}

function buildSymbolRows(trades) {
  const g = {};
  for (const t of trades) {
    const s = t.symbol || 'UNKNOWN';
    if (!g[s]) g[s] = [];
    g[s].push(t);
  }
  return Object.entries(g).map(([symbol, list]) => {
    const count = list.length;
    const wins = list.filter((x) => Number(x.profit) > 0);
    const losses = list.filter((x) => Number(x.profit) < 0);
    const gp = wins.reduce((s, x) => s + Number(x.profit), 0);
    const gl = Math.abs(losses.reduce((s, x) => s + Number(x.profit), 0));
    const net = gp - gl;
    const wr = count ? (wins.length / count) * 100 : 0;
    const avgW = wins.length ? gp / wins.length : 0;
    const avgL = losses.length ? gl / losses.length : 0;
    const pf = gl > 0 ? gp / gl : gp > 0 ? 999 : 0;
    const exp = count ? (wins.length / count) * avgW - (losses.length / count) * avgL : 0;
    return {
      symbol, count, winRate: wr, netPnL: net,
      avgWin: avgW, avgLoss: avgL,
      pf: pf === 999 ? '∞' : pf.toFixed(2),
      expectancy: exp,
    };
  });
}

function buildBuySell(trades) {
  const buys = trades.filter((t) => String(t.type || '').toLowerCase() === 'buy');
  const sells = trades.filter((t) => String(t.type || '').toLowerCase() === 'sell');
  const calc = (arr) => {
    const gp = arr.filter((x) => Number(x.profit) > 0).reduce((s, x) => s + Number(x.profit), 0);
    const gl = Math.abs(arr.filter((x) => Number(x.profit) < 0).reduce((s, x) => s + Number(x.profit), 0));
    return {
      count: arr.length,
      netPnL: gp - gl,
      winRate: arr.length
        ? ((arr.filter((x) => Number(x.profit) > 0).length / arr.length) * 100).toFixed(1)
        : '0.0',
    };
  };
  return { buys: calc(buys), sells: calc(sells) };
}

function buildDow(trades) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const arr = names.map((n) => ({ day: n, count: 0, pnl: 0, wins: 0 }));
  for (const t of trades) {
    const d = parseTradeDate(t.openTime);
    if (!d) continue;
    const idx = d.getDay();
    arr[idx].count += 1;
    arr[idx].pnl += Number(t.profit) || 0;
    if (Number(t.profit) > 0) arr[idx].wins += 1;
  }
  return [1, 2, 3, 4, 5, 6, 0].map((i) => {
    const r = arr[i];
    return {
      ...r,
      winRate: r.count ? ((r.wins / r.count) * 100).toFixed(1) : '0.0',
      pnl: Number(r.pnl.toFixed(2)),
    };
  });
}

function buildMonthly(trades) {
  const m = {};
  for (const t of trades) {
    const d = parseTradeDate(t.openTime);
    if (!d) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!m[k]) m[k] = { pnl: 0, count: 0, wins: 0 };
    m[k].pnl += Number(t.profit) || 0;
    m[k].count += 1;
    if (Number(t.profit) > 0) m[k].wins += 1;
  }
  return Object.entries(m)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      month,
      pnl: Number(v.pnl.toFixed(2)),
      trades: v.count,
      winRate: v.count ? ((v.wins / v.count) * 100).toFixed(1) : '0.0',
    }));
}

function SectionTitle({ children, right }) {
  return (
    <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: 0 }}>
        {children}
      </h3>
      {right}
    </div>
  );
}

function Stat({ label, value, color, hint }) {
  return (
    <div className="ts-card" style={{ padding: '14px 16px' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', margin: '0 0 6px 0' }}>{label}</p>
      <h2 className="number-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: color || '#fff' }}>{value}</h2>
      {hint && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
}

function EmptyMsg() {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
      No trades in this period.
    </div>
  );
}

function fmt(n, sym = '$', signed = false) {
  const abs = Math.abs(n);
  if (n < 0) return `-${sym}${abs.toFixed(2)}`;
  return `${signed ? '+' : ''}${sym}${abs.toFixed(2)}`;
}

const tooltipStyle = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '12px' };
const cardH = { fontSize: '15px', marginTop: 0, marginBottom: '16px' };
const miniBox = { backgroundColor: 'var(--bg-main)', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' };