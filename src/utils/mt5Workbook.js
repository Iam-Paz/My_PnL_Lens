import { unzipSync, zipSync, strToU8 } from 'fflate';
import readXlsxFile from 'read-excel-file/universal';
import { mapMT5RowToTrade } from './csvParser.js';
import { parseMT5Number, parseMT5WallTime } from './mt5Validation.js';

const MAX_FILE = 10 * 1024 * 1024;
const MAX_XML = 20 * 1024 * 1024;
const text = (value) => String(value ?? '').trim();
const norm = (value) => text(value).toLowerCase().replace(/\s/g, '');
const nonempty = (row) => row.some((cell) => text(cell));
const round = (value) => Number(value.toFixed(2));
const SECTION_NAMES = ['Positions', 'Orders', 'Deals', 'Working Orders', 'Results'];

// MT5 can write UTF-16 XML inside a valid XLSX ZIP. Normalize only an
// in-memory copy; never rewrite the user's workbook or ask WPS to resave it.
export async function readMT5Workbook(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (!bytes.length || bytes.length > MAX_FILE) {
    throw new Error('Choose a non-empty XLSX workbook smaller than 10 MB.');
  }
  let declared = 0;
  const entries = unzipSync(bytes, {
    filter(entry) {
      declared += entry.originalSize;
      if (declared > MAX_XML) throw new Error('Workbook expands beyond the 20 MB limit.');
      return /(?:\.xml|\.rels)$/.test(entry.name);
    },
  });
  if (!entries['xl/workbook.xml']) throw new Error('Not a supported XLSX workbook.');
  for (const [name, data] of Object.entries(entries)) {
    let encoding = 'utf-8';
    if ((data[0] === 255 && data[1] === 254) || (data[0] === 60 && data[1] === 0)) encoding = 'utf-16le';
    if ((data[0] === 254 && data[1] === 255) || (data[0] === 0 && data[1] === 60)) encoding = 'utf-16be';
    const xml = new TextDecoder(encoding, { fatal: true }).decode(data)
      .replace(/^(<\?xml\b[^?]*\bencoding\s*=\s*)["'][^"']+["']/i, '$1"UTF-8"');
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('XML entities are not supported.');
    entries[name] = strToU8(xml);
  }
  const sheets = await readXlsxFile(zipSync(entries));
  const candidates = sheets.filter(({ data }) => data.some((row) => row && norm(row[0]) === 'positions'));
  if (candidates.length !== 1) throw new Error('Expected exactly one MT5 report sheet containing Positions.');
  return parseMT5WorkbookRows(candidates[0].data, candidates[0].sheet);
}

export function parseMT5WorkbookRows(rows, sheet = '') {
  const invalid = [];
  const skipped = [];
  const warnings = [];
  const discrepancies = [];
  const accountLine = rows.find((row) => norm(row?.[0]) === 'account:')?.[3];
  const reportAccount = text(accountLine);
  const reportCurrency = reportAccount.match(/\(([A-Z]{3}),/)?.[1] || '';
  const sections = {};
  rows.forEach((row, index) => {
    if (!row) return;
    const name = SECTION_NAMES.find((value) => norm(value) === norm(row[0]));
    if (!name || row.slice(1).some((cell) => text(cell))) return;
    if (sections[name] !== undefined) throw new Error(`Repeated ${name} section is unsupported.`);
    sections[name] = index;
  });
  for (const name of ['Positions', 'Orders', 'Deals', 'Results']) {
    if (sections[name] === undefined) throw new Error(`Missing ${name} section.`);
  }
  const ordered = Object.entries(sections).sort((a, b) => a[1] - b[1]);
  if (ordered.map(([name]) => name).join('|') !== SECTION_NAMES.filter((name) => sections[name] !== undefined).join('|')) {
    throw new Error('Unexpected MT5 section order.');
  }
  const sectionRows = (name, expected) => {
    const start = sections[name];
    const header = rows[start + 1] || [];
    if (expected.some((value, index) => norm(header[index]) !== norm(value))) {
      throw new Error(`Unsupported ${name} columns.`);
    }
    const extra = header.slice(expected.length);
    if (extra.some((value, index) => text(value) && !(norm(value) === 'comment' && ((name === 'Orders' && index === 1) || (name === 'Deals' && index === 0))))) {
      throw new Error(`Unexpected extra ${name} columns.`);
    }
    const end = ordered.find(([, index]) => index > start)?.[1] ?? rows.length;
    return rows.slice(start + 2, end).map((row, index) => ({ row: row || [], rowNumber: start + index + 3 })).filter(({ row }) => nonempty(row));
  };
  const positions = sectionRows('Positions', ['Time', 'Position', 'Symbol', 'Type', 'Volume', 'Price', 'S / L', 'T / P', 'Time', 'Price', 'Commission', 'Swap', 'Profit']);
  const orders = sectionRows('Orders', ['Open Time', 'Order', 'Symbol', 'Type', 'Volume', 'Price', 'S / L', 'T / P', 'Time', 'State']);
  const deals = sectionRows('Deals', ['Time', 'Deal', 'Symbol', 'Type', 'Direction', 'Volume', 'Price', 'Order', 'Commission', 'Fee', 'Swap', 'Profit', 'Balance']);
  const totals = { gross: 0, commission: 0, swap: 0, net: 0 };
  const trades = [];
  const positionIds = new Set();
  for (const { row, rowNumber } of positions) {
    try {
      const trade = mapMT5RowToTrade(row);
      if (positionIds.has(trade.ticket)) throw new Error('Repeated position ticket: partial-close or duplicate layout needs reconciliation.');
      positionIds.add(trade.ticket);
      trades.push({ ...trade, source: 'MT5_XLSX' });
      totals.gross += parseMT5Number(row[12]);
      totals.commission += trade.commission;
      totals.swap += trade.swap;
      totals.net += trade.pnl;
    } catch (error) { invalid.push({ rowNumber, reason: error.message }); }
  }
  const orderMap = new Map();
  for (const { row, rowNumber } of orders) {
    const ticket = text(row[1]);
    if (!/^\d+$/.test(ticket) || orderMap.has(ticket)) {
      invalid.push({ rowNumber, reason: 'Invalid or repeated order ticket.' });
      continue;
    }
    orderMap.set(ticket, row);
    if (norm(row[9]) !== 'filled') skipped.push({ rowNumber, reason: `Order ${ticket}: ${text(row[9])}; not imported as a trade.` });
  }
  const dealIds = new Set();
  const executions = [];
  let previousBalance = null;
  let hasDealFees = false;
  const cashflows = [];
  const dealTotals = { gross: 0, commission: 0, fee: 0, swap: 0, net: 0 };
  const num = (value, label) => {
    const number = parseMT5Number(value);
    if (number === null) throw new Error(`Invalid or missing ${label}.`);
    return number;
  };
  for (const { row, rowNumber } of deals) {
    if (!row.slice(0, 8).some((value) => text(value)) && !text(row[13])) {
      skipped.push({ rowNumber, reason: 'Deals summary row, not an execution.' });
      continue;
    }
    try {
      const ticket = text(row[1]);
      if (!/^\d+$/.test(ticket) || dealIds.has(ticket)) throw new Error('Invalid or repeated deal ticket.');
      dealIds.add(ticket);
      if (!parseMT5WallTime(row[0])) throw new Error('Invalid deal timestamp.');
      const values = { commission: num(row[8], 'commission'), fee: num(row[9], 'fee'), swap: num(row[10], 'swap'), gross: num(row[11], 'profit') };
      if (values.fee !== 0) hasDealFees = true;
      const balance = num(row[12], 'running balance');
      const movement = values.gross + values.commission + values.fee + values.swap;
      if (previousBalance !== null && Math.abs(balance - previousBalance - movement) > 0.015) {
        throw new Error('Deal running balance does not reconcile with its signed costs/profit.');
      }
      previousBalance = balance;
      if (['balance', 'credit'].includes(norm(row[3]))) {
        if (values.commission || values.fee || values.swap) throw new Error('Cash movement has unexplained trading costs.');
        cashflows.push({ ticket, type: text(row[3]), amount: values.gross });
        skipped.push({ rowNumber, reason: `Cash movement ${ticket}, excluded from trading P&L.` });
        continue;
      }
      if (!['buy', 'sell'].includes(norm(row[3]))) throw new Error('Unsupported deal type; standalone costs cannot be allocated safely.');
      if (!['in', 'out'].includes(norm(row[4]))) throw new Error('Reversal / close-by deal direction is not supported.');
      const order = orderMap.get(text(row[7]));
      if (!order || norm(order[9]) !== 'filled' || norm(order[2]) !== norm(row[2])) throw new Error('Deal has no matching filled order for its symbol.');
      if (num(row[5], 'execution volume') <= 0 || num(row[6], 'execution price') <= 0) {
        throw new Error('Execution volume and price must be positive.');
      }
      if (norm(order[3]).replace(/limit|stop/g, '') !== norm(row[3])) {
        throw new Error('Deal side does not match its order.');
      }
      executions.push(row);
      for (const key of Object.keys(values)) dealTotals[key] += values[key];
    } catch (error) { invalid.push({ rowNumber, reason: error.message }); }
  }
  for (const [ticket, order] of orderMap) {
    if (norm(order[9]) !== 'filled') continue;
    const quantities = text(order[4]).split('/').map(parseMT5Number);
    const executed = executions.filter((row) => text(row[7]) === ticket)
      .reduce((sum, row) => sum + parseMT5Number(row[5]), 0);
    if (quantities.length !== 2 || quantities.some((value) => value === null || value <= 0) || Math.abs(quantities[0] - quantities[1]) > 1e-8 || Math.abs(executed - quantities[1]) > 1e-8) {
      discrepancies.push(`Filled order ${ticket} volume does not match its executions; partial/incomplete execution history is unsupported.`);
    }
  }
  dealTotals.net = dealTotals.gross + dealTotals.commission + dealTotals.swap + dealTotals.fee;
  for (const key of Object.keys(totals)) {
    totals[key] = round(totals[key]);
    dealTotals[key] = round(dealTotals[key]);
    if (Math.abs(totals[key] - dealTotals[key]) > 0.005) discrepancies.push(`Positions ${key} ${totals[key].toFixed(2)} differs from Deals ${dealTotals[key].toFixed(2)}.`);
  }
  if (hasDealFees) discrepancies.push('Nonzero deal fees are not represented by the Positions columns; no automatic allocation.');
  const results = rows.slice(sections.Results + 1);
  const reportedNet = results.find((row) => norm(row?.[0]) === 'totalnetprofit:')?.[3];
  const reportedCount = results.find((row) => norm(row?.[0]) === 'totaltrades:')?.[3];
  if (parseMT5Number(reportedNet) === null || Math.abs(num(reportedNet, 'reported net') - totals.net) > 0.005) discrepancies.push('Results Total Net Profit is missing or differs from Positions net.');
  if (parseMT5Number(reportedCount) !== trades.length) discrepancies.push('Results Total Trades is missing or differs from the number of closed positions.');
  warnings.push('Deals have Order references, not explicit Position references. Totals are cross-checked, but closing executions are not assigned to positions by matching symbol/time.');
  if (executions.length !== trades.length * 2 || executions.filter((row) => norm(row[4]) === 'in').length !== trades.length) {
    discrepancies.push('Possible partial fills, partial closes, or incomplete history. This layout needs explicit position linkage before import.');
  }
  const volumeBuckets = (items, getKey, getVolume) => {
    const result = new Map();
    for (const item of items) {
      const key = getKey(item);
      result.set(key, (result.get(key) || 0) + getVolume(item));
    }
    return result;
  };
  const expectedVolumes = volumeBuckets(trades, (trade) => `${norm(trade.symbol)}|${trade.type}`, (trade) => trade.volume);
  for (const direction of ['in', 'out']) {
    const actual = volumeBuckets(executions.filter((row) => norm(row[4]) === direction),
      (row) => `${norm(row[2])}|${direction === 'in' ? norm(row[3]) : norm(row[3]) === 'buy' ? 'sell' : 'buy'}`,
      (row) => parseMT5Number(row[5]));
    const keys = new Set([...expectedVolumes.keys(), ...actual.keys()]);
    if ([...keys].some((key) => Math.abs((expectedVolumes.get(key) || 0) - (actual.get(key) || 0)) > 1e-8)) {
      discrepancies.push(`Positions and ${direction} execution volumes differ by symbol/direction.`);
    }
  }
  for (const trade of trades) {
    const opening = executions.filter((row) => norm(row[4]) === 'in' && text(row[7]) === trade.ticket);
    if (opening.length !== 1 || norm(opening[0][2]) !== norm(trade.symbol) || norm(opening[0][3]) !== trade.type || Math.abs((parseMT5Number(opening[0][5]) ?? -1) - trade.volume) > 1e-8) {
      discrepancies.push(`Position ${trade.ticket} has no unique, volume-matched opening order/deal reference.`);
    }
  }
  return {
    trades, invalid, skipped, totalRows: positions.length, stoppedAt: '',
    reconciliation: { sheet, reportAccount, reportCurrency, totals, dealTotals, cashflows, warnings, discrepancies, executions: executions.length, orders: orders.length, reportedNet: parseMT5Number(reportedNet) },
    blocked: !!(invalid.length || discrepancies.length),
  };
}