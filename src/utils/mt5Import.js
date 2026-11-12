// Ticket aliases include legacy IDs, without changing existing trade objects.
function ticketKeys(trade) {
  const values = [trade?.brokerId, trade?.ticket, trade?.id];

  return values
    .map((value) => String(value ?? '').trim().replace(/^trade-/, ''))
    .filter((value) => /^\d+$/.test(value));
}

const SOURCE_FIELDS = [
  'openAt', 'closeAt', 'symbol', 'type', 'volume', 'entryPrice',
  'exitPrice', 'stopLoss', 'takeProfit', 'commission', 'swap', 'pnl',
];

const signature = (trade) => JSON.stringify(
  SOURCE_FIELDS.map((key) => trade[key])
);

// Only compare source fields within this file. Never merge imported defaults
// into an existing reviewed trade: its annotations must remain untouched.
export function planMT5Import(incoming = [], existing = []) {
  const existingKeys = new Set(existing.flatMap(ticketKeys));
  const firstByTicket = new Map();
  const fresh = [];
  const duplicates = [];
  const conflicts = [];

  for (const trade of incoming) {
    const ticket = String(trade.brokerId ?? trade.ticket ?? '').trim();

    if (!/^\d+$/.test(ticket)) {
      conflicts.push({
        ticket: ticket || '(missing)',
        reason: 'Missing or invalid position ticket.',
      });
      continue;
    }

    const first = firstByTicket.get(ticket);

    if (first) {
      if (signature(first) !== signature(trade)) {
        conflicts.push({
          ticket,
          reason: 'This file contains different position rows with the same ticket. Reconciliation is required.',
        });
      } else {
        duplicates.push(trade);
      }

      continue;
    }

    firstByTicket.set(ticket, trade);

    if (ticketKeys(trade).some((key) => existingKeys.has(key))) {
      duplicates.push(trade);
    } else {
      fresh.push(trade);
    }
  }

  // A conflicting file is blocked as a whole, not partially imported.
  return {
    fresh: conflicts.length ? [] : fresh,
    duplicates,
    conflicts,
  };
}

// Re-run against the actual state supplied by React, not only the preview.
export function mergeMT5Import(existing = [], incoming = []) {
  const plan = planMT5Import(incoming, existing);

  return plan.conflicts.length || !plan.fresh.length
    ? existing
    : [...plan.fresh, ...existing];
}