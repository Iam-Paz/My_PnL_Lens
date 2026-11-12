import {
  parseMT5Number,
  parseMT5WallTime,
  normalizeMT5Side,
} from './mt5Validation.js';

const normal = (value) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/\s/g, '');

const HEADERS = [
  'time', 'position', 'symbol', 'type', 'volume', 'price',
  's/l', 't/p', 'time', 'price', 'commission', 'swap', 'profit',
];

// Spreadsheet exports may append empty columns. Only remove extras after
// the 13 supported columns; never remove blank SL/TP or required fields.
function positionCells(row) {
  const cells = row.slice();

  while (
    cells.length > 13 &&
    !String(cells[cells.length - 1] ?? '').trim()
  ) {
    cells.pop();
  }

  return cells;
}

function isPositionHeader(row) {
  const cells = positionCells(row);

  return cells.length === HEADERS.length && cells.every((cell, i) => {
    const value = normal(cell);
    return value === HEADERS[i] || (i === 1 && value === 'ticket');
  });
}

// Detect separators outside quoted fields, not decimal commas inside them.
function detectDelimiter(text) {
  const scores = new Map([['\t', 0], [';', 0], [',', 0]]);

  for (const line of text.split(/\r?\n/).slice(0, 30)) {
    const counts = new Map([['\t', 0], [';', 0], [',', 0]]);
    let quoted = false;

    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (quoted && line[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && counts.has(line[i])) {
        counts.set(line[i], counts.get(line[i]) + 1);
      }
    }

    for (const [key, count] of counts) {
      scores.set(key, Math.max(scores.get(key), count));
    }
  }

  return [...scores].sort((a, b) => b[1] - a[1])[0][0];
}

export function parseRawCSV(value) {
  const text = String(value ?? '').replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const rows = [];

  let row = [];
  let token = '';
  let quoted = false;
  let endedQuote = false;

  const pushRow = () => {
    row.push(token.trim());

    if (row.some((cell) => cell.length)) rows.push(row);

    row = [];
    token = '';
    endedQuote = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        token += '"';
        i++;
      } else if (quoted) {
        quoted = false;
        endedQuote = true;
      } else if (!token.trim() && !endedQuote) {
        quoted = true;
      } else {
        throw new Error('Malformed quoted field in the import file.');
      }
    } else if (!quoted && char === delimiter) {
      row.push(token.trim());
      token = '';
      endedQuote = false;
    } else if (!quoted && (char === '\r' || char === '\n')) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      pushRow();
    } else {
      if (endedQuote && !/\s/.test(char)) {
        throw new Error('Unexpected text after a quoted field.');
      }

      token += char;
    }
  }

  if (quoted) {
    throw new Error('Unclosed quoted field in the import file.');
  }

  if (token || row.length || endedQuote) pushRow();

  return rows;
}

function positionTrade(rawRow) {
  const row = positionCells(rawRow);

  if (row.length !== 13) {
    throw new Error(
      'Expected 13 Positions columns, optionally followed by empty columns. Check separators and blank SL/TP cells.'
    );
  }

  const [
    openRaw, ticketRaw, symbolRaw, sideRaw, volumeRaw, entryRaw,
    slRaw, tpRaw, closeRaw, exitRaw, commissionRaw, swapRaw, profitRaw,
  ] = row;

  const ticket = String(ticketRaw).trim();

  if (!/^\d+$/.test(ticket)) {
    throw new Error(
      'Missing or invalid numeric position ticket. Ticketless rows are not supported.'
    );
  }

  const type = normalizeMT5Side(sideRaw);

  if (!type) {
    throw new Error(
      'Unsupported position type; only buy/sell positions are supported.'
    );
  }

  const symbol = String(symbolRaw).trim().toUpperCase();

  if (
    !/^[A-Z0-9._/#-]+$/.test(symbol) ||
    !/[A-Z]/.test(symbol)
  ) {
    throw new Error('Missing or invalid symbol.');
  }

  const openAt = parseMT5WallTime(openRaw);
  const closeAt = parseMT5WallTime(closeRaw);

  if (!openAt) {
    throw new Error('Missing or invalid open timestamp.');
  }

  if (!closeAt) {
    throw new Error(
      'Missing or invalid close timestamp; this layout requires closed positions.'
    );
  }

  if (closeAt < openAt) {
    throw new Error('Close time is earlier than open time.');
  }

  const required = (value, label, positive = false) => {
    // WPS/MT5 accounting-style output can write "- 0.52". Allow horizontal
    // spacing immediately after a leading sign, not arbitrary digit spacing.
    const input = typeof value === 'string'
      ? value.trim().replace(/^([+-])[ \u00a0\u202f]+(?=[\d.])/, '$1')
      : value;

    const number = parseMT5Number(input);

    if (number === null || (positive && number <= 0)) {
      throw new Error(`Missing or invalid ${label}.`);
    }

    return number;
  };

  const optionalPrice = (value, label) => {
    if (!String(value ?? '').trim()) return 0;

    const number = required(value, label);

    if (number < 0) {
      throw new Error(`Invalid negative ${label}.`);
    }

    return number;
  };

  const volume = required(volumeRaw, 'volume', true);
  const entryPrice = required(entryRaw, 'entry price', true);
  const exitPrice = required(exitRaw, 'exit price', true);
  const stopLoss = optionalPrice(slRaw, 'stop loss');
  const takeProfit = optionalPrice(tpRaw, 'take profit');
  const commission = required(commissionRaw, 'commission');
  const swap = required(swapRaw, 'swap');
  const gross = required(profitRaw, 'gross profit');

  const net = Number((gross + commission + swap).toFixed(2));

  if (!Number.isFinite(net)) {
    throw new Error('Net profit is outside the supported numeric range.');
  }

  return {
    id: 'trade-' + ticket,
    brokerId: ticket,
    ticket,
    date: openAt.slice(0, 10),
    openAt,
    closeAt,
    openTime: openAt,
    closeTime: closeAt,
    symbol,
    type,
    direction: type === 'sell' ? 'Short' : 'Long',
    size: volume,
    volume,
    entryPrice,
    stopLoss,
    takeProfit,
    exitPrice,
    commission,
    swap,
    profit: net,
    pnl: net,
    setup: 'Untagged',
    notes: '',
    emotions: [],
    reviewed: false,
    source: 'MT5_CSV',
  };
}

export function mapMT5RowToTrade(row = []) {
  return positionTrade(row);
}

export function parseCSVReport(csvText) {
  const rows = parseRawCSV(csvText);

  if (!rows.length) {
    return {
      trades: [],
      invalid: [],
      skipped: [],
      totalRows: 0,
      stoppedAt: '',
    };
  }

  const headerIndex = rows.findIndex(
    (row, index) => index < 30 && isPositionHeader(row)
  );

  if (headerIndex < 0) {
    throw new Error(
      'Unsupported layout. Use the 13-column MT5 closed Positions table, including its header. Journal exports, Orders and Deals are not supported.'
    );
  }

  const trades = [];
  const invalid = [];
  const skipped = [];

  let totalRows = 0;
  let stoppedAt = '';

  const nonTradeTypes = new Set([
    'balance', 'credit', 'deposit', 'withdrawal', 'charge',
    'correction', 'bonus', 'interest', 'commission',
  ]);

  const sections = new Set([
    'orders', 'deals', 'results', 'balancegraph', 'openpositions',
  ]);

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];

    const first = normal(
      row.find((cell) => String(cell).trim()) || ''
    ).replace(/:$/, '');

    const orderOrDealHeader =
      normal(row[0]) === 'time' &&
      ['order', 'deal'].includes(normal(row[1]));

    if (sections.has(first) || orderOrDealHeader) {
      stoppedAt = row.join(' ').trim();
      break;
    }

    if (isPositionHeader(row)) continue;

    totalRows++;

    const rowNumber = i + 1;

    if (
      ['total', 'totals'].includes(first) ||
      nonTradeTypes.has(normal(row[3]))
    ) {
      skipped.push({
        rowNumber,
        reason: 'Non-position transaction or totals row.',
      });
      continue;
    }

    try {
      trades.push(positionTrade(row));
    } catch (error) {
      invalid.push({
        rowNumber,
        reason: error.message,
      });
    }
  }

  return {
    trades,
    invalid,
    skipped,
    totalRows,
    stoppedAt,
  };
}

// Legacy callers must not silently import only the valid subset.
export function parseCSVToTrades(csvText) {
  const report = parseCSVReport(csvText);

  if (report.invalid.length) {
    const first = report.invalid[0];

    throw new Error(
      `${report.invalid.length} invalid row(s). Record ${first.rowNumber}: ${first.reason} No trades imported.`
    );
  }

  return report.trades;
}