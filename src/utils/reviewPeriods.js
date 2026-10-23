export const REVIEW_PROMPTS = [
  ['wentWell', 'What went well?'],
  ['improve', 'What needs improvement?'],
  ['learned', 'What did I learn?'],
  ['nextFocus', 'What will I focus on next period?'],
];

export const REVIEW_TEXT_LIMIT = 6000;

function parseDay(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  if (year < 1000 || year > 9999) return null;

  const date = new Date(year, month - 1, day, 12);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  ) ? date : null;
}

export function localReviewDay(date = new Date()) {
  if (
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime())
  ) {
    return '';
  }

  const pad = (n) => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Calendar arithmetic, not fixed millisecond durations:
// safe across daylight-saving changes.
export function getReviewPeriod(type, day = localReviewDay()) {
  const start = parseDay(day);

  if (!start || !['weekly', 'monthly'].includes(type)) return null;

  if (type === 'weekly') {
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  } else {
    start.setDate(1);
  }

  const next = new Date(start);

  if (type === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + 1);
  }

  const end = new Date(next);
  end.setDate(end.getDate() - 1);

  const startDay = localReviewDay(start);
  const nextDay = localReviewDay(next);

  if (!parseDay(startDay) || !parseDay(nextDay)) return null;

  return {
    type,
    start: startDay,
    end: localReviewDay(end),
    nextStart: nextDay,
  };
}

export function moveReviewPeriod(type, day, direction) {
  const period = getReviewPeriod(type, day);

  if (!period || ![-1, 1].includes(direction)) return null;

  const date = parseDay(period.start);

  if (type === 'weekly') {
    date.setDate(date.getDate() + direction * 7);
  } else {
    date.setMonth(date.getMonth() + direction);
  }

  return getReviewPeriod(type, localReviewDay(date));
}

export function blankReviewAnswers() {
  return Object.fromEntries(
    REVIEW_PROMPTS.map(([id]) => [id, ''])
  );
}

export function normalizeReviewAnswers(value) {
  const source = (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) ? value : {};

  return Object.fromEntries(
    REVIEW_PROMPTS.map(([id]) => [
      id,
      typeof source[id] === 'string'
        ? source[id].slice(0, REVIEW_TEXT_LIMIT)
        : '',
    ])
  );
}

// JSON encoding avoids collisions even when account ids contain separators.
export function reviewRecordKey(accountId, type, day) {
  if (typeof accountId !== 'string' || !accountId.trim()) return null;

  const period = getReviewPeriod(type, day);

  return period
    ? JSON.stringify([accountId, type, period.start])
    : null;
}