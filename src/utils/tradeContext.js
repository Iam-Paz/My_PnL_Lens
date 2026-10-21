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
export const DIRECTIONAL_BIASES = [
  ['bullish', 'Bullish'], ['bearish', 'Bearish'],
  ['neutral', 'Neutral'], ['mixed', 'Mixed'],
];
export const CONFLUENCES = [
  ['htf_alignment', 'Higher-timeframe alignment', 'The broader timeframe supports your trade direction.'],
  ['support_resistance', 'Key support/resistance', 'A support or resistance area supports your entry idea.'],
  ['liquidity_sweep', 'Liquidity sweep', 'Price moves beyond a prior high or low, then returns.'],
  ['break_structure', 'Break of structure', 'Price breaks a structural swing under your trading rules.'],
  ['change_character', 'Change of character', 'A structural change suggests a possible shift in direction.'],
  ['fair_value_gap', 'Fair value gap', 'A three-candle imbalance zone supports your entry idea.'],
  ['order_block', 'Order block', 'An order-block zone identified under your strategy supports the entry.'],
  ['retest', 'Retest', 'Price revisits a previously broken level or zone.'],
  ['session_timing', 'Session timing', 'The entry falls within a session window used by your strategy.'],
  ['other', 'Other', 'Describe the supporting reason in Notes.'],
];
export const KEY_LEVELS = [
  ['previous_day_high', 'Previous day high', "Yesterday's highest price."],
  ['previous_day_low', 'Previous day low', "Yesterday's lowest price."],
  ['previous_week_high', 'Previous week high', "Last week's highest price."],
  ['previous_week_low', 'Previous week low', "Last week's lowest price."],
  ['previous_month_high', 'Previous month high', "Last month's highest price."],
  ['previous_month_low', 'Previous month low', "Last month's lowest price."],
  ['session_high', 'Session high', 'The high of the session you are watching; name the session in Notes.'],
  ['session_low', 'Session low', 'The low of the session you are watching; name the session in Notes.'],
  ['daily_open', 'Daily open', 'The opening price of the trading day.'],
  ['weekly_open', 'Weekly open', 'The opening price of the trading week.'],
  ['monthly_open', 'Monthly open', 'The opening price of the trading month.'],
  ['yearly_open', 'Yearly open', 'The opening price of the trading year.'],
  ['support', 'Support zone', 'An area where you are watching for buying interest.'],
  ['resistance', 'Resistance zone', 'An area where you are watching for selling interest.'],
  ['round_number', 'Round number', 'A round price such as 1.1000 or 100.00.'],
  ['bullish_ob', 'Bullish order block', 'A zone you identified as a potential bullish reaction area.'],
  ['bearish_ob', 'Bearish order block', 'A zone you identified as a potential bearish reaction area.'],
  ['breaker', 'Breaker block', 'An invalidated order-block zone watched for an opposite-side reaction.'],
  ['mitigation', 'Mitigation block', 'A zone watched for a revisit under your mitigation rules.'],
  ['fair_value_gap', 'Fair value gap', 'A three-candle imbalance zone; related to, but not itself, an order block.'],
  ['other', 'Other', 'Describe the level in Notes.'],
];
export const NEWS_CONTEXT = [
  ['before', 'Before major news', 'Entered ahead of a relevant scheduled release.'],
  ['during', 'During news release', 'Entered as the announcement happened.'],
  ['after', 'After major news', 'Entered after the release.'],
  ['none_expected', 'No major news expected', 'You checked and expected no relevant major release.'],
];
const TAG_OPTIONS = { confluences: CONFLUENCES, keyLevels: KEY_LEVELS, newsContext: NEWS_CONTEXT };

function tags(value, options, exclusive = '') {
  const selected = new Set(Array.isArray(value) ? value : []);
  const known = options.map(([id]) => id).filter((id) => selected.has(id));
  return exclusive && known.length > 1 ? known.filter((id) => id !== exclusive) : known;
}

export function toggleContextTag(current, field, id) {
  const options = Object.hasOwn(TAG_OPTIONS, field) ? TAG_OPTIONS[field] : null;
  if (!options) return [];
  const exclusive = field === 'newsContext' ? 'none_expected' : '';
  const selected = tags(current, options, exclusive);
  if (!options.some(([key]) => key === id)) return selected;
  if (selected.includes(id)) return selected.filter((key) => key !== id);
  if (id === exclusive) return [id];
  return tags([...selected.filter((key) => key !== exclusive), id], options, exclusive);
}

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
    directionalBias: choice(t.directionalBias, DIRECTIONAL_BIASES),
    confluences: tags(t.confluences, CONFLUENCES),
    keyLevels: tags(t.keyLevels, KEY_LEVELS),
    newsContext: tags(t.newsContext, NEWS_CONTEXT, 'none_expected'),
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
    directionalBias: label(t.directionalBias, DIRECTIONAL_BIASES),
    confluences: t.confluences.map((id) => label(id, CONFLUENCES)).join(' / '),
    keyLevels: t.keyLevels.map((id) => label(id, KEY_LEVELS)).join(' / '),
    newsContext: t.newsContext.map((id) => label(id, NEWS_CONTEXT)).join(' / '),
  };
}

// Quote CSV text and prevent new free-text context from becoming a formula.
export function contextCSVValue(trade, field) {
  const value = getTradeContextDisplay(trade)[field] || '';
  const safe = /^[\s]*[=+\-@]/.test(value) ? "'" + value : value;
  return '"' + safe.replace(/"/g, '""') + '"';
}