/**
 * Robust MT5 CSV parser with dynamic header detection + positional fallback.
 */

export function parseRawCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentToken = '';
  let inQuotes = false;

  const sample = text.slice(0, 2000);
  let delimiter = ',';
  if ((sample.match(/\t/g) || []).length > (sample.match(/,/g) || []).length) delimiter = '\t';
  else if ((sample.match(/;/g) || []).length > (sample.match(/,/g) || []).length) delimiter = ';';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentToken += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentToken.trim());
      currentToken = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentToken.trim());
      if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
      currentRow = [];
      currentToken = '';
    } else {
      currentToken += char;
    }
  }

  if (currentToken || currentRow.length > 0) {
    currentRow.push(currentToken.trim());
    if (currentRow.some((c) => c.length > 0)) rows.push(currentRow);
  }

  return rows;
}

function parseNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  let s = String(val).trim();
  if (!s) return 0;
  s = s.replace(/\s+/g, '').replace(/\$/g, '');
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function parseMT5Date(dateStr) {
  if (!dateStr) return null;
  let s = String(dateStr).trim();
  if (!s) return null;
  s = s.replace(/\//g, '-');

  const m = s.match(
    /^(\d{4})[.-](\d{2})[.-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (m) {
    const [, y, mo, d, hh = '00', mm = '00', ss = '00'] = m;
    const dt = new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}`);
    return isNaN(dt.getTime()) ? null : dt.toISOString();
  }

  const dt2 = new Date(s.replace(/\./g, '-').replace(' ', 'T'));
  return isNaN(dt2.getTime()) ? null : dt2.toISOString();
}

function looksLikeSymbol(v) {
  const s = String(v || '').trim();
  if (!s) return false;
  if (/^-?\d+(\.\d+)?$/.test(s)) return false;
  if (/^\d{4}[-./]\d{2}[-./]\d{2}/.test(s)) return false;
  const lower = s.toLowerCase();
  if (['buy', 'sell', 'balance', 'credit', 'buy limit', 'sell limit'].includes(lower)) return false;
  return /[a-zA-Z]/.test(s);
}

function buildTrade({
  ticket,
  openRaw,
  closeRaw,
  symbol,
  typeRaw,
  volume,
  entry,
  sl,
  tp,
  exit,
  commission,
  swap,
  profit,
}) {
  const openAtISO = parseMT5Date(openRaw);
  const closeAtISO = parseMT5Date(closeRaw);
  const rawType = String(typeRaw || '').toLowerCase();
  const isSell = rawType.includes('sell') || rawType.includes('short');
  const direction = isSell ? 'Short' : 'Long';
  const comm = parseNumber(commission);
  const sw = parseNumber(swap);
  const gross = parseNumber(profit);
  const net = parseFloat((gross + comm + sw).toFixed(2));
  const ticketId = String(ticket || `mt5_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);

  return {
    id: 'trade-' + ticketId,
    brokerId: ticketId,
    ticket: ticketId,
    date: openAtISO ? openAtISO.split('T')[0] : '',
    openAt: openAtISO,
    closeAt: closeAtISO,
    openTime: openAtISO || openRaw || '',
    closeTime: closeAtISO || closeRaw || '',
    symbol: String(symbol || 'UNKNOWN').toUpperCase(),
    type: isSell ? 'sell' : 'buy',
    direction,
    size: parseNumber(volume),
    volume: parseNumber(volume),
    entryPrice: parseNumber(entry),
    stopLoss: parseNumber(sl),
    takeProfit: parseNumber(tp),
    exitPrice: parseNumber(exit),
    commission: comm,
    swap: sw,
    profit: net,
    pnl: net,
    setup: 'Untagged',
    notes: '',
    emotions: [],
    source: 'MT5_CSV',
  };
}

/** Classic MT5 deal history positional mapping */
export function mapMT5RowToTrade(row = []) {
  return buildTrade({
    openRaw: row[0],
    ticket: row[1],
    symbol: row[2],
    typeRaw: row[3],
    volume: row[4],
    entry: row[5],
    sl: row[6],
    tp: row[7],
    closeRaw: row[8],
    exit: row[9],
    commission: row[10],
    swap: row[11],
    profit: row[12],
  });
}

function scoreAsMt5Header(cells = []) {
  const h = cells.map((c) => String(c || '').toLowerCase());
  let score = 0;
  if (h.some((x) => x.includes('symbol'))) score += 3;
  if (h.some((x) => x.includes('profit'))) score += 3;
  if (h.some((x) => x.includes('position') || x.includes('ticket'))) score += 2;
  if (h.some((x) => x.includes('volume') || x.includes('lots'))) score += 1;
  if (h.some((x) => x.includes('time') || x.includes('date'))) score += 1;
  if (h.some((x) => x.includes('type'))) score += 1;
  return score;
}

function mapByHeaders(headers, row) {
  const hs = headers.map((h) => String(h || '').trim().toLowerCase().replace(/["']/g, ''));

  const timeIdx = [];
  const priceIdx = [];
  let ticketIdx = -1;
  let symbolIdx = -1;
  let typeIdx = -1;
  let volumeIdx = -1;
  let slIdx = -1;
  let tpIdx = -1;
  let commIdx = -1;
  let swapIdx = -1;
  let profitIdx = -1;

  hs.forEach((h, i) => {
    if (h.includes('time') || h.includes('date')) timeIdx.push(i);
    else if (h.includes('position') || h.includes('ticket') || h.includes('order') || h === 'id') ticketIdx = i;
    else if (h === 'symbol' || h.includes('symbol') || h.includes('item') || h.includes('asset') || h.includes('pair')) symbolIdx = i;
    else if (h.includes('type') || h.includes('direction') || h.includes('side')) typeIdx = i;
    else if (h.includes('volume') || h.includes('lots') || h === 'size') volumeIdx = i;
    else if (h.includes('s / l') || h.includes('s/l') || h === 'sl' || h.includes('stop')) slIdx = i;
    else if (h.includes('t / p') || h.includes('t/p') || h === 'tp' || h.includes('take')) tpIdx = i;
    else if (h.includes('commission') || h === 'comm') commIdx = i;
    else if (h.includes('swap')) swapIdx = i;
    else if (h.includes('profit') || h.includes('p/l') || h.includes('pnl') || h === 'net') profitIdx = i;
    else if (h.includes('price')) priceIdx.push(i);
  });

  const get = (i) => (i >= 0 && i < row.length ? row[i] : '');

  return buildTrade({
    openRaw: get(timeIdx[0]),
    closeRaw: get(timeIdx[1]),
    ticket: get(ticketIdx),
    symbol: get(symbolIdx),
    typeRaw: get(typeIdx),
    volume: get(volumeIdx),
    entry: get(priceIdx[0]),
    exit: get(priceIdx[1]),
    sl: get(slIdx),
    tp: get(tpIdx),
    commission: get(commIdx),
    swap: get(swapIdx),
    profit: get(profitIdx),
  });
}

export function parseCSVToTrades(csvText) {
  const rows = parseRawCSV(String(csvText || ''));
  if (!rows.length) return [];

  let headerIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(15, rows.length); i++) {
    const sc = scoreAsMt5Header(rows[i]);
    if (sc > bestScore) {
      bestScore = sc;
      headerIdx = i;
    }
  }

  const trades = [];

  if (headerIdx >= 0 && bestScore >= 5) {
    const headers = rows[headerIdx];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 5) continue;
      if (scoreAsMt5Header(row) >= 5) continue;

      const t = mapByHeaders(headers, row);
      const bad =
        (!t.symbol || t.symbol === 'UNKNOWN') &&
        !parseMT5Date(t.openAt || t.openTime) &&
        !(Number(t.pnl) || Number(t.profit));

      const finalTrade = bad && row.length >= 10 ? mapMT5RowToTrade(row) : t;

      const hasSignal =
        (finalTrade.symbol && finalTrade.symbol !== 'UNKNOWN') ||
        looksLikeSymbol(row[2]) ||
        String(finalTrade.ticket || '').length > 3;

      if (!hasSignal && !(Number(finalTrade.profit) || Number(finalTrade.pnl))) continue;
      trades.push(finalTrade);
    }
  }

  if (!trades.length) {
    for (const row of rows) {
      if (!row || row.length < 10) continue;
      if (scoreAsMt5Header(row) >= 5) continue;

      const maybeTicket = String(row[1] || '');
      const maybeSymbol = String(row[2] || '');
      const maybeTime = String(row[0] || '');
      const timeOk = /^\d{4}/.test(maybeTime) || parseMT5Date(maybeTime);
      const ticketOk = /^\d{5,}$/.test(maybeTicket);
      const symbolOk = looksLikeSymbol(maybeSymbol);

      if (!(timeOk && (ticketOk || symbolOk))) continue;

      trades.push(mapMT5RowToTrade(row));
    }
  }

  return trades;
}