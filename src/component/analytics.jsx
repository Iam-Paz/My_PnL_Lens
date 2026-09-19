import { useState, useMemo, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import { TrendingUp, Flame, Snowflake, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  calculateDrawdown,
  calculateStreaks,
  getLatestTradeYearMonth,
  getCalendarMonthData,
  calculateSessionStats,
  calculateRMultipleStats,
} from '../utils/tradeStats';
import EmotionAnalysis from './EmotionAnalysis';
import RuleAdherence from './RuleAdherence';
import PeriodComparison from './PeriodComparison';
import KnowYourEdge from './KnowYourEdge';

const PERIODS = [
  { id: 'today', label: 'Today' }, { id: '7d', label: '7 Days' },
  { id: '30d', label: '30 Days' }, { id: '60d', label: '60 Days' },
  { id: '90d', label: '90 Days' }, { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' },
];

const CUR = { USD: '$', EUR: '€', GBP: '£', NGN: '₦' };
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseTradeDate(str) {
  if (!str) return null;
  const raw = String(str).trim();
  let d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  const normalized = raw.replace(/\./g, '-').replace(' ', 'T');
  d = new Date(normalized);
  if (!isNaN(d.getTime())) return d;
  const datePart = raw.split(/[\sT]/)[0].replace(/\./g, '-');
  d = new Date(datePart);
  return isNaN(d.getTime()) ? null : d;
}

function tradeTime(t) {
  return parseTradeDate(t.closeTime || t.openTime || t.closeAt || t.openAt);
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
    const d = tradeTime(t);
    return d && d >= start && d <= now;
  });
}

export default function Analytics({ trades = [], playbooks = [], settings }) {
  const cfg = settings || { startingBalance: 10000, currency: 'USD', brokerUtcOffset: 2 };
  const sym = CUR[cfg.currency] || '$';
  const brokerUtcOffset = cfg.brokerUtcOffset ?? 2;

  const [period, setPeriod] = useState('all');
  const [symbolSort, setSymbolSort] = useState('netPnL');

  const latestYM = useMemo(() => getLatestTradeYearMonth(trades), [trades]);
  const [calYear, setCalYear] = useState(latestYM.year);
  const [calMonth, setCalMonth] = useState(latestYM.month);

  useEffect(() => {
    setCalYear(latestYM.year);
    setCalMonth(latestYM.month);
  }, [latestYM.year, latestYM.month]);

  const scoped = useMemo(() => filterByPeriod(trades, period), [trades, period]);

  const overview = useMemo(() => computeOverview(scoped), [scoped]);
  const drawdown = useMemo(
    () => calculateDrawdown(scoped, cfg.startingBalance || 10000),
    [scoped, cfg.startingBalance]
  );
  const streaks = useMemo(() => calculateStreaks(scoped), [scoped]);
  const sessionRows = useMemo(
    () => calculateSessionStats(scoped, brokerUtcOffset),
    [scoped, brokerUtcOffset]
  );
  const rStats = useMemo(() => calculateRMultipleStats(scoped), [scoped]);

  const sessionChartData = sessionRows.map((r) => ({
    name: r.session === 'London/NY Overlap' ? 'Overlap' : r.session,
    pnl: r.pnl,
    count: r.count,
  }));

  const calendar = useMemo(
    () => getCalendarMonthData(trades, calYear, calMonth),
    [trades, calYear, calMonth]
  );

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
  const monthlyRows = useMemo(() => buildMonthly(trades), [trades]);

  const directionBarData = [
    { name: 'BUYS', pnl: Number(buySell.buys.netPnL.toFixed(2)), count: buySell.buys.count },
    { name: 'SELLS', pnl: Number(buySell.sells.netPnL.toFixed(2)), count: buySell.sells.count },
  ];

  function goPrevMonth() {
    if (calMonth === 0) {
      setCalYear((y) => y - 1);
      setCalMonth(11);
    } else setCalMonth((m) => m - 1);
  }

  function goNextMonth() {
    if (calMonth === 11) {
      setCalYear((y) => y + 1);
      setCalMonth(0);
    } else setCalMonth((m) => m + 1);
  }

  function goLatestTradeMonth() {
    setCalYear(latestYM.year);
    setCalMonth(latestYM.month);
  }

  return (
    <div>
      <div className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><TrendingUp size={22} /> Performance Analytics</h1>
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

      {/* ===== KNOW YOUR EDGE MATRIX ===== */}
      <KnowYourEdge
        trades={scoped}
        playbooks={playbooks}
        brokerUtcOffset={brokerUtcOffset}
        currency={sym}
      />

      <SectionTitle>Risk & Consistency</SectionTitle>
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '28px' }}>
        <Stat
          label="Max Drawdown"
          value={drawdown.maxDrawdownDollars > 0 ? `-${sym}${drawdown.maxDrawdownDollars.toFixed(2)}` : `${sym}0.00`}
          color="var(--color-loss)"
          hint={drawdown.maxDrawdownPercent > 0 ? `${drawdown.maxDrawdownPercent}% from peak` : 'No drawdown yet'}
        />
        <Stat
          label="Current Drawdown"
          value={drawdown.currentDrawdownDollars > 0 ? `-${sym}${drawdown.currentDrawdownDollars.toFixed(2)}` : `${sym}0.00`}
          color={drawdown.currentDrawdownDollars > 0 ? 'var(--color-loss)' : 'var(--color-win)'}
          hint={drawdown.currentDrawdownPercent > 0 ? `${drawdown.currentDrawdownPercent}% below ATH` : 'At All-Time High'}
        />
        <Stat
          label="Max Win Streak"
          value={`${streaks.maxWinStreak} trades`}
          color="var(--color-win)"
          hint={streaks.bestWinningRunPnl > 0 ? `Best run: +${sym}${streaks.bestWinningRunPnl.toFixed(2)}` : undefined}
        />
        <Stat
          label="Max Loss Streak"
          value={`${streaks.maxLossStreak} trades`}
          color="var(--color-loss)"
          hint={streaks.worstLosingRunPnl < 0 ? `Worst run: -${sym}${Math.abs(streaks.worstLosingRunPnl).toFixed(2)}` : undefined}
        />
        <Stat
          label="Current Streak"
          value={
            streaks.currentStreakType === 'win'
              ? (<span style={streakValueStyle}>{streaks.currentStreakCount} Wins <Flame size={18} /></span>)
              : streaks.currentStreakType === 'loss'
              ? (<span style={streakValueStyle}>{streaks.currentStreakCount} Losses <Snowflake size={18} /></span>)
              : 'None'
          }
          color={
            streaks.currentStreakType === 'win'
              ? 'var(--color-win)'
              : streaks.currentStreakType === 'loss'
              ? 'var(--color-loss)'
              : 'var(--text-secondary)'
          }
        />
      </div>

      {/* ===== R-MULTIPLE & RISK ===== */}
      <SectionTitle>R-Multiple & Risk</SectionTitle>
      <div className="metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '12px' }}>
        <Stat
          label="Trades with SL"
          value={`${rStats.countWithR}`}
          color="#a78bfa"
          hint={scoped.length ? `of ${scoped.length} in scope` : 'No trades'}
        />
        <Stat
          label="Average R"
          value={rStats.countWithR ? `${rStats.avgR >= 0 ? '+' : ''}${rStats.avgR}R` : '—'}
          color={rStats.avgR >= 0 ? 'var(--color-win)' : 'var(--color-loss)'}
          hint={rStats.countWithR ? `Total ${rStats.totalR >= 0 ? '+' : ''}${rStats.totalR}R` : 'Need entry, exit & SL'}
        />
        <Stat
          label="Best R"
          value={rStats.countWithR ? `+${rStats.bestR}R` : '—'}
          color="var(--color-win)"
        />
        <Stat
          label="Worst R"
          value={rStats.countWithR ? `${rStats.worstR}R` : '—'}
          color="var(--color-loss)"
        />
        <Stat
          label="Reached ≥ 1R"
          value={rStats.countWithR ? `${rStats.pct1R}%` : '—'}
          color="#38bdf8"
        />
        <Stat
          label="Reached ≥ 2R"
          value={rStats.countWithR ? `${rStats.pct2R}%` : '—'}
          color="#38bdf8"
        />
        <Stat
          label="Reached ≥ 3R"
          value={rStats.countWithR ? `${rStats.pct3R}%` : '—'}
          color="#38bdf8"
        />
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 0, marginBottom: '28px' }}>
        R uses price distance only: (exit − entry) ÷ |entry − stop| for buys (mirrored for sells).
        Trades missing stop loss are excluded so averages stay honest.
      </p>

      {/* ===== EMOTION & MINDSET PERFORMANCE ===== */}
      <SectionTitle>Behavioral Insights</SectionTitle>
      <EmotionAnalysis trades={scoped} />

      {/* ===== PLAYBOOK RULE ADHERENCE ===== */}
      <SectionTitle>Execution Discipline</SectionTitle>
      <RuleAdherence trades={scoped} playbooks={playbooks} />

      {/* ===== SESSION EDGE ===== */}
      <SectionTitle>
        Session Edge
        <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, marginLeft: 8, color: 'var(--text-muted)' }}>
          (broker UTC{brokerUtcOffset >= 0 ? '+' : ''}{brokerUtcOffset} · by entry time)
        </span>
      </SectionTitle>
      <div className="ts-card" style={{ marginBottom: '28px', padding: '16px' }}>
        <div style={{ height: '200px', marginBottom: '20px' }}>
          {sessionRows.every((r) => r.count === 0) ? (
            <EmptyMsg />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sessionChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${sym}${v}`} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} />
                <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                  {sessionChartData.map((s, i) => (
                    <Cell key={i} fill={s.pnl >= 0 ? '#38bdf8' : '#ff5252'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ts-table">
            <thead>
              <tr>
                <th>Session</th>
                <th className="num">Trades</th>
                <th className="num">Win %</th>
                <th className="num">Net P&L</th>
                <th className="num">PF</th>
                <th className="num">Expectancy</th>
              </tr>
            </thead>
            <tbody>
              {sessionRows.map((r) => (
                <tr key={r.session}>
                  <td style={{ fontWeight: 700 }}>{r.session}</td>
                  <td className="num number-font">{r.count}</td>
                  <td className="num number-font" style={{ color: '#38bdf8' }}>{r.winRate}%</td>
                  <td className="num number-font" style={{ fontWeight: 700, color: r.pnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                    {fmt(r.pnl, sym, true)}
                  </td>
                  <td className="num number-font">{r.pf}</td>
                  <td className="num number-font" style={{ fontWeight: 700, color: r.expectancy >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                    {fmt(r.expectancy, sym, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== PERIOD COMPARISON ===== */}
      <SectionTitle>Comparative Analysis</SectionTitle>
      <PeriodComparison trades={trades} startingBalance={cfg.startingBalance} currency={sym} />

      {/* ===== TRADING CALENDAR ===== */}
      <SectionTitle>Trading Calendar · All Time</SectionTitle>
      <div className="ts-card" style={{ marginBottom: '28px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button type="button" className="ts-btn" onClick={goPrevMonth} style={calNavBtn}><ChevronLeft size={14} /></button>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, minWidth: '160px', textAlign: 'center' }}>
              {MONTH_NAMES[calendar.month]} {calendar.year}
            </h3>
            <button type="button" className="ts-btn" onClick={goNextMonth} style={calNavBtn}><ChevronRight size={14} /></button>
            <button type="button" className="ts-btn" onClick={goLatestTradeMonth} style={{ ...calNavBtn, padding: '6px 10px', fontSize: '11px' }}>
              Latest
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '12px' }}>
            <span style={calChip}>P&L <strong style={{ color: calendar.monthPnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>{fmt(calendar.monthPnl, sym, true)}</strong></span>
            <span style={calChip}>Trades <strong>{calendar.monthTrades}</strong></span>
            <span style={calChip}>Win <strong style={{ color: '#38bdf8' }}>{calendar.monthWinRate}%</strong></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
          {WEEKDAYS.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {calendar.days.map((cell) => {
            if (cell.type === 'empty') return <div key={cell.key} style={{ minHeight: '72px' }} />;
            const isWin = cell.hasTrades && cell.pnl > 0;
            const isLoss = cell.hasTrades && cell.pnl < 0;
            const isFlat = cell.hasTrades && cell.pnl === 0;
            let bg = 'var(--bg-main)';
            let border = '1px solid var(--border-color)';
            if (isWin) { bg = 'rgba(0, 230, 118, 0.12)'; border = '1px solid rgba(0, 230, 118, 0.35)'; }
            else if (isLoss) { bg = 'rgba(255, 82, 82, 0.12)'; border = '1px solid rgba(255, 82, 82, 0.35)'; }
            else if (isFlat) { bg = 'rgba(148, 163, 184, 0.08)'; }

            return (
              <div
                key={cell.dateKey}
                title={cell.hasTrades ? `${cell.dateKey} · ${fmt(cell.pnl, sym, true)} · ${cell.count} trades` : cell.dateKey}
                style={{ minHeight: '72px', borderRadius: '8px', border, background: bg, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)' }}>{cell.dayNumber}</div>
                {cell.hasTrades ? (
                  <>
                    <div className="number-font" style={{ fontSize: '12px', fontWeight: 700, color: isWin ? 'var(--color-win)' : isLoss ? 'var(--color-loss)' : 'var(--text-secondary)' }}>
                      {fmt(cell.pnl, sym, true)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{cell.count}t</div>
                  </>
                ) : (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 'auto' }}>—</div>
                )}
              </div>
            );
          })}
        </div>
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

      <SectionTitle>Daily P&L</SectionTitle>
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

      <SectionTitle>Monthly Breakdown · All Time</SectionTitle>
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
  const wins = trades.filter((t) => Number(t.profit ?? t.pnl) > 0);
  const losses = trades.filter((t) => Number(t.profit ?? t.pnl) < 0);
  const grossProfit = wins.reduce((s, t) => s + Number(t.profit ?? t.pnl), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + Number(t.profit ?? t.pnl), 0));
  const netPnL = grossProfit - grossLoss;
  const winRate = total ? ((wins.length / total) * 100).toFixed(1) : '0.0';
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const pf = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : grossProfit > 0 ? '∞' : '0.00';
  const expectancy = total ? (wins.length / total) * avgWin - (losses.length / total) * avgLoss : 0;
  return { total, netPnL, winRate, avgWin, avgLoss, pf, expectancy };
}

function buildCumulative(trades) {
  const sorted = [...trades].sort((a, b) => (tradeTime(a)?.getTime() || 0) - (tradeTime(b)?.getTime() || 0));
  let cum = 0;
  return sorted.map((t, i) => {
    cum += Number(t.profit ?? t.pnl) || 0;
    const d = tradeTime(t);
    return { date: d ? ymd(d) : `#${i + 1}`, cumulative: Number(cum.toFixed(2)) };
  });
}

function buildDaily(trades) {
  const m = {};
  for (const t of trades) {
    const d = tradeTime(t);
    if (!d) continue;
    const k = ymd(d);
    if (!m[k]) m[k] = { pnl: 0, count: 0 };
    m[k].pnl += Number(t.profit ?? t.pnl) || 0;
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
    const wins = list.filter((x) => Number(x.profit ?? x.pnl) > 0);
    const losses = list.filter((x) => Number(x.profit ?? x.pnl) < 0);
    const gp = wins.reduce((s, x) => s + Number(x.profit ?? x.pnl), 0);
    const gl = Math.abs(losses.reduce((s, x) => s + Number(x.profit ?? x.pnl), 0));
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
  const buys = trades.filter((t) => {
    const s = String(t.type || t.direction || '').toLowerCase();
    return s.includes('buy') || s.includes('long');
  });
  const sells = trades.filter((t) => {
    const s = String(t.type || t.direction || '').toLowerCase();
    return s.includes('sell') || s.includes('short');
  });
  const calc = (arr) => {
    const gp = arr.filter((x) => Number(x.profit ?? x.pnl) > 0).reduce((s, x) => s + Number(x.profit ?? x.pnl), 0);
    const gl = Math.abs(arr.filter((x) => Number(x.profit ?? x.pnl) < 0).reduce((s, x) => s + Number(x.profit ?? x.pnl), 0));
    return {
      count: arr.length,
      netPnL: gp - gl,
      winRate: arr.length
        ? ((arr.filter((x) => Number(x.profit ?? x.pnl) > 0).length / arr.length) * 100).toFixed(1)
        : '0.0',
    };
  };
  return { buys: calc(buys), sells: calc(sells) };
}

function buildDow(trades) {
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const arr = names.map((n) => ({ day: n, count: 0, pnl: 0, wins: 0 }));
  for (const t of trades) {
    const d = tradeTime(t);
    if (!d) continue;
    const idx = d.getDay();
    arr[idx].count += 1;
    arr[idx].pnl += Number(t.profit ?? t.pnl) || 0;
    if (Number(t.profit ?? t.pnl) > 0) arr[idx].wins += 1;
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
    const d = tradeTime(t);
    if (!d) continue;
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!m[k]) m[k] = { pnl: 0, count: 0, wins: 0 };
    m[k].pnl += Number(t.profit ?? t.pnl) || 0;
    m[k].count += 1;
    if (Number(t.profit ?? t.pnl) > 0) m[k].wins += 1;
  }
  return Object.entries(m)
    .sort((a, b) => b[0].localeCompare(a[0]))
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
const streakValueStyle = { display: 'inline-flex', alignItems: 'center', gap: '6px' };
const calNavBtn = {
  backgroundColor: 'var(--bg-main)',
  color: 'var(--text-primary, #fff)',
  border: '1px solid var(--border-color)',
  padding: '6px 12px',
  fontSize: '13px',
  cursor: 'pointer',
  borderRadius: '8px',
};
const calChip = {
  backgroundColor: 'var(--bg-main)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  padding: '6px 10px',
  color: 'var(--text-secondary)',
};