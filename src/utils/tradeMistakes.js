export const TRADE_MISTAKES = [
  ['invalid_setup', 'Entered without a valid setup', 'The entry did not meet your setup rules.'],
  ['early_confirmation', 'Entered before confirmation', 'You entered before the confirmation required by your plan.'],
  ['chased_entry', 'Chased entry', 'You followed price beyond your planned entry conditions.'],
  ['missed_entry', 'Missed a planned entry', 'You missed the planned entry before this actual trade; explain in Notes.'],
  ['oversized', 'Oversized position', 'The position exceeded your planned size or risk limit.'],
  ['stop_against_plan', 'Moved stop against the plan', 'You changed the stop in a way your plan did not allow.'],
  ['removed_stop', 'Removed stop against the plan', 'You removed a stop that your plan required.'],
  ['early_exit', 'Exited early against the plan', 'You closed earlier than your exit rules allowed.'],
  ['held_beyond_exit', 'Held beyond the planned exit', 'You kept the trade open beyond your planned exit conditions.'],
  ['unplanned_entry', 'Unplanned additional entry', 'You added another entry outside your plan.'],
  ['news_rules', 'Ignored news rules', 'You traded contrary to your own news-related rules.'],
  ['outside_hours', 'Traded outside planned hours', 'You entered outside your planned trading window.'],
  ['other', 'Other', 'Describe the mistake in Notes.'],
  ['none', 'No mistake identified', 'You reviewed execution and did not identify a mistake; this is not inferred from profit.'],
];

// Blank means unrecorded. A loss is not automatically a mistake.
export function normalizeTradeMistakes(value) {
  const selected = new Set(Array.isArray(value) ? value : []);
  const known = TRADE_MISTAKES.map(([id]) => id).filter((id) => selected.has(id));
  // For conflicting imported data, retain specific mistakes rather than "none".
  return known.length > 1 ? known.filter((id) => id !== 'none') : known;
}

export function toggleTradeMistake(current, id) {
  const selected = normalizeTradeMistakes(current);
  if (!TRADE_MISTAKES.some(([key]) => key === id)) return selected;
  if (selected.includes(id)) return selected.filter((key) => key !== id);
  if (id === 'none') return ['none'];
  return normalizeTradeMistakes([...selected.filter((key) => key !== 'none'), id]);
}

export function getTradeMistakesDisplay(value) {
  const selected = new Set(normalizeTradeMistakes(value));
  return TRADE_MISTAKES.filter(([id]) => selected.has(id))
    .map(([, label]) => label)
    .join(' / ');
}

export function tradeMistakesCSVValue(value) {
  return '"' + getTradeMistakesDisplay(value).replace(/"/g, '""') + '"';
}