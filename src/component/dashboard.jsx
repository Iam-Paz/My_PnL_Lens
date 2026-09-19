import { useMemo, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { toDate, formatDateShort, sortTradesByDate } from '../utils/dateUtils';
import ShareCard from './ShareCard.jsx';

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '60d', label: '60 Days' },
  { id: '90d', label: '90 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const CUR = { USD: '$', EUR: '€', GBP: '£', NGN: '₦' };

function getTradeDate(t) {
  return toDate(t.openAt || t.openTime || t.date);
}

function getTradePnL(t) {
  return Number(t.pnl ?? t.profit) || 0;
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
    const d = getTradeDate(t);
    return d && d >= start && d <= now;
  });
}

export default function Dashboard({ trades = [], settings }) {
  const cfg = settings || {
    startingBalance: 10000,
    riskPerTrade: 1,
    maxDrawdownPercent: 10,
    maxDailyDrawdownPercent: 3,
    currency: 'USD',
  };
  const sym = CUR[cfg.currency] || '$';

  const [period, setPeriod] = useState('30d');
  const [shareOpen, setShareOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
  });

  const scopedTrades = useMemo(() => filterByPeriod(trades, period), [trades, period]);
  const stats = useMemo(() => computeStats(scopedTrades), [scopedTrades]);

  const dailyMap = useMemo(() => {
    const m = {};
    for (const t of trades) {
      const d = getTradeDate(t);
      if (!d) continue;
      const key = formatDateShort(d);
      if (!m[key]) m[key] = { pnl: 0, count: 0, wins: 0, losses: 0 };
      const p = getTradePnL(t);
      m[key].pnl += p;
      m[key].count += 1;
      if (p > 0) m[key].wins += 1;
      else if (p < 0) m[key].losses += 1;
    }
    return m;
  }, [trades]);

  const equityData = useMemo(() => {
    // Sort trades chronologically (oldest first) for equity accumulation
    const sorted = sortTradesByDate(scopedTrades, false);
    let equity = Number(cfg.startingBalance) || 10000;
    let peak = equity;
    const rows = [];
    for (const t of sorted) {
      const p = getTradePnL(t);
      const d = getTradeDate(t);
      equity += p;
      if (equity > peak) peak = equity;
      rows.push({
        date: d ? formatDateShort(d) : 'N/A',
        equity: Number(equity.toFixed(2)),
        drawdown: Number((peak - equity).toFixed(2)),
      });
    }
    return rows;
  }, [scopedTrades, cfg.startingBalance]);

  const currentDrawdown = equityData.length ? equityData[equityData.length - 1].drawdown : 0;
  const maxDrawdown = equityData.reduce((m, r) => Math.max(m, r.drawdown), 0);
  const maxDrawdownLimit = (Number(cfg.startingBalance) || 10000) * ((Number(cfg.maxDrawdownPercent) || 10) / 100);
  const drawdownUsage = maxDrawdownLimit > 0 ? Math.min(100, (currentDrawdown / maxDrawdownLimit) * 100) : 0;

  // --- Daily drawdown guardrail (0% in settings = card hidden) ---
  const dailyDdPct = Number(cfg.maxDailyDrawdownPercent) || 0;
  const showDailyDd = dailyDdPct > 0;
  const showMaxDd = (Number(cfg.maxDrawdownPercent) || 0) > 0;
  const todayKey = formatDateShort(new Date());
  const todayPnL = dailyMap[todayKey]?.pnl || 0;
  const todayTradeCount = dailyMap[todayKey]?.count || 0;
  const dailyDdLimit = (Number(cfg.startingBalance) || 10000) * (dailyDdPct / 100);
  const dailyDdUsed = Math.max(0, -todayPnL);
  const dailyDdUsage = dailyDdLimit > 0 ? Math.min(100, (dailyDdUsed / dailyDdLimit) * 100) : 0;
  const dailyDdBreached = showDailyDd && dailyDdLimit > 0 && dailyDdUsed >= dailyDdLimit;
  const dailyDdHint = todayTradeCount === 0 ? 'No trades today yet' : `Today's P&L: ${fmt(todayPnL, sym, true)}`;

  const weeklyData = useMemo(() => buildWeeklySummary(scopedTrades), [scopedTrades]);

  return (
    <div>
      <div className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>🏠 Command Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{PERIODS.find((p) => p.id === period)?.label}</strong> · {scopedTrades.length} trades in scope
          </p>
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
          <button
            onClick={() => setShareOpen(true)}
            className="ts-btn"
            title="Generate a shareable P&L image"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              padding: '7px 12px',
              fontSize: '12px',
            }}
          >
            📤 Share
          </button>
        </div>
      </div>

      <SectionTitle>Performance Overview</SectionTitle>
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <Stat label="Net P&L" value={fmt(stats.netPnL, sym, true)} color={stats.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)'} />
        <Stat label="Win Rate" value={`${stats.winRate}%`} color="#38bdf8" />
        <Stat label="Avg Winning Trade" value={fmt(stats.avgWin, sym, true)} color="var(--color-win)" />
        <Stat label="Avg Losing Trade" value={fmt(-stats.avgLoss, sym, true)} color="var(--color-loss)" />
        <Stat label="Avg Risk / Reward" value={`1 : ${stats.avgRR}`} color="#f59e0b" />
        <Stat label="Profit Factor" value={stats.profitFactor} color="#a78bfa" hint="> 1.5 is strong" />
      </div>

      {(showDailyDd || showMaxDd) && (
        <>
          <SectionTitle>Risk Management Monitor</SectionTitle>
          {dailyDdBreached && (
            <div style={{ backgroundColor: 'rgba(255,82,82,0.12)', border: '1px solid #ff5252', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: '#ff5252', fontSize: '13px', fontWeight: 700 }}>
              🛑 DAILY LIMIT HIT — you're down {sym}{dailyDdUsed.toFixed(2)} of your {sym}{dailyDdLimit.toFixed(2)} daily limit. Step away and protect the account.
            </div>
          )}
          <div className="risk-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '28px' }}>
            {showDailyDd && (
              <RiskCard
                title={`Daily Drawdown Limit (${dailyDdPct}%)`}
                used={dailyDdUsed}
                limit={dailyDdLimit}
                usagePct={dailyDdUsage}
                sym={sym}
                hint={dailyDdHint}
              />
            )}
            {showMaxDd && (
              <RiskCard
                title={`Maximum Drawdown Limit (${cfg.maxDrawdownPercent}%)`}
                used={currentDrawdown}
                limit={maxDrawdownLimit}
                usagePct={drawdownUsage}
                sym={sym}
                hint={`Peak drawdown recorded: ${sym}${maxDrawdown.toFixed(2)}`}
              />
            )}
          </div>
        </>
      )}

      <SectionTitle>Equity Curve</SectionTitle>
      <div className="ts-card chart-container" style={{ height: '320px', marginBottom: '28px', display: 'flex', flexDirection: 'column' }}>
        {equityData.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            No trades in this period.
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2962ff" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#2962ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${v}`} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
                <Area type="monotone" dataKey="equity" stroke="#2962ff" strokeWidth={2.5} fill="url(#eq)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <SectionTitle
        right={
          <input
            type="month"
            value={calMonth}
            onChange={(e) => setCalMonth(e.target.value)}
            className="ts-input"
            style={{ width: 'auto' }}
          />
        }
      >
        Trading Activity Calendar
      </SectionTitle>
      <div className="ts-card" style={{ marginBottom: '28px' }}>
        <CalendarGrid monthStr={calMonth} dailyMap={dailyMap} sym={sym} />
      </div>

      <SectionTitle>Performance Analytics</SectionTitle>
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <Stat label="Trade Win Rate" value={`${stats.winRate}%`} color="#38bdf8" />
        <Stat label="Winning Days Rate" value={`${stats.winningDaysRate}%`} color="#38bdf8" />
        <Stat label="Best Trade" value={fmt(stats.bestTrade, sym, true)} color="var(--color-win)" />
        <Stat label="Worst Trade" value={fmt(stats.worstTrade, sym, true)} color="var(--color-win)" />
        <Stat label="Trading Days Logged" value={stats.tradingDays} />
        <Stat label="Total Trades" value={stats.totalTrades} />
        <Stat label="Winners" value={stats.winners} color="var(--color-win)" />
        <Stat label="Losers" value={stats.losers} color="var(--color-loss)" />
      </div>

      <SectionTitle>Weekly Performance</SectionTitle>
      <div className="ts-card" style={{ marginBottom: '28px' }}>
        {weeklyData.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No weekly data available in this period.</p>
        ) : (
          <>
            <div style={{ height: '220px', marginBottom: '20px' }} className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                  <XAxis dataKey="week" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${v}`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {weeklyData.map((w, i) => (
                      <Cell key={`weekly-cell-${i}`} fill={Number(w.pnl) >= 0 ? '#00e676' : '#ff5252'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="ts-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th className="num">P&L</th>
                    <th className="num">Trades</th>
                    <th className="num">Win Rate</th>
                    <th className="num">Winning Days</th>
                    <th className="num">Losing Days</th>
                    <th className="num">Avg Daily P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyData.map((w) => (
                    <tr key={w.week}>
                      <td>{w.week}</td>
                      <td className="num number-font" style={{ color: w.pnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)', fontWeight: 700 }}>
                        {w.pnl >= 0 ? '+' : ''}{sym}{w.pnl.toFixed(2)}
                      </td>
                      <td className="num number-font">{w.trades}</td>
                      <td className="num number-font">{w.winRate}%</td>
                      <td className="num number-font" style={{ color: 'var(--color-win)' }}>{w.winDays}</td>
                      <td className="num number-font" style={{ color: 'var(--color-loss)' }}>{w.lossDays}</td>
                      <td className="num number-font">{sym}{w.avgDaily.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <SectionTitle>Trade Statistics</SectionTitle>
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <Stat label="Best Trade" value={fmt(stats.bestTrade, sym, true)} color="var(--color-win)" />
        <Stat label="Worst Trade" value={fmt(stats.worstTrade, sym, true)} color="var(--color-loss)" />
        <Stat label="Largest Winning Streak" value={`${stats.longestWinStreak} 🔥`} color="var(--color-win)" />
        <Stat label="Largest Losing Streak" value={`${stats.longestLossStreak} ❄️`} color="var(--color-loss)" />
        <Stat label="Average Trade" value={fmt(stats.avgTrade, sym, true)} />
        <Stat label="Average Winner" value={fmt(stats.avgWin, sym, true)} color="var(--color-win)" />
        <Stat label="Average Loser" value={fmt(-stats.avgLoss, sym, true)} color="var(--color-loss)" />
        <Stat label="Total Trades" value={stats.totalTrades} />
        <Stat label="Total Winners" value={stats.winners} color="var(--color-win)" />
        <Stat label="Total Losers" value={stats.losers} color="var(--color-loss)" />
      </div>

      {shareOpen && <ShareCard trades={trades} settings={cfg} onClose={() => setShareOpen(false)} />}
    </div>
  );
}

function computeStats(trades) {
  const totalTrades = trades.length;
  const wins = trades.filter((t) => getTradePnL(t) > 0);
  const losses = trades.filter((t) => getTradePnL(t) < 0);
  const grossProfit = wins.reduce((s, t) => s + getTradePnL(t), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + getTradePnL(t), 0));
  const netPnL = grossProfit - grossLoss;

  const winRate = totalTrades ? ((wins.length / totalTrades) * 100).toFixed(1) : '0.0';
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const avgTrade = totalTrades ? netPnL / totalTrades : 0;
  const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : '0.00';
  const avgRR = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '—';

  const profitsArr = trades.map((t) => getTradePnL(t));
  const bestTrade = totalTrades ? Math.max(...profitsArr) : 0;
  const worstTrade = totalTrades ? Math.min(...profitsArr) : 0;

  const chrono = sortTradesByDate(trades, false);
  let longestWin = 0, longestLoss = 0, curW = 0, curL = 0;
  for (const t of chrono) {
    const p = getTradePnL(t);
    if (p > 0) { curW += 1; curL = 0; longestWin = Math.max(longestWin, curW); }
    else if (p < 0) { curL += 1; curW = 0; longestLoss = Math.max(longestLoss, curL); }
  }

  const daysSet = new Set();
  const dayPnL = {};
  for (const t of trades) {
    const d = getTradeDate(t);
    if (!d) continue;
    const key = formatDateShort(d);
    daysSet.add(key);
    dayPnL[key] = (dayPnL[key] || 0) + getTradePnL(t);
  }
  const tradingDays = daysSet.size;
  const winDays = Object.values(dayPnL).filter((v) => v > 0).length;
  const winningDaysRate = tradingDays ? ((winDays / tradingDays) * 100).toFixed(1) : '0.0';

  return {
    totalTrades, winners: wins.length, losers: losses.length,
    grossProfit, grossLoss, netPnL, winRate, avgWin, avgLoss,
    avgTrade, profitFactor, avgRR, bestTrade, worstTrade,
    longestWinStreak: longestWin, longestLossStreak: longestLoss,
    tradingDays, winningDaysRate,
  };
}

function buildWeeklySummary(trades) {
  const weeks = {};
  for (const t of trades) {
    const d = getTradeDate(t);
    if (!d) continue;
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const key = formatDateShort(weekStart);
    if (!weeks[key]) weeks[key] = { week: key, pnl: 0, trades: 0, wins: 0, days: {} };
    const p = getTradePnL(t);
    weeks[key].pnl += p; weeks[key].trades += 1;
    if (p > 0) weeks[key].wins += 1;
    const dk = formatDateShort(d);
    weeks[key].days[dk] = (weeks[key].days[dk] || 0) + p;
  }
  return Object.values(weeks)
  .sort((a, b) => b.week.localeCompare(a.week)) // newest week first
  .map((w) => {
      const dayVals = Object.values(w.days);
      return {
        week: w.week,
        pnl: Number(w.pnl.toFixed(2)),
        trades: w.trades,
        winRate: w.trades ? ((w.wins / w.trades) * 100).toFixed(1) : '0.0',
        winDays: dayVals.filter((v) => v > 0).length,
        lossDays: dayVals.filter((v) => v < 0).length,
        avgDaily: dayVals.length ? w.pnl / dayVals.length : 0,
      };
    });
}

function CalendarGrid({ monthStr, dailyMap, sym }) {
  const [y, m] = monthStr.split('-').map(Number);
  const year = y, month = m - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, data: dailyMap[key] || null });
  }

  return (
    <>
      <div className="calendar-header" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d}>{d}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
        {cells.map((c, i) => {
          if (!c) return <div key={'b' + i} className="calendar-day" style={{ minHeight: '68px' }} />;
          const data = c.data;
          let bg = 'var(--bg-main)', border = 'var(--border-color)', textColor = 'var(--text-secondary)';
          if (data) {
            if (data.pnl > 0) { bg = 'rgba(0,230,118,0.12)'; border = 'rgba(0,230,118,0.4)'; textColor = 'var(--color-win)'; }
            else if (data.pnl < 0) { bg = 'rgba(255,82,82,0.12)'; border = 'rgba(255,82,82,0.4)'; textColor = 'var(--color-loss)'; }
            else { bg = 'rgba(148,163,184,0.08)'; border = 'var(--border-color)'; textColor = 'var(--text-secondary)'; }
          }
          return (
            <div key={'d' + i} className="calendar-day" style={{
              minHeight: '68px', backgroundColor: bg, border: `1px solid ${border}`,
              borderRadius: '6px', padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{c.day}</span>
              {data && (
                <div style={{ textAlign: 'right' }}>
                  <div className="number-font" style={{ fontSize: '12px', fontWeight: 700, color: textColor }}>
                    {data.pnl >= 0 ? '+' : ''}{sym}{Math.round(data.pnl)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{data.count}t</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function SectionTitle({ children, right }) {
  return (
    <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', marginTop: '4px' }}>
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
      <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 6px 0' }}>{label}</p>
      <h2 className="number-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: color || '#fff' }}>{value}</h2>
      {hint && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
}

function RiskCard({ title, used, limit, usagePct, sym, hint }) {
  const critical = usagePct >= 80;
  const warning = usagePct >= 50 && usagePct < 80;
  const barColor = critical ? '#ff5252' : warning ? '#f59e0b' : '#00e676';
  return (
    <div className="ts-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        <span className="number-font" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {sym}{used.toFixed(2)} / {sym}{limit.toFixed(2)}
        </span>
      </div>
      <div style={{ height: '10px', backgroundColor: 'var(--bg-main)', borderRadius: '5px', overflow: 'hidden', marginBottom: '8px' }}>
        <div style={{ height: '100%', width: `${Math.min(100, usagePct)}%`, backgroundColor: barColor, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
        <span>{hint}</span>
        <span className="number-font" style={{ fontWeight: 700, color: barColor }}>{usagePct.toFixed(0)}% used</span>
      </div>
    </div>
  );
}

function fmt(n, sym = '$', signed = false) {
  const abs = Math.abs(n);
  if (n < 0) return `-${sym}${abs.toFixed(2)}`;
  return `${signed ? '+' : ''}${sym}${abs.toFixed(2)}`;
}

const tooltipStyle = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  fontSize: '12px',
};