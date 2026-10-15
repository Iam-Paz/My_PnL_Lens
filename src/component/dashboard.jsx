import { useMemo, useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { LayoutDashboard, Share2, TriangleAlert, Flame, Snowflake, Filter } from 'lucide-react';
import { formatDateShort, filterTradesByPeriod, getTradeResultDate, getInactiveDays, getLastActivityDate, isTradeOpen, filterTradesGlobal, countGlobalFilter } from '../utils/dateUtils';
import { sortTradesChronological } from '../utils/tradeStats';
import { useSkin, chartPalette } from '../utils/themeConfig.js';
import ShareCard from './ShareCard.jsx';
import DayTradesModal from './DayTradesModal.jsx';
import { STORAGE_KEYS } from '../utils/storageKeys.js';

const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' },
  { id: '60d', label: '60 Days' },
  { id: '90d', label: '90 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'custom', label: 'Custom' },
  { id: 'all', label: 'All Time' },
];

const CUR = { USD: '$', EUR: '€', GBP: '£', NGN: '₦' };

function getTradePnL(t) {
  return Number(t.pnl ?? t.profit) || 0;
}

export default function Dashboard({ trades = [], settings, brandName = 'My_PnL_Lens', globalFilter = null, onOpenFilters = null }) {
  const cfg = settings || {
    startingBalance: 10000,
    riskPerTrade: 1,
    maxDrawdownPercent: 10,
    maxDailyDrawdownPercent: 3,
    currency: 'USD',
  };
  const sym = CUR[cfg.currency] || '$';
  // Chart palette for the active skin (recharts needs real colors, not var()).
  const cc = chartPalette(useSkin());

  const [period, setPeriod] = useState(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEYS.dashboardPeriod);
      if (v && PERIODS.some((p) => p.id === v)) return v;
    } catch { /* fresh default */ }
    return '30d';
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.dashboardPeriod, period); } catch { /* storage full/blocked */ }
  }, [period]);
  // Custom date range (period 'custom'). Defaults to the last 30 days; persisted.
  const [customRange, setCustomRange] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.dashboardCustomRange);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && v.start && v.end) return { start: v.start, end: v.end };
      }
    } catch { /* defaults below */ }
    const t = new Date();
    const s = new Date(t);
    s.setDate(s.getDate() - 29);
    return { start: formatDateShort(s), end: formatDateShort(t) };
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.dashboardCustomRange, JSON.stringify(customRange)); } catch { /* storage full/blocked */ }
  }, [customRange]);
  const [shareOpen, setShareOpen] = useState(false);
  const [daySel, setDaySel] = useState(null); // { dateKey, trades } for the day-detail modal
  const [calMonth, setCalMonth] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`;
  });

  // Shared period filter (same helper + same close-date basis as Analytics & Share Card)
  const periodTrades = useMemo(() => filterTradesByPeriod(trades, period, customRange), [trades, period, customRange]);
  // Global cross-page filter applies on top of the period scope.
  const scopedTrades = useMemo(() => filterTradesGlobal(periodTrades, globalFilter), [periodTrades, globalFilter]);
  // All trades under the global filter: feeds the calendar + Share Card.
  // (Risk cards below deliberately stay account-wide — see acctToday.)
  const gTrades = useMemo(() => filterTradesGlobal(trades, globalFilter), [trades, globalFilter]);
  const activeFilters = countGlobalFilter(globalFilter);
  const stats = useMemo(() => computeStats(scopedTrades), [scopedTrades]);

  const dailyMap = useMemo(() => {
    const m = {};
    for (const t of gTrades) {
      if (isTradeOpen(t)) continue;
      const d = getTradeResultDate(t);
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
  }, [gTrades]);

  // Day -> trades index using the SAME bucketing as dailyMap above (keep in sync).
  const dayTrades = useMemo(() => {
    const m = {};
    for (const t of gTrades) {
      if (isTradeOpen(t)) continue;
      const d = getTradeResultDate(t);
      if (!d) continue;
      const key = formatDateShort(d);
      (m[key] = m[key] || []).push(t);
    }
    return m;
  }, [gTrades]);

  const equityData = useMemo(() => {
    // Sort trades chronologically (oldest first) for equity accumulation
    const sorted = sortTradesChronological(scopedTrades);
    let equity = Number(cfg.startingBalance) || 10000;
    let peak = equity;
    const rows = [];
    for (const t of sorted) {
      const p = getTradePnL(t);
      const d = getTradeResultDate(t);
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

  // Lifetime curve (ALL trades): the Max-Drawdown risk card is account-scoped,
  // never period-scoped — switching the filter must not hide real drawdown.
  const lifetimeDrawdowns = useMemo(() => {
    const sorted = sortTradesChronological(trades.filter((t) => !isTradeOpen(t)));
    let equity = Number(cfg.startingBalance) || 10000;
    let peak = equity;
    const rows = [];
    for (const t of sorted) {
      equity += getTradePnL(t);
      if (equity > peak) peak = equity;
      rows.push(Number((peak - equity).toFixed(2)));
    }
    return rows;
  }, [trades, cfg.startingBalance]);

  const currentDrawdown = lifetimeDrawdowns.length ? lifetimeDrawdowns[lifetimeDrawdowns.length - 1] : 0;
  const maxDrawdown = lifetimeDrawdowns.reduce((m, r) => Math.max(m, r), 0);
  const maxDrawdownLimit = (Number(cfg.startingBalance) || 10000) * ((Number(cfg.maxDrawdownPercent) || 10) / 100);
  const drawdownUsage = maxDrawdownLimit > 0 ? Math.min(100, (currentDrawdown / maxDrawdownLimit) * 100) : 0;

  // --- Daily drawdown guardrail (0% in settings = card hidden) ---
  const dailyDdPct = Number(cfg.maxDailyDrawdownPercent) || 0;
  const showDailyDd = dailyDdPct > 0;
  const showMaxDd = (Number(cfg.maxDrawdownPercent) || 0) > 0;
  const todayKey = formatDateShort(new Date());
  // Account-wide today's figures for the Daily Drawdown card: risk monitors
  // never obey page filters, so a filtered view can't hide real danger.
  const acctToday = useMemo(() => {
    let pnl = 0;
    let count = 0;
    for (const t of trades || []) {
      if (isTradeOpen(t)) continue;
      const d = getTradeResultDate(t);
      if (!d || formatDateShort(d) !== todayKey) continue;
      pnl += getTradePnL(t);
      count += 1;
    }
    return { pnl, count };
  }, [trades, todayKey]);
  const todayPnL = acctToday.pnl;
  const todayTradeCount = acctToday.count;
  const dailyDdLimit = (Number(cfg.startingBalance) || 10000) * (dailyDdPct / 100);
  const dailyDdUsed = Math.max(0, -todayPnL);
  const dailyDdUsage = dailyDdLimit > 0 ? Math.min(100, (dailyDdUsed / dailyDdLimit) * 100) : 0;
  const dailyDdBreached = showDailyDd && dailyDdLimit > 0 && dailyDdUsed >= dailyDdLimit;
  const dailyDdHint = todayTradeCount === 0 ? 'No trades today yet' : `Today's P&L: ${fmt(todayPnL, sym, true)}`;

  // --- Prop-firm inactivity guard (0 in settings = card hidden) ---
  const inactivityLimit = Number(cfg.inactivityLimitDays ?? 30);
  const showInactivity = inactivityLimit > 0;
  const inactiveDays = getInactiveDays(trades) ?? 0;
  const inactivityUsage = inactivityLimit > 0 ? Math.min(100, (inactiveDays / inactivityLimit) * 100) : 0;
  const inactivityLeft = inactivityLimit - inactiveDays;
  const inactivityBreached = showInactivity && inactiveDays >= inactivityLimit;
  const lastActivity = getLastActivityDate(trades);
  const lastActivityLbl = lastActivity ? lastActivity.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  const hasAnyTrades = (trades || []).length > 0;
  const inactivityHint = !hasAnyTrades
    ? 'No trades yet — the clock starts on your first trade'
    : inactivityBreached
      ? `Last activity ${lastActivityLbl} · limit passed ${inactiveDays - inactivityLimit}d ago — trade to reset`
      : `Last activity ${lastActivityLbl} · ${inactivityLeft}d left — any trade resets the count`;

  const weeklyData = useMemo(() => buildWeeklySummary(scopedTrades), [scopedTrades]);
  const openCount = trades.filter((t) => isTradeOpen(t)).length;

  return (
    <div>
      <div className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><LayoutDashboard size={22} /> Command Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{PERIODS.find((p) => p.id === period)?.label}</strong> · {scopedTrades.length} trades in scope · {openCount} open
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
            onClick={onOpenFilters}
            className="ts-btn"
            title="Global filters — one filter shared by Dashboard, Analytics & Journal"
            style={{
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              padding: '7px 12px',
              fontSize: '12px',
            }}
          >
            <Filter size={12} /> Filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="ts-btn"
            title="Generate a shareable P&L image"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: 'var(--color-amber-text)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              padding: '7px 12px',
              fontSize: '12px',
            }}
          >
            <Share2 size={12} /> Share
          </button>
        </div>
      </div>

      {period === 'custom' && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', fontSize: '11px' }}>Custom range</span>
          <input type="date" className="ts-input" style={{ width: 'auto' }} value={customRange.start} max={customRange.end} onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))} aria-label="Custom range start" />
          <span>→</span>
          <input type="date" className="ts-input" style={{ width: 'auto' }} value={customRange.end} min={customRange.start} onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))} aria-label="Custom range end" />
        </div>
      )}
      <SectionTitle>Performance Overview</SectionTitle>
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <Stat label="Net P&L" value={fmt(stats.netPnL, sym, true)} color={stats.netPnL >= 0 ? 'var(--color-win)' : 'var(--color-loss)'} wash={stats.netPnL >= 0 ? 'profit' : 'loss'} />
        <Stat label="Win Rate" value={`${stats.winRate}%`} color="var(--color-sky)" />
        <Stat label="Avg Winning Trade" value={fmt(stats.avgWin, sym, true)} color="var(--color-win)" />
        <Stat label="Avg Losing Trade" value={fmt(-stats.avgLoss, sym, true)} color="var(--color-loss)" />
        <Stat label="Avg Risk / Reward" value={`1 : ${stats.avgRR}`} color="var(--color-amber-text)" />
        <Stat label="Profit Factor" value={stats.profitFactor} color="var(--color-purple)" hint="> 1.5 is strong" />
      </div>

      {(showDailyDd || showMaxDd || showInactivity) && (
        <>
          <SectionTitle>Risk Management Monitor</SectionTitle>
          {dailyDdBreached && (
            <div style={{ backgroundColor: 'rgba(255,82,82,0.12)', border: '1px solid var(--color-loss)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: 'var(--color-loss)', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TriangleAlert size={16} style={{ flexShrink: 0 }} />
              <span>DAILY LIMIT HIT — you're down {sym}{dailyDdUsed.toFixed(2)} of your {sym}{dailyDdLimit.toFixed(2)} daily limit. Step away and protect the account.</span>
            </div>
          )}
          {inactivityBreached && (
            <div style={{ backgroundColor: 'rgba(255,82,82,0.12)', border: '1px solid var(--color-loss)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', color: 'var(--color-loss)', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TriangleAlert size={16} style={{ flexShrink: 0 }} />
              <span>INACTIVITY LIMIT REACHED — no trades for {inactiveDays} days (limit {inactivityLimit}). Place any trade to reset the count and protect the account.</span>
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
                hint={`Peak drawdown recorded (all time): ${sym}${maxDrawdown.toFixed(2)}`}
              />
            )}
            {showInactivity && (
              <RiskCard
                title={`Inactivity Guard (${inactivityLimit}d limit)`}
                used={inactiveDays}
                limit={inactivityLimit}
                usagePct={inactivityUsage}
                sym={sym}
                unit="days"
                hint={inactivityHint}
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
                    <stop offset="5%" stopColor={cc.accent} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={cc.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} vertical={false} />
                <XAxis dataKey="date" stroke={cc.tick} fontSize={11} tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(v) => String(v).slice(5)} />
                <YAxis stroke={cc.tick} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${v}`} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
                <Area type="monotone" dataKey="equity" stroke={cc.accent} strokeWidth={2.5} fill="url(#eq)" />
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
            onChange={(e) => { if (e.target.value) setCalMonth(e.target.value); }}
            className="ts-input"
            style={{ width: 'auto' }}
          />
        }
      >
        Trading Activity Calendar
      </SectionTitle>
      <div className="ts-card" style={{ marginBottom: '28px' }}>
        <CalendarGrid monthStr={calMonth} dailyMap={dailyMap} sym={sym} dayTrades={dayTrades} onDayClick={(dateKey, list) => setDaySel({ dateKey, trades: list })} />
      </div>

      <SectionTitle>Performance Analytics</SectionTitle>
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <Stat label="Winning Days Rate" value={`${stats.winningDaysRate}%`} color="var(--color-sky)" />
        <Stat label="Best Trade" value={fmt(stats.bestTrade, sym, true)} color="var(--color-win)" />
        <Stat label="Worst Trade" value={fmt(stats.worstTrade, sym, true)} color="var(--color-loss)" />
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
                  <CartesianGrid strokeDasharray="3 3" stroke={cc.grid} vertical={false} />
                  <XAxis dataKey="week" stroke={cc.tick} fontSize={11} tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis stroke={cc.tick} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${v}`} />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {weeklyData.map((w, i) => (
                      <Cell key={`weekly-cell-${i}`} fill={Number(w.pnl) >= 0 ? cc.up : cc.down} />
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
        <Stat label="Largest Winning Streak" value={<span style={streakValueStyle}>{stats.longestWinStreak} <Flame size={16} /></span>} color="var(--color-win)" />
        <Stat label="Largest Losing Streak" value={<span style={streakValueStyle}>{stats.longestLossStreak} <Snowflake size={16} /></span>} color="var(--color-loss)" />
        <Stat label="Average Trade" value={fmt(stats.avgTrade, sym, true)} />
      </div>

      {shareOpen && <ShareCard trades={gTrades} settings={cfg} brandName={brandName} onClose={() => setShareOpen(false)} />}
      {daySel && <DayTradesModal dateKey={daySel.dateKey} trades={daySel.trades} sym={sym} onClose={() => setDaySel(null)} />}
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

  const chrono = sortTradesChronological(trades);
  let longestWin = 0, longestLoss = 0, curW = 0, curL = 0;
  for (const t of chrono) {
    const p = getTradePnL(t);
    if (p > 0) { curW += 1; curL = 0; longestWin = Math.max(longestWin, curW); }
    else if (p < 0) { curL += 1; curW = 0; longestLoss = Math.max(longestLoss, curL); }
  }

  const daysSet = new Set();
  const dayPnL = {};
  for (const t of trades) {
    const d = getTradeResultDate(t);
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
    const d = getTradeResultDate(t);
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

function CalendarGrid({ monthStr, dailyMap, sym, dayTrades, onDayClick }) {
  let [y, m] = (monthStr || '').split('-').map(Number);
  if (!y || !m) { const t = new Date(); y = t.getFullYear(); m = t.getMonth() + 1; }
  const year = y, month = m - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, key, data: dailyMap[key] || null, list: (dayTrades && dayTrades[key]) || [] });
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
          const clickable = !!data;
          return (
            <div key={'d' + i} className="calendar-day" title={clickable ? 'View day detail' : undefined} onClick={clickable ? () => onDayClick?.(c.key, c.list) : undefined} style={{
              minHeight: '68px', backgroundColor: bg, border: `1px solid ${border}`,
              borderRadius: '6px', padding: '6px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              ...(clickable ? { cursor: 'pointer' } : {})
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

function Stat({ label, value, color, hint, wash }) {
  // Optional P&L wash: tints the card green/red (used by the Net P&L hero stat).
  const washBg = wash === 'profit' ? 'var(--color-win-bg)' : wash === 'loss' ? 'var(--color-loss-bg)' : null;
  const washBorder = wash === 'profit' ? 'var(--color-win)' : wash === 'loss' ? 'var(--color-loss)' : null;
  return (
    <div className="ts-card" style={{ padding: '14px 16px', ...(washBg ? { backgroundColor: washBg, border: `1px solid ${washBorder}` } : {}) }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 6px 0' }}>{label}</p>
      <h2 className="number-font" style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: color || 'var(--text-bright)' }}>{value}</h2>
      {hint && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
}

function RiskCard({ title, used, limit, usagePct, sym, hint, unit }) {
  const critical = usagePct >= 80;
  const warning = usagePct >= 50 && usagePct < 80;
  const barColor = critical ? 'var(--color-loss)' : warning ? 'var(--color-amber-text)' : 'var(--color-win)';
  return (
    <div className="ts-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        <span className="number-font" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {unit ? `${used} / ${limit} ${unit}` : `${sym}${used.toFixed(2)} / ${sym}${limit.toFixed(2)}`}
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

const streakValueStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px' };