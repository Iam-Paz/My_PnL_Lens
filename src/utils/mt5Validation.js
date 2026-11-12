// Unknown/invalid numbers remain null. The importer decides which fields
// are required and which optional blanks may safely become zero.
export function parseMT5Number(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== 'string') return null;

  let text = value.trim();
  if (!text) return null;

  // Currency signs may surround the number, not interrupt its digits.
  text = text
    .replace(/^([$€£₦])\s*/, '')
    .replace(/\s*([$€£₦])$/, '');

  if (/^\(.*\)$/.test(text)) {
    text = '-' + text.slice(1, -1);
  }

  // Accept properly grouped spaces, including non-breaking spaces.
  if (/\s/.test(text)) {
    if (
      !/^[+-]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?$/.test(text)
    ) {
      return null;
    }

    text = text.replace(/[ \u00a0\u202f]/g, '');
  }

  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      if (!/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(text)) {
        return null;
      }

      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      if (!/^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/.test(text)) {
        return null;
      }

      text = text.replace(/,/g, '');
    }
  } else if (text.includes(',')) {
    if (/^[+-]?\d+,\d{1,2}$/.test(text)) {
      text = text.replace(',', '.');
    } else if (/^[+-]?\d{1,3}(?:,\d{3})+$/.test(text)) {
      text = text.replace(/,/g, '');
    } else {
      return null;
    }
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    return null;
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

// MT5 position-history timestamps are broker wall time. Validate each part
// without letting Date roll February 30 into March. Do not shift timezone.
export function parseMT5WallTime(value) {
  if (typeof value !== 'string') return null;

  const match = value.trim().match(
    /^(\d{4})[./-](\d{2})[./-](\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) return null;

  const [, y, m, d, hh, mm, ss = '00'] = match;

  if (
    +y < 1000 ||
    +m < 1 ||
    +m > 12 ||
    +d < 1 ||
    +hh > 23 ||
    +mm > 59 ||
    +ss > 59
  ) {
    return null;
  }

  const check = new Date(
    Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss)
  );

  if (
    check.getUTCFullYear() !== +y ||
    check.getUTCMonth() !== +m - 1 ||
    check.getUTCDate() !== +d
  ) {
    return null;
  }

  return `${y}-${m}-${d}T${hh}:${mm}:${ss}`;
}

export function normalizeMT5Side(value) {
  const side = typeof value === 'string'
    ? value.trim().toLowerCase()
    : '';

  return side === 'buy' || side === 'sell' ? side : null;
}