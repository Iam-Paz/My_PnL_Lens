import { useRef, useState } from 'react';
import {
  Package,
  FileText,
  TriangleAlert,
  ScrollText,
} from 'lucide-react';
import { parseCSVReport } from '../utils/csvParser';
import {
  planMT5Import,
  mergeMT5Import,
} from '../utils/mt5Import';
import { formatToLocalTime } from '../utils/tradeStats';

const cellStyle = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-color)',
};

export default function Imports({
  trades = [],
  setTrades,
  logActivity,
  activityLog = [],
  clearActivityLog,
  settings,
}) {
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [reading, setReading] = useState(false);

  const readVersion = useRef(0);
  const confirmed = useRef(false);

  const brokerUtcOffset = settings?.brokerUtcOffset ?? 2;
  const currency = settings?.currency || 'USD';
  const money = (value) => `${currency} ${value.toFixed(2)}`;

  const plan = preview
    ? planMT5Import(preview.trades, trades)
    : null;

  const blocked = !!(
    preview?.invalid.length ||
    plan?.conflicts.length
  );

  const net = plan?.fresh.reduce(
    (sum, trade) => sum + trade.pnl,
    0
  ) ?? 0;

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const version = ++readVersion.current;
    confirmed.current = false;

    setFileName(file.name);
    setErrorMsg('');
    setNotice('');
    setPreview(null);
    setReading(true);

    const reader = new FileReader();

    reader.onload = () => {
      if (version !== readVersion.current) return;

      try {
        const report = parseCSVReport(
          String(reader.result ?? '')
        );

        if (!report.totalRows) {
          setErrorMsg(
            'No position rows found. Include the supported Positions header and closed-position rows.'
          );
        } else {
          setPreview(report);
        }
      } catch (error) {
        setErrorMsg(
          error.message || 'Unable to parse this Positions file.'
        );
      }

      setReading(false);
    };

    reader.onerror = () => {
      if (version !== readVersion.current) return;

      setReading(false);
      setErrorMsg(
        'The file could not be read. Please select it again.'
      );
    };

    reader.readAsText(file);
  };

  const cancelImport = () => {
    readVersion.current++;
    setPreview(null);
    setFileName('');
    setErrorMsg('');
    setReading(false);
  };

  const confirmImport = () => {
    if (
      !preview ||
      preview.invalid.length ||
      confirmed.current
    ) {
      return;
    }

    const currentPlan = planMT5Import(preview.trades, trades);

    if (
      currentPlan.conflicts.length ||
      !currentPlan.fresh.length
    ) {
      return;
    }

    if (typeof setTrades !== 'function') {
      setErrorMsg(
        'Import is unavailable: account trade storage is not connected.'
      );
      return;
    }

    confirmed.current = true;

    // Pure functional update: duplicate protection also runs on latest state.
    setTrades((previous) => mergeMT5Import(
      previous || [],
      preview.trades
    ));

    if (typeof logActivity === 'function') {
      logActivity('import', fileName, currentPlan.fresh.length);
    }

    setNotice(
      `Submitted ${currentPlan.fresh.length} new positions for import; ${currentPlan.duplicates.length} duplicate rows skipped. Existing trades and annotations were not overwritten.`
    );

    setPreview(null);
    setFileName('');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      <div>
        <h1 style={{ fontSize: '24px', margin: 0 }}>
          <Package size={24} /> MT5 Positions Import
        </h1>

        <p
          style={{
            color: 'var(--text-secondary)',
            fontSize: '13px',
          }}
        >
          Import closed Positions only. Select the correct account
          first; the copied table does not identify its account
          or currency.
        </p>
      </div>

      {notice && (
        <div className="ts-card" role="status">
          {notice}
        </div>
      )}

      {errorMsg && (
        <div
          className="ts-card"
          role="alert"
          style={{ color: 'var(--color-loss)' }}
        >
          <TriangleAlert size={16} /> {errorMsg}
        </div>
      )}

      {!preview && (
        <div
          className="ts-card"
          style={{
            padding: '32px',
            textAlign: 'center',
            border: '2px dashed var(--border-color)',
          }}
        >
          <FileText size={36} />

          <h3>Select MT5 Positions CSV / TSV / TXT</h3>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '13px',
            }}
          >
            Requires the 13-column header: Time, Position, Symbol,
            Type, Volume, Price, S / L, T / P, Time, Price,
            Commission, Swap, Profit.
          </p>

          <p
            style={{
              color: 'var(--text-secondary)',
              fontSize: '12px',
            }}
          >
            Tab, comma and semicolon separators are supported for
            this layout. HTML reports, journal exports, Orders and
            Deals are not supported import layouts.
          </p>

          <input
            id="mt5-position-file"
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            onChange={handleFileUpload}
            disabled={reading}
          />

          {reading && (
            <p role="status">Reading {fileName}…</p>
          )}
        </div>
      )}

      {preview && (
        <>
          <div className="ts-card">
            <h3 style={{ marginTop: 0 }}>
              Preview — {fileName}
            </h3>

            <div
              style={{
                display: 'flex',
                gap: '16px',
                flexWrap: 'wrap',
                fontSize: '13px',
              }}
            >
              <span>
                {preview.totalRows} data records examined
              </span>
              <span>{plan.fresh.length} new positions</span>
              <span>
                {plan.duplicates.length} duplicate rows skipped
              </span>
              <span>
                {preview.skipped.length} non-position/totals
                rows skipped
              </span>
              <span>
                {preview.invalid.length} invalid rows
              </span>
              <span>
                {plan.conflicts.length} ticket conflicts
              </span>
            </div>

            <p>
              <strong>
                New-position net P&amp;L: {money(net)}
              </strong>
            </p>

            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              Net = gross profit + signed commission + swap.
              Currency is the selected account setting, not detected
              from the file. Existing positions are skipped, never
              updated or merged.
            </p>

            {preview.stoppedAt && (
              <p>
                Stopped before later section: {preview.stoppedAt}
              </p>
            )}

            {blocked && (
              <p
                role="alert"
                style={{ color: 'var(--color-loss)' }}
              >
                Import blocked. Correct the invalid rows or
                conflicting tickets and select the file again.
                No partial import will be performed.
              </p>
            )}

            {!blocked && !plan.fresh.length && (
              <p>No new positions to import.</p>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="ts-btn ts-btn-ghost"
                onClick={cancelImport}
              >
                Cancel / choose another file
              </button>

              <button
                className="ts-btn ts-btn-success"
                onClick={confirmImport}
                disabled={blocked || !plan.fresh.length}
              >
                Confirm Import ({plan.fresh.length})
              </button>
            </div>
          </div>

          {!!preview.invalid.length && (
            <div className="ts-card">
              <h4>Invalid record details</h4>
              <p style={{ fontSize: '12px' }}>
                Record numbers count non-empty CSV records,
                including the header and any preamble.
              </p>

              {preview.invalid.slice(0, 20).map((item) => (
                <p key={item.rowNumber}>
                  Record {item.rowNumber}: {item.reason}
                </p>
              ))}

              {preview.invalid.length > 20 && (
                <p>
                  …and {preview.invalid.length - 20} more.
                </p>
              )}
            </div>
          )}

          {!!plan.conflicts.length && (
            <div className="ts-card">
              <h4>Ticket conflicts</h4>

              {plan.conflicts.slice(0, 20).map((item, index) => (
                <p key={`${item.ticket}-${index}`}>
                  Ticket {item.ticket}: {item.reason}
                </p>
              ))}

              {plan.conflicts.length > 20 && (
                <p>
                  …and {plan.conflicts.length - 20} more.
                </p>
              )}
            </div>
          )}

          {!!preview.skipped.length && (
            <div className="ts-card">
              <h4>Skipped non-position records</h4>

              {preview.skipped.slice(0, 10).map((item) => (
                <p key={item.rowNumber}>
                  Record {item.rowNumber}: {item.reason}
                </p>
              ))}

              {preview.skipped.length > 10 && (
                <p>
                  …and {preview.skipped.length - 10} more.
                </p>
              )}
            </div>
          )}

          {!!plan.fresh.length && (
            <div
              className="ts-card"
              style={{ overflowX: 'auto', padding: 0 }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '12px',
                }}
              >
                <thead>
                  <tr>
                    {[
                      'Ticket',
                      'Open (local)',
                      'Close (local)',
                      'Symbol',
                      'Direction',
                      'Volume',
                      'Entry',
                      'SL',
                      'TP',
                      'Exit',
                      'Net P&L',
                    ].map((heading) => (
                      <th style={cellStyle} key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {plan.fresh.slice(0, 15).map((trade) => (
                    <tr key={trade.id}>
                      <td style={cellStyle}>
                        {trade.ticket}
                      </td>
                      <td style={cellStyle}>
                        {formatToLocalTime(
                          trade.openAt,
                          brokerUtcOffset
                        )}
                      </td>
                      <td style={cellStyle}>
                        {formatToLocalTime(
                          trade.closeAt,
                          brokerUtcOffset
                        )}
                      </td>
                      <td style={cellStyle}>
                        {trade.symbol}
                      </td>
                      <td
                        style={{
                          ...cellStyle,
                          color: trade.type === 'sell'
                            ? 'var(--color-loss)'
                            : 'var(--color-win)',
                        }}
                      >
                        {trade.direction}
                      </td>
                      <td style={cellStyle}>
                        {trade.volume}
                      </td>
                      <td style={cellStyle}>
                        {trade.entryPrice}
                      </td>
                      <td style={cellStyle}>
                        {trade.stopLoss || '—'}
                      </td>
                      <td style={cellStyle}>
                        {trade.takeProfit || '—'}
                      </td>
                      <td style={cellStyle}>
                        {trade.exitPrice}
                      </td>
                      <td
                        style={{
                          ...cellStyle,
                          color: trade.pnl < 0
                            ? 'var(--color-loss)'
                            : 'var(--color-win)',
                        }}
                      >
                        {money(trade.pnl)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p style={{ padding: '10px', fontSize: '12px' }}>
                Showing {Math.min(15, plan.fresh.length)} of{' '}
                {plan.fresh.length} new positions. Preview does
                not save trades.
              </p>
            </div>
          )}
        </>
      )}

      <div className="ts-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3><ScrollText size={16} /> Activity Log</h3>

          {!!activityLog.length && (
            <button
              className="ts-btn ts-btn-danger"
              onClick={clearActivityLog}
            >
              Clear Log
            </button>
          )}
        </div>

        {!activityLog.length ? (
          <p>No import or export history recorded yet.</p>
        ) : (
          activityLog.map((log) => (
            <div
              key={log.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
                padding: '8px 0',
                fontSize: '12px',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <span>
                <strong>
                  {log.type === 'import' ? 'Imported' : 'Exported'}
                </strong>{' '}
                {log.tradeCount} trade
                {log.tradeCount === 1 ? '' : 's'} ({log.filename})
              </span>

              <span>
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}