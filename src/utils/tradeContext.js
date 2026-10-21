export const MARKET_CONDITIONS = [
  ['trending', 'Trending'], ['ranging', 'Ranging'], ['choppy', 'Choppy'],
  ['transitioning', 'Transitioning'], ['other', 'Other'],
];
export const ENTRY_EXECUTIONS = [
  ['planned', 'As planned'], ['early', 'Earlier than planned'],
  ['late', 'Later than planned'], ['chased', 'Chased entry'], ['other', 'Other'],
];
export const SL_MANAGEMENT = [
  ['unchanged', 'Left unchanged'], ['breakeven', 'Moved to breakeven'],
  ['trailed', 'Trailed'], ['tightened', 'Tightened'], ['widened', 'Widened'],
  ['removed', 'Removed'], ['other', 'Other'],
];
export const TP_MANAGEMENT = [
  ['unchanged', 'Left unchanged'], ['partials', 'Took partials'],
  ['extended', 'Extended target'], ['reduced', 'Reduced target'],
  ['removed', 'Removed target'], ['other', 'Other'],
];
const MANAGEMENT_OPTIONS = { slManagement: SL_MANAGEMENT, tpManagement: TP_MANAGEMENT };

const choice = (value, options) => options.some(([id]) => id === value) ? value : '';
function actions(value, options) {
  const selected = new Set(Array.isArray(value) ? value : []);
  const known = options.map(([id]) => id).filter((id) => selected.has(id));
  // If malformed data contains both, retain actions rather than "unchanged".
  return known.length > 1 ? known.filter((id) => id !== 'unchanged') : known;
}

// Missing context remains unrecorded; never infer it from price or playbook.
export function normalizeTradeContext(trade = {}) {
  const t = trade || {};
  return {
    entryTimeframe: typeof t.entryTimeframe === 'string' ? t.entryTimeframe.trim().slice(0, 24) : '',
    marketCondition: choice(t.marketCondition, MARKET_CONDITIONS),
    entryExecution: choice(t.entryExecution, ENTRY_EXECUTIONS),
    slManagement: actions(t.slManagement, SL_MANAGEMENT),
    tpManagement: actions(t.tpManagement, TP_MANAGEMENT),
  };
}

export function toggleManagement(current, field, action) {
  const options = Object.hasOwn(MANAGEMENT_OPTIONS, field) ? MANAGEMENT_OPTIONS[field] : null;
  if (!options) return [];
  const selected = actions(current, options);
  if (!options.some(([id]) => id === action)) return selected;
  if (selected.includes(action)) return selected.filter((id) => id !== action);
  if (action === 'unchanged') return ['unchanged'];
  return actions([...selected.filter((id) => id !== 'unchanged'), action], options);
}

export function getTradeContextDisplay(trade) {
  const t = normalizeTradeContext(trade);
  const label = (value, options) => options.find(([id]) => id === value)?.[1] || '';
  return {
    entryTimeframe: t.entryTimeframe,
    marketCondition: label(t.marketCondition, MARKET_CONDITIONS),
    entryExecution: label(t.entryExecution, ENTRY_EXECUTIONS),
    slManagement: t.slManagement.map((id) => label(id, SL_MANAGEMENT)).join(' / '),
    tpManagement: t.tpManagement.map((id) => label(id, TP_MANAGEMENT)).join(' / '),
  };
}

// Quote CSV text and prevent new free-text context from becoming a formula.
export function contextCSVValue(trade, field) {
  const value = getTradeContextDisplay(trade)[field] || '';
  const safe = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}