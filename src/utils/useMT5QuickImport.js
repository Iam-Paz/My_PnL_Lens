import { useEffect, useRef } from 'react';
import { parseCSVReport } from './csvParser';
import {
  planMT5Import,
  mergeMT5Import,
} from './mt5Import';

export default function useMT5QuickImport({
  trades = [],
  setTrades,
  logActivity,
  currency = 'USD',
}) {
  const version = useRef(0);
  const latest = useRef({
    trades,
    setTrades,
    logActivity,
    currency,
  });

  useEffect(() => {
    latest.current = {
      trades,
      setTrades,
      logActivity,
      currency,
    };
  }, [trades, setTrades, logActivity, currency]);

  // An account/tab change unmounts Journal:
  // discard any pending file read.
  useEffect(() => () => {
    version.current++;
  }, []);

  return async function handleMT5Upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const request = ++version.current;

    try {
      const text = await file.text();

      if (request !== version.current) return;

      const report = parseCSVReport(text);

      if (report.invalid.length) {
        const details = report.invalid
          .slice(0, 5)
          .map(
            (item) => `Record ${item.rowNumber}: ${item.reason}`
          )
          .join('\n');

        alert(
          `${report.invalid.length} invalid position row(s). No trades imported.\n\n${details}\n\nCorrect the file, or open Imports for a detailed preview.`
        );
        return;
      }

      const current = latest.current;
      const plan = planMT5Import(
        report.trades,
        current.trades
      );

      if (plan.conflicts.length) {
        const details = plan.conflicts
          .slice(0, 5)
          .map(
            (item) => `Ticket ${item.ticket}: ${item.reason}`
          )
          .join('\n');

        alert(
          `Conflicting position tickets. No trades imported.\n\n${details}\n\nUse Imports to review the file.`
        );
        return;
      }

      if (!plan.fresh.length) {
        alert(
          plan.duplicates.length
            ? `No new positions. ${plan.duplicates.length} duplicate rows skipped; existing trades were not changed.`
            : `No supported closed positions found. ${report.skipped.length} non-position/totals rows skipped. Include the 13-column Positions header.`
        );
        return;
      }

      if (typeof current.setTrades !== 'function') {
        alert(
          'Import unavailable: account trade storage is not connected.'
        );
        return;
      }

      const net = plan.fresh.reduce(
        (sum, trade) => sum + trade.pnl,
        0
      );

      const stopped = report.stoppedAt
        ? `\nStopped before: ${report.stoppedAt}`
        : '';

      const approved = confirm(
        `Import ${plan.fresh.length} new closed positions from ${file.name}?\n\nNew-position net P&L: ${current.currency} ${net.toFixed(2)}\nDuplicate rows skipped: ${plan.duplicates.length}\nNon-position/totals rows skipped: ${report.skipped.length}${stopped}\n\nMake sure the selected account and currency match this file. Existing trades and annotations will not be overwritten.`
      );

      if (!approved || request !== version.current) return;

      current.setTrades((previous) => mergeMT5Import(
        previous || [],
        report.trades
      ));

      if (typeof current.logActivity === 'function') {
        current.logActivity(
          'import',
          file.name,
          plan.fresh.length
        );
      }

      alert(
        `Submitted ${plan.fresh.length} new positions for import. Existing trades and annotations were not overwritten.`
      );
    } catch (error) {
      if (request !== version.current) return;

      alert(
        `Quick Import failed: ${error.message || 'The file could not be read or parsed.'}`
      );
    }
  };
}