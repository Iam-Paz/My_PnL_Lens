import React, { useState } from 'react';
import { Package, FileText, TriangleAlert, ScrollText, Download, Upload } from 'lucide-react';
import { parseCSVToTrades } from '../utils/csvParser';
import { formatDateTime, toDate } from '../utils/dateUtils';

export default function Imports({
  trades = [],
  setTrades,
  logActivity,
  activityLog = [],
  clearActivityLog,
}) {
  const [parsedPreview, setParsedPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setErrorMsg('');
    setParsedPreview(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target.result || '');
        const parsed = parseCSVToTrades(text);

        if (!parsed.length) {
          setErrorMsg('No trade rows found. Check that this is an MT5 deal/history export.');
          return;
        }

        const existingTickets = new Set(
          trades.map((t) => String(t.brokerId || t.ticket || t.id || '')).filter(Boolean)
        );

        const valid = [];
        const duplicates = [];
        const invalid = [];

        parsed.forEach((trade, index) => {
          const open = toDate(trade.openAt || trade.openTime || trade.date);
          const pnl = Number(trade.pnl ?? trade.profit);
          const hasSymbol = trade.symbol && String(trade.symbol).toUpperCase() !== 'UNKNOWN';
          const ticket = String(trade.brokerId || trade.ticket || '');

          const ok = open && Number.isFinite(pnl) && (hasSymbol || ticket.length > 0);

          if (!ok) {
            invalid.push({
              rowNumber: index + 1,
              reason: !open
                ? 'Missing/invalid open time'
                : !Number.isFinite(pnl)
                ? 'Missing/invalid profit'
                : 'Missing symbol/ticket',
              trade,
            });
            return;
          }

          if (ticket && existingTickets.has(ticket)) {
            duplicates.push(trade);
          } else {
            valid.push(trade);
            if (ticket) existingTickets.add(ticket);
          }
        });

        setParsedPreview({
          totalRows: parsed.length,
          valid,
          duplicates,
          invalid,
        });
      } catch (err) {
        console.error(err);
        setErrorMsg('Failed to parse CSV. Please verify the MT5 export format.');
      }
    };

    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!parsedPreview?.valid?.length) return;

    if (typeof setTrades === 'function') {
      setTrades((prev) => [...parsedPreview.valid, ...(prev || [])]);
    }

    if (typeof logActivity === 'function') {
      logActivity('import', fileName, parsedPreview.valid.length);
    }

    alert(`Successfully imported ${parsedPreview.valid.length} trades!`);
    setParsedPreview(null);
    setFileName('');
  };

  const cancelImport = () => {
    setParsedPreview(null);
    setFileName('');
    setErrorMsg('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Package size={24} /> CSV Import & History</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>
          Import MT5 history with preview, validation, and duplicate protection.
        </p>
      </div>

      {!parsedPreview && (
        <div
          className="ts-card"
          style={{ padding: '32px', textAlign: 'center', border: '2px dashed var(--border-color)' }}
        >
          <div style={{ marginBottom: '12px' }}><FileText size={40} style={{ color: 'var(--text-muted)' }} /></div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Select MT5 CSV / TSV File</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '20px' }}>
            Supports comma, tab, or semicolon exports.
          </p>

          <input
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            onChange={handleFileUpload}
            id="csv-file-input"
            style={{ display: 'none' }}
          />
          <label
            htmlFor="csv-file-input"
            className="ts-btn ts-btn-primary"
            style={{ cursor: 'pointer', display: 'inline-block' }}
          >
            Browse Files
          </label>

          {errorMsg && (
            <div style={{ marginTop: '16px', color: 'var(--color-loss)', fontSize: '13px', fontWeight: 600 }}>
              <TriangleAlert size={14} style={{ verticalAlign: '-2px', marginRight: '4px' }} />{errorMsg}
            </div>
          )}
        </div>
      )}

      {parsedPreview && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            className="ts-card"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '16px' }}>Import Preview — {fileName}</h3>
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '12px', flexWrap: 'wrap' }}>
                <span style={{ color: '#4ade80', fontWeight: 700 }}>
                  ✓ {parsedPreview.valid.length} Ready to Import
                </span>
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                  <TriangleAlert size={12} style={{ verticalAlign: '-1px', marginRight: '4px' }} />{parsedPreview.duplicates.length} Duplicates Skipped
                </span>
                <span style={{ color: '#f87171', fontWeight: 600 }}>
                  ✕ {parsedPreview.invalid.length} Invalid Rows
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={cancelImport} className="ts-btn ts-btn-ghost">
                Cancel
              </button>
              <button
                onClick={confirmImport}
                className="ts-btn ts-btn-success"
                disabled={parsedPreview.valid.length === 0}
              >
                Confirm Import ({parsedPreview.valid.length})
              </button>
            </div>
          </div>

          {parsedPreview.invalid.length > 0 && (
            <div className="ts-card" style={{ borderColor: 'rgba(248,113,113,0.4)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#f87171' }}>Invalid row details</h4>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {parsedPreview.invalid.slice(0, 5).map((item) => (
                  <div key={item.rowNumber}>
                    Row {item.rowNumber}: {item.reason}
                    {item.trade?.symbol ? ` (${item.trade.symbol})` : ''}
                  </div>
                ))}
                {parsedPreview.invalid.length > 5 && (
                  <div>…and {parsedPreview.invalid.length - 5} more</div>
                )}
              </div>
            </div>
          )}

          {parsedPreview.valid.length > 0 && (
            <div className="ts-card" style={{ overflowX: 'auto', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                    <th style={{ padding: '10px 14px' }}>Ticket</th>
                    <th style={{ padding: '10px 14px' }}>Open</th>
                    <th style={{ padding: '10px 14px' }}>Symbol</th>
                    <th style={{ padding: '10px 14px' }}>Dir</th>
                    <th style={{ padding: '10px 14px' }}>Vol</th>
                    <th style={{ padding: '10px 14px' }}>Entry</th>
                    <th style={{ padding: '10px 14px' }}>SL</th>
                    <th style={{ padding: '10px 14px' }}>TP</th>
                    <th style={{ padding: '10px 14px' }}>Exit</th>
                    <th style={{ padding: '10px 14px' }}>Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedPreview.valid.slice(0, 15).map((t, idx) => {
                    const pnl = Number(t.pnl ?? t.profit) || 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>
                          {t.brokerId || t.ticket}
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          {t.openAt ? formatDateTime(t.openAt) : t.openTime || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontWeight: 700 }}>{t.symbol}</td>
                        <td
                          style={{
                            padding: '10px 14px',
                            color: (t.direction || t.type || '').toString().toLowerCase().includes('sell')
                              ? 'var(--color-loss)'
                              : 'var(--color-win)',
                          }}
                        >
                          {t.direction || t.type}
                        </td>
                        <td style={{ padding: '10px 14px' }}>{t.volume ?? t.size}</td>
                        <td style={{ padding: '10px 14px' }}>{t.entryPrice}</td>
                        <td style={{ padding: '10px 14px' }}>{t.stopLoss || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{t.takeProfit || '—'}</td>
                        <td style={{ padding: '10px 14px' }}>{t.exitPrice || '—'}</td>
                        <td
                          style={{
                            padding: '10px 14px',
                            fontWeight: 700,
                            color: pnl >= 0 ? 'var(--color-win)' : 'var(--color-loss)',
                          }}
                        >
                          {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {parsedPreview.valid.length > 15 && (
                <div style={{ padding: '10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px' }}>
                  Showing first 15 of {parsedPreview.valid.length} trades…
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="ts-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><ScrollText size={16} /> Activity Log</h3>
          {activityLog.length > 0 && (
            <button onClick={clearActivityLog} className="ts-btn ts-btn-danger" style={{ fontSize: '11px', padding: '4px 8px' }}>
              Clear Log
            </button>
          )}
        </div>

        {activityLog.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
            No import or export history recorded yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activityLog.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-color)',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <strong>{log.type === 'import' ? <><Download size={12} style={{ verticalAlign: '-1px', marginRight: '4px' }} />Imported</> : <><Upload size={12} style={{ verticalAlign: '-1px', marginRight: '4px' }} />Exported</>}</strong>{' '}
                  {log.tradeCount} trades ({log.filename})
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}