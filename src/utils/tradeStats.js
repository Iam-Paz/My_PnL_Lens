/**
 * Utility functions for PazPnL Trade Analytics
 */

export function parseTimestamp(str) {
  if (!str) return 0;
  const raw = String(str).trim();

  let time = new Date(raw).getTime();
  if (!isNaN(time)) return time;

  const normalized = raw.replace(/\./g, '-').replace(' ', 'T');
  time = new Date(normalized).getTime();
  if (!isNaN(time)) return time;

  const datePart = raw.split(/[\sT]/)[0].replace(/\./g, '-');
  time = new Date(datePart).getTime();
  return isNaN(time) ? 0 : time;
}

function extractDateTimeParts(str) {
  if (!str) return null;
  const raw = String(str).trim();
  const match = raw.match(
    /(\d{4})[.-](\d{2})[.-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
    hour: match[4] != null ? Number(match[4]) : 0,
    minute: match[5] != null ? Number(match[5]) : 0,
    second: match[6] != null ? Number(match[6]) : 0,
  };
}

export function sortTradesChronological(trades) {
  return [...trades].sort((a, b) => {
    const timeA = parseTimestamp(a.closeTime || a.openTime || a.closeAt || a.openAt);
    const timeB = parseTimestamp(b.closeTime || b.openTime || b.closeAt || b.openAt);
    return timeA - timeB;
  });
}

export function calculateDrawdown(trades, startingBalance = 10000) {
  if (!trades || trades.length === 0) {
    return {
      maxDrawdownDollars: 0,
      maxDrawdownPercent: 0,
      currentDrawdownDollars: 0,
      currentDrawdownPercent: 0,
      peakEquity: startingBalance,
      currentEquity: startingBalance,
    };
  }

  const sorted = sortTradesChronological(trades);
  let currentEquity = startingBalance;
  let peakEquity = startingBalance;
  let maxDdDollars = 0;
  let maxDdPercent = 0;

  for (const trade of sorted) {
    const pnl = Number(trade.profit ?? trade.pnl) || 0;
    currentEquity += pnl;
    if (currentEquity > peakEquity) peakEquity = currentEquity;
    const ddDollars = peakEquity - currentEquity;
    const ddPercent = peakEquity > 0 ? (ddDollars / peakEquity) * 100 : 0;
    if (ddDollars > maxDdDollars) maxDdDollars = ddDollars;
    if (ddPercent > maxDdPercent) maxDdPercent = ddPercent;
  }

  const currentDdDollars = peakEquity - currentEquity;
  const currentDdPercent = peakEquity > 0 ? (currentDdDollars / peakEquity) * 100 : 0;

  return {
    maxDrawdownDollars: Number(maxDdDollars.toFixed(2)),
    maxDrawdownPercent: Number(maxDdPercent.toFixed(2)),
    currentDrawdownDollars: Number(currentDdDollars.toFixed(2)),
    currentDrawdownPercent: Number(currentDdPercent.toFixed(2)),
    peakEquity: Number(peakEquity.toFixed(2)),
    currentEquity: Number(currentEquity.toFixed(2)),
  };
}

export function calculateStreaks(trades) {
  if (!trades || trades.length === 0) {
    return {
      maxWinStreak: 0,
      maxLossStreak: 0,
      currentStreakType: 'none',
      currentStreakCount: 0,
      bestWinningRunPnl: 0,
      worstLosingRunPnl: 0,
    };
  }

  const sorted = sortTradesChronological(trades);
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let currentRunPnl = 0;
  let bestWinningRunPnl = 0;
  let worstLosingRunPnl = 0;

  for (const trade of sorted) {
    const pnl = Number(trade.profit ?? trade.pnl) || 0;
    if (pnl > 0) {
      currentWinStreak += 1;
      currentLossStreak = 0;
      currentRunPnl = (currentRunPnl > 0 ? currentRunPnl : 0) + pnl;
      if (currentRunPnl > bestWinningRunPnl) bestWinningRunPnl = currentRunPnl;
    } else if (pnl < 0) {
      currentLossStreak += 1;
      currentWinStreak = 0;
      currentRunPnl = (currentRunPnl < 0 ? currentRunPnl : 0) + pnl;
      if (currentRunPnl < worstLosingRunPnl) worstLosingRunPnl = currentRunPnl;
    }
    if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
  }

  let currentStreakType = 'none';
  let currentStreakCount = 0;
  if (currentWinStreak > 0) {
    currentStreakType = 'win';
    currentStreakCount = currentWinStreak;
  } else if (currentLossStreak > 0) {
    currentStreakType = 'loss';
    currentStreakCount = currentLossStreak;
  }

  return {
    maxWinStreak,
    maxLossStreak,
    currentStreakType,
    currentStreakCount,
    bestWinningRunPnl: Number(bestWinningRunPnl.toFixed(2)),
    worstLosingRunPnl: Number(worstLosingRunPnl.toFixed(2)),
  };
}

export function getLatestTradeYearMonth(trades) {
  if (!trades || trades.length === 0) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  const sorted = sortTradesChronological(trades);
  const latestTrade = sorted[sorted.length - 1];
  const time = parseTimestamp(
    latestTrade.closeTime || latestTrade.openTime || latestTrade.closeAt || latestTrade.openAt
  );
  const d = time ? new Date(time) : new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function getCalendarMonthData(trades, year, month) {
  const dailyMap = {};
  for (const trade of trades || []) {
    const time = parseTimestamp(
      trade.closeTime || trade.openTime || trade.closeAt || trade.openAt
    );
    if (!time) continue;
    const d = new Date(time);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { pnl: 0, count: 0, wins: 0 };
    const pnl = Number(trade.profit ?? trade.pnl) || 0;
    dailyMap[dateKey].pnl += pnl;
    dailyMap[dateKey].count += 1;
    if (pnl > 0) dailyMap[dateKey].wins += 1;
  }

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6;

  const days = [];
  let monthPnl = 0;
  let monthTrades = 0;
  let monthWins = 0;

  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push({ type: 'empty', key: `empty-${i}` });
  }

  for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayData = dailyMap[dateKey] || { pnl: 0, count: 0, wins: 0 };
    monthPnl += dayData.pnl;
    monthTrades += dayData.count;
    monthWins += dayData.wins;
    days.push({
      type: 'day',
      dayNumber: dayNum,
      dateKey,
      pnl: Number(dayData.pnl.toFixed(2)),
      count: dayData.count,
      hasTrades: dayData.count > 0,
    });
  }

  return {
    year,
    month,
    days,
    monthPnl: Number(monthPnl.toFixed(2)),
    monthTrades,
    monthWinRate: monthTrades > 0 ? ((monthWins / monthTrades) * 100).toFixed(1) : '0.0',
  };
}

export function formatToLocalTime(str, brokerUtcOffset = 2) {
  if (!str) return '—';
  const raw = String(str).trim();
  const pad = (n) => String(n).padStart(2, '0');
  const parts = extractDateTimeParts(raw);

  if (!parts) {
    const fallback = new Date(raw);
    if (isNaN(fallback.getTime())) return raw;
    return `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())} ${pad(fallback.getHours())}:${pad(fallback.getMinutes())}`;
  }

  const utcMs = Date.UTC(
    parts.year,
    parts.month,
    parts.day,
    parts.hour - Number(brokerUtcOffset || 0),
    parts.minute,
    parts.second
  );
  const localDate = new Date(utcMs);
  if (isNaN(localDate.getTime())) return raw;

  return `${localDate.getFullYear()}-${pad(localDate.getMonth() + 1)}-${pad(localDate.getDate())} ${pad(localDate.getHours())}:${pad(localDate.getMinutes())}`;
}

export function getTradeSession(timestampStr, brokerUtcOffsetHours = 2) {
  const parts = extractDateTimeParts(timestampStr);
  if (!parts) return 'Off-Hours';

  let utcHour = parts.hour - Number(brokerUtcOffsetHours || 0);
  if (utcHour < 0) utcHour += 24;
  if (utcHour >= 24) utcHour -= 24;

  if (utcHour >= 0 && utcHour < 8) return 'Asia';
  if (utcHour >= 8 && utcHour < 13) return 'London';
  if (utcHour >= 13 && utcHour < 16) return 'London/NY Overlap';
  if (utcHour >= 16 && utcHour < 21) return 'New York';
  return 'Off-Hours';
}

export function calculateSessionStats(trades, brokerUtcOffsetHours = 2) {
  const SESSIONS = ['Asia', 'London', 'London/NY Overlap', 'New York', 'Off-Hours'];
  const buckets = {};
  for (const s of SESSIONS) {
    buckets[s] = { name: s, count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 };
  }

  for (const t of trades || []) {
    const timeStr = t.openTime || t.openAt || t.closeTime || t.closeAt;
    const session = getTradeSession(timeStr, brokerUtcOffsetHours);
    if (!buckets[session]) continue;

    const pnl = Number(t.profit ?? t.pnl) || 0;
    buckets[session].count += 1;
    buckets[session].pnl += pnl;
    if (pnl > 0) {
      buckets[session].wins += 1;
      buckets[session].grossProfit += pnl;
    } else if (pnl < 0) {
      buckets[session].grossLoss += Math.abs(pnl);
    }
  }

  return SESSIONS.map((name) => {
    const b = buckets[name];
    const winRate = b.count > 0 ? ((b.wins / b.count) * 100).toFixed(1) : '0.0';
    const avgWin = b.wins > 0 ? b.grossProfit / b.wins : 0;
    const lossCount = b.count - b.wins;
    const avgLoss = lossCount > 0 ? b.grossLoss / lossCount : 0;
    const pf =
      b.grossLoss > 0
        ? (b.grossProfit / b.grossLoss).toFixed(2)
        : b.grossProfit > 0
        ? '∞'
        : '0.00';
    const expectancy =
      b.count > 0 ? (b.wins / b.count) * avgWin - (lossCount / b.count) * avgLoss : 0;

    return {
      session: name,
      count: b.count,
      winRate,
      pnl: Number(b.pnl.toFixed(2)),
      pf,
      expectancy: Number(expectancy.toFixed(2)),
    };
  });
}

/**
 * Calculates R-Multiple analytics (Average R, Best R, Worst R, Win % at 1R/2R/3R).
 */
export function calculateRMultipleStats(trades) {
  let totalR = 0;
  let countWithR = 0;
  let bestR = -Infinity;
  let worstR = Infinity;

  let reached1R = 0;
  let reached2R = 0;
  let reached3R = 0;

  for (const t of trades || []) {
    const entry = Number(t.entryPrice);
    const exit = Number(t.exitPrice);
    const sl = Number(t.stopLoss);
    const dir = String(t.type || t.direction || '').toLowerCase();

    if (!sl || !entry || !exit || sl === entry) continue;

    const riskDist = Math.abs(entry - sl);
    if (riskDist === 0) continue;

    const isBuy = dir.includes('buy') || dir.includes('long');
    const rewardDist = isBuy ? (exit - entry) : (entry - exit);
    const rMultiple = rewardDist / riskDist;

    totalR += rMultiple;
    countWithR += 1;

    if (rMultiple > bestR) bestR = rMultiple;
    if (rMultiple < worstR) worstR = rMultiple;

    if (rMultiple >= 1.0) reached1R += 1;
    if (rMultiple >= 2.0) reached2R += 1;
    if (rMultiple >= 3.0) reached3R += 1;
  }

  const avgR = countWithR > 0 ? totalR / countWithR : 0;
  const pct1R = countWithR > 0 ? ((reached1R / countWithR) * 100).toFixed(1) : '0.0';
  const pct2R = countWithR > 0 ? ((reached2R / countWithR) * 100).toFixed(1) : '0.0';
  const pct3R = countWithR > 0 ? ((reached3R / countWithR) * 100).toFixed(1) : '0.0';

  return {
    countWithR,
    totalR: Number(totalR.toFixed(2)),
    avgR: Number(avgR.toFixed(2)),
    bestR: bestR === -Infinity ? 0 : Number(bestR.toFixed(2)),
    worstR: worstR === Infinity ? 0 : Number(worstR.toFixed(2)),
    pct1R,
    pct2R,
    pct3R,
  };
}
/**
 * Calculates R-multiple for an individual trade based on entry, exit, stop loss, and direction.
 * Returns null if required price data is missing or invalid.
 */
export function calculateTradeR(trade) {
  if (!trade) return null;
  const entry = Number(trade.entryPrice);
  const exit = Number(trade.exitPrice);
  const sl = Number(trade.stopLoss);
  const dir = String(trade.type || trade.direction || '').toLowerCase();

  if (!sl || !entry || !exit || sl === entry) return null;

  const riskDist = Math.abs(entry - sl);
  if (riskDist === 0) return null;

  const isBuy = dir.includes('buy') || dir.includes('long');
  const rewardDist = isBuy ? (exit - entry) : (entry - exit);
  return rewardDist / riskDist;
}

/**
 * Universal trade statistics calculator.
 * Computes complete performance & risk metrics for any array of trades.
 */
export function calculateTradeStats(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const count = safeTrades.length;

  if (count === 0) {
    return {
      count: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      lossRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      netPnL: 0,
      avgWin: 0,
      avgLoss: 0,
      avgTrade: 0,
      profitFactor: 0,
      expectancy: 0,
      bestTradePnl: 0,
      worstTradePnl: 0,
      avgR: 0,
      bestR: 0,
      worstR: 0,
      countWithR: 0,
    };
  }

  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let netPnL = 0;
  let bestTradePnl = -Infinity;
  let worstTradePnl = Infinity;

  let totalR = 0;
  let countWithR = 0;
  let bestR = -Infinity;
  let worstR = Infinity;

  for (const t of safeTrades) {
    const pnl = Number(t.profit ?? t.pnl) || 0;
    netPnL += pnl;

    if (pnl > 0) {
      wins += 1;
      grossProfit += pnl;
    } else if (pnl < 0) {
      losses += 1;
      grossLoss += Math.abs(pnl);
    } else {
      breakevens += 1;
    }

    if (pnl > bestTradePnl) bestTradePnl = pnl;
    if (pnl < worstTradePnl) worstTradePnl = pnl;

    const r = calculateTradeR(t);
    if (r !== null && !isNaN(r)) {
      totalR += r;
      countWithR += 1;
      if (r > bestR) bestR = r;
      if (r < worstR) worstR = r;
    }
  }

  const winRate = count > 0 ? (wins / count) * 100 : 0;
  const lossRate = count > 0 ? (losses / count) * 100 : 0;
  const avgWin = wins > 0 ? grossProfit / wins : 0;
  const avgLoss = losses > 0 ? grossLoss / losses : 0;
  const avgTrade = count > 0 ? netPnL / count : 0;

  // Profit Factor: grossProfit / grossLoss (or '∞' if profitable with 0 losses)
  let profitFactor;
  if (grossLoss > 0) {
    profitFactor = Number((grossProfit / grossLoss).toFixed(2));
  } else if (grossProfit > 0) {
    profitFactor = '∞';
  } else {
    profitFactor = 0;
  }

  // Expectancy ($ per trade) = (Win% * AvgWin) - (Loss% * AvgLoss)
  const expectancy = (winRate / 100) * avgWin - (lossRate / 100) * avgLoss;
  const avgR = countWithR > 0 ? totalR / countWithR : 0;

  return {
    count,
    wins,
    losses,
    breakevens,
    winRate: Number(winRate.toFixed(1)),
    lossRate: Number(lossRate.toFixed(1)),
    grossProfit: Number(grossProfit.toFixed(2)),
    grossLoss: Number(grossLoss.toFixed(2)),
    netPnL: Number(netPnL.toFixed(2)),
    avgWin: Number(avgWin.toFixed(2)),
    avgLoss: Number(avgLoss.toFixed(2)),
    avgTrade: Number(avgTrade.toFixed(2)),
    profitFactor,
    expectancy: Number(expectancy.toFixed(2)),
    bestTradePnl: bestTradePnl === -Infinity ? 0 : Number(bestTradePnl.toFixed(2)),
    worstTradePnl: worstTradePnl === Infinity ? 0 : Number(worstTradePnl.toFixed(2)),
    avgR: Number(avgR.toFixed(2)),
    bestR: bestR === -Infinity ? 0 : Number(bestR.toFixed(2)),
    worstR: worstR === Infinity ? 0 : Number(worstR.toFixed(2)),
    countWithR,
  };
}
/**
 * Calculates deterministic performance metrics grouped by emotion tags.
 * Supports trade.emotion (string) and trade.emotions (array/string).
 */
export function calculateEmotionStats(trades = []) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  if (safeTrades.length === 0) return [];

  const emotionGroups = {};

  for (const t of safeTrades) {
    let tags = [];

    if (Array.isArray(t.emotions)) {
      tags = t.emotions.map((e) => String(e).trim()).filter(Boolean);
    } else if (typeof t.emotions === 'string' && t.emotions.trim() !== '') {
      tags = t.emotions.split(',').map((e) => e.trim()).filter(Boolean);
    } else if (typeof t.emotion === 'string' && t.emotion.trim() !== '') {
      tags = t.emotion.split(',').map((e) => e.trim()).filter(Boolean);
    }

    // If no emotion tag exists on the trade
    if (tags.length === 0) {
      tags = ['Untagged'];
    }

    for (const tag of tags) {
      if (!emotionGroups[tag]) {
        emotionGroups[tag] = [];
      }
      emotionGroups[tag].push(t);
    }
  }

  return Object.entries(emotionGroups).map(([emotion, list]) => {
    const stats = calculateTradeStats(list);
    return {
      emotion,
      ...stats,
      isLowSample: stats.count > 0 && stats.count < 5,
    };
  });
}
/**
 * Compares performance of trades that perfectly adhered to playbook rules
 * versus trades that violated or skipped at least one rule.
 */
export function calculateRuleAdherenceStats(trades = [], playbooks = []) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  const safePlaybooks = Array.isArray(playbooks) ? playbooks : [];

  const perfectTrades = [];
  const imperfectTrades = [];

  for (const t of safeTrades) {
    // Find the playbook assigned to this trade
    const pb = safePlaybooks.find((p) => p.title === t.setup);
    
    // If trade is Untagged, or playbook has no rules defined, ignore for this metric
    if (!pb || !pb.rules || pb.rules.length === 0) {
      continue;
    }

    const pbRules = pb.rules.filter((r) => r.trim() !== '');
    if (pbRules.length === 0) {
      continue;
    }

    const checked = Array.isArray(t.rulesChecked) ? t.rulesChecked : [];
    
    // Check if every single playbook rule is present in the trade's checked rules list
    const followedAll = pbRules.every((rule) => checked.includes(rule));

    if (followedAll) {
      perfectTrades.push(t);
    } else {
      imperfectTrades.push(t);
    }
  }

  return {
    perfect: {
      label: 'Perfect Adherence (Followed All Rules)',
      ...calculateTradeStats(perfectTrades),
    },
    imperfect: {
      label: 'Imperfect Adherence (Violated/Skipped Rules)',
      ...calculateTradeStats(imperfectTrades),
    },
  };
}
/**
 * Analyzes trade performance across multiple dimensions:
 * Playbook, Session, Direction, Day of Week, Symbol, Emotion, and Rule Adherence.
 */
export function calculateEdgeMatrix(trades = [], playbooks = [], brokerUtcOffsetHours = 2) {
  const safeTrades = Array.isArray(trades) ? trades : [];
  if (safeTrades.length === 0) return [];

  const dimensions = [];

  // Helper to push dimension groups
  const addGroup = (dimensionName, categoryValue, tradeList) => {
    if (!categoryValue || categoryValue === 'Untagged' || categoryValue === 'UNKNOWN') return;
    const stats = calculateTradeStats(tradeList);
    if (stats.count === 0) return;

    dimensions.push({
      dimension: dimensionName,
      condition: categoryValue,
      ...stats,
      isLowSample: stats.count < 5,
    });
  };

  // 1. Playbook / Setup
  const setupMap = {};
  for (const t of safeTrades) {
    const s = t.setup || 'Untagged';
    if (!setupMap[s]) setupMap[s] = [];
    setupMap[s].push(t);
  }
  for (const [setup, list] of Object.entries(setupMap)) {
    addGroup('Setup / Playbook', setup, list);
  }

  // 2. Trading Session
  const sessionMap = {};
  for (const t of safeTrades) {
    const timeStr = t.openTime || t.openAt || t.closeTime || t.closeAt;
    const session = getTradeSession(timeStr, brokerUtcOffsetHours);
    if (!sessionMap[session]) sessionMap[session] = [];
    sessionMap[session].push(t);
  }
  for (const [session, list] of Object.entries(sessionMap)) {
    addGroup('Session', session, list);
  }

  // 3. Direction (Long vs Short)
  const dirMap = { 'Long (Buys)': [], 'Short (Sells)': [] };
  for (const t of safeTrades) {
    const dir = String(t.type || t.direction || '').toLowerCase();
    if (dir.includes('buy') || dir.includes('long')) dirMap['Long (Buys)'].push(t);
    else if (dir.includes('sell') || dir.includes('short')) dirMap['Short (Sells)'].push(t);
  }
  for (const [dir, list] of Object.entries(dirMap)) {
    if (list.length > 0) addGroup('Direction', dir, list);
  }

  // 4. Day of the Week
  const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dowMap = {};
  for (const t of safeTrades) {
    const time = parseTimestamp(t.closeTime || t.openTime || t.closeAt || t.openAt);
    if (!time) continue;
    const day = DOW_NAMES[new Date(time).getDay()];
    if (!dowMap[day]) dowMap[day] = [];
    dowMap[day].push(t);
  }
  for (const [day, list] of Object.entries(dowMap)) {
    addGroup('Day of Week', day, list);
  }

  // 5. Symbol
  const symbolMap = {};
  for (const t of safeTrades) {
    const sym = t.symbol || 'UNKNOWN';
    if (!symbolMap[sym]) symbolMap[sym] = [];
    symbolMap[sym].push(t);
  }
  for (const [sym, list] of Object.entries(symbolMap)) {
    addGroup('Symbol', sym, list);
  }

  // 6. Emotion
  const emotionMap = {};
  for (const t of safeTrades) {
    let tags = [];
    if (Array.isArray(t.emotions)) tags = t.emotions;
    else if (typeof t.emotions === 'string') tags = t.emotions.split(',');
    else if (typeof t.emotion === 'string') tags = t.emotion.split(',');
    tags = tags.map((e) => String(e).trim()).filter(Boolean);

    for (const tag of tags) {
      if (!emotionMap[tag]) emotionMap[tag] = [];
      emotionMap[tag].push(t);
    }
  }
  for (const [emotion, list] of Object.entries(emotionMap)) {
    addGroup('Emotion / Mindset', emotion, list);
  }

  // 7. Rule Adherence
  const adhered = [];
  const violated = [];
  for (const t of safeTrades) {
    const pb = (playbooks || []).find((p) => p.title === t.setup);
    if (!pb || !pb.rules || pb.rules.length === 0) continue;
    const cleanRules = pb.rules.filter((r) => r.trim() !== '');
    if (cleanRules.length === 0) continue;

    const checked = Array.isArray(t.rulesChecked) ? t.rulesChecked : [];
    const followedAll = cleanRules.every((r) => checked.includes(r));
    if (followedAll) adhered.push(t);
    else violated.push(t);
  }
  if (adhered.length > 0) addGroup('Rule Adherence', 'Followed All Rules', adhered);
  if (violated.length > 0) addGroup('Rule Adherence', 'Skipped/Broken Rules', violated);

  return dimensions;
}