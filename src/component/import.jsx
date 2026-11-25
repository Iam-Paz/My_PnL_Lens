import { useEffect, useRef, useState } from 'react';
import { Package, TriangleAlert, ScrollText } from 'lucide-react';
import { parseCSVReport } from '../utils/csvParser';
import { planMT5Import, mergeMT5Import } from '../utils/mt5Import';
import { formatToLocalTime } from '../utils/tradeStats';

const cellStyle = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-color)',
};

export default function Imports({
  trades = [], setTrades, logActivity, activityLog = [],
  clearActivityLog, settings,
}) {
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [notice, setNotice] = useState('');
  const [reading, setReading] = useState(false);
  const readVersion = useRef(0);
  const confirmed = useRef(false);

  useEffect(() => () => { readVersion.current++; }, []);

  const currency = settings?.currency || 'USD';
  const brokerUtcOffset = settings?.brokerUtcOffset ?? 2;
  const reconciliation = preview?.reconciliation;
  const reportCurrency = reconciliation?.reportCurrency || '';
  const currencyMismatch = !!reportCurrency && reportCurrency !== currency;
  const plan = preview ? planMT5Import(preview.trades, trades) : null;
  const blocked = !!(preview?.blocked || preview?.invalid.length || plan?.conflicts.length || currencyMismatch);
  const net = plan?.fresh.reduce((sum, trade) => sum + trade.pnl, 0) ?? 0;
  const money = (value, code = currency) => `${code} ${value.toFixed(2)}`;

  const handleFileUpload = async (event) => {
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
    try {
      if (!file.size || file.size > 10 * 1024 * 1024) {
        throw new Error('Choose a non-empty import file smaller than 10 MB.');
      }
      const extension = file.name.split('.').pop().toLowerCase();
      let report;
      if (extension === 'xlsx') {
        const { readMT5Workbook } = await import('../utils/mt5Workbook.js');
        report = await readMT5Workbook(await file.arrayBuffer());
      } else if (['csv', 'txt', 'tsv'].includes(extension)) {
        report = parseCSVReport(await file.text());
      } else {
        throw new Error('Use an MT5 .xlsx report or a Positions .csv, .txt or .tsv table. HTML and old .xls files are not supported.');
      }
      if (version !== readVersion.current) return;
      if (!report.totalRows) throw new Error('No closed-position rows found. Include the supported Positions header.');
      setPreview(report);
    } catch (error) {
      if (version === readVersion.current) setErrorMsg(error.message || 'Unable to read this import file.');
    } finally {
      if (version === readVersion.current) setReading(false);
    }
  };

  const cancelImport = () => {
    readVersion.current++;
    setPreview(null);
    setFileName('');
    setErrorMsg('');
    setReading(false);
  };

  const confirmImport = () => {
    if (!preview || blocked || confirmed.current) return;
    const currentPlan = planMT5Import(preview.trades, trades);
    if (currentPlan.conflicts.length || !currentPlan.fresh.length) return;
    if (typeof setTrades !== 'function') {
      setErrorMsg('Import is unavailable: account trade storage is not connected.');
      return;
    }
    confirmed.current = true;
    setTrades((previous) => mergeMT5Import(previous || [], preview.trades));
    if (typeof logActivity === 'function') logActivity('import', fileName, currentPlan.fresh.length);
    setNotice(`Submitted ${currentPlan.fresh.length} new positions for import; ${currentPlan.duplicates.length} duplicate rows skipped. Existing trades and annotations were not overwritten.`);
    setPreview(null);
    setFileName('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '24px', margin: 0 }}><Package size={24} /> MT5 Report Import</h1>
        <p>Select the correct journal account first. Importing never creates or switches accounts automatically.</p>
      </div>
      {notice && <div className="ts-card" role="status">{notice}</div>}
      {errorMsg && <div className="ts-card" role="alert" style={{ color: 'var(--color-loss)' }}><TriangleAlert size={16} /> {errorMsg}</div>}

      {!preview && (
        <div className="ts-card">
          <h3>Choose an MT5 file</h3>
          <p>Excel: original .xlsx history report with Positions, Orders, Deals and Results. Only closed Positions become journal trades.</p>
          <p>CSV/TXT/TSV: the existing 13-column closed Positions table, including its header. CSV files do not receive full-workbook reconciliation.</p>
          <p>Excel reports with partial fills/closes, reversals, unexplained costs or inconsistent totals are blocked when this layout cannot reconcile them safely. No execution-to-position matching by symbol/time.</p>
          <input aria-label="MT5 import file" type="file" accept=".xlsx,.csv,.txt,.tsv" onChange={handleFileUpload} disabled={reading} />
          {reading && <p role="status">Reading {fileName}…</p>}
          {reading && <button className="ts-btn ts-btn-ghost" onClick={cancelImport}>Cancel read</button>}
        </div>
      )}

      {preview && (
        <>
          <div className="ts-card">
            <h3>Preview — {fileName}</h3>
            <p>{preview.totalRows} position records examined · {plan.fresh.length} new positions · {plan.duplicates.length} duplicates skipped · {preview.invalid.length} invalid records · {plan.conflicts.length} ticket conflicts</p>
            <p><strong>New-position net P&amp;L: {money(net)}</strong></p>
            <p>Only the new positions above will be added. Existing tickets are skipped, never updated; annotations remain untouched. Net = gross profit + signed commission + swap, counted once.</p>
            {!reconciliation && <p>Positions-only file: currency is not detected. Check the selected account currency ({currency}). Orders/Deals are not reconciled in CSV/TXT mode.</p>}
            {preview.stoppedAt && <p>Stopped before later section: {preview.stoppedAt}</p>}
            {currencyMismatch && <p role="alert">Currency mismatch: workbook {reportCurrency}; selected account {currency}. Select the correct account/currency and recheck the preview.</p>}
            {blocked && <p role="alert" style={{ color: 'var(--color-loss)' }}>Import blocked. Resolve the invalid records, ticket conflicts or reconciliation issues below. No partial import will be performed.</p>}
            {!blocked && !plan.fresh.length && <p>No new positions to import.</p>}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="ts-btn ts-btn-ghost" onClick={cancelImport}>Cancel / choose another file</button>
              <button className="ts-btn ts-btn-success" onClick={confirmImport} disabled={blocked || !plan.fresh.length}>Confirm Import ({plan.fresh.length})</button>
            </div>
          </div>

          {reconciliation && (
            <div className="ts-card">
              <h3>Full-workbook reconciliation</h3>
              <p>Report account: {reconciliation.reportAccount || 'Not detected — verify manually'}</p>
              <p>Sheet: {reconciliation.sheet} · {reconciliation.orders} historical orders · {reconciliation.executions} trading executions</p>
              <p>These totals cover the entire file, including duplicate positions already in your journal. They are not just the new positions.</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left' }}>
                  <thead><tr><th>Measure</th><th>Positions</th><th>Trading Deals</th></tr></thead>
                  <tbody>
                    {['gross', 'commission', 'swap', 'net'].map((key) => (
                      <tr key={key}><td style={cellStyle}>{key}</td><td style={cellStyle}>{money(reconciliation.totals[key], reportCurrency || currency)}</td><td style={cellStyle}>{money(reconciliation.dealTotals[key], reportCurrency || currency)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>Deal fees: {money(reconciliation.dealTotals.fee, reportCurrency || currency)} · Results net: {reconciliation.reportedNet === null ? 'Missing / invalid' : money(reconciliation.reportedNet, reportCurrency || currency)}</p>
              <h4>{reconciliation.discrepancies.length ? 'Blocking discrepancies' : 'Aggregate totals match'}</h4>
              {reconciliation.discrepancies.map((message, index) => <p role="alert" key={index}>{message}</p>)}
              {reconciliation.warnings.map((message, index) => <p key={index}>{message}</p>)}
              <p>Partial-close/reversal layouts without sufficient position linkage are not supported. Matching totals are not proof of individual closing-deal links.</p>
              <h4>Cash movements — excluded from trades</h4>
              {reconciliation.cashflows.length ? reconciliation.cashflows.map((flow) => <p key={flow.ticket}>{flow.type} #{flow.ticket}: {money(flow.amount, reportCurrency || currency)}</p>) : <p>None found.</p>}
              <p>Pending/cancelled orders and Working Orders are not imported as trades. Deal costs cross-check Positions; they are never added a second time.</p>
            </div>
          )}

          {!!preview.invalid.length && (
            <div className="ts-card">
              <h4>Invalid records</h4>
              <p>XLSX numbers are worksheet rows; CSV/TXT numbers count non-empty records including the header.</p>
              {preview.invalid.slice(0, 20).map((item, index) => <p key={index}>Record {item.rowNumber}: {item.reason}</p>)}
              {preview.invalid.length > 20 && <p>…and {preview.invalid.length - 20} more.</p>}
            </div>
          )}
          {!!plan.conflicts.length && (
            <div className="ts-card">
              <h4>Ticket conflicts</h4>
              {plan.conflicts.slice(0, 20).map((item, index) => <p key={index}>Ticket {item.ticket}: {item.reason}</p>)}
              {plan.conflicts.length > 20 && <p>…and {plan.conflicts.length - 20} more.</p>}
            </div>
          )}
          {!!preview.skipped.length && (
            <div className="ts-card">
              <h4>Skipped non-position records ({preview.skipped.length})</h4>
              {preview.skipped.slice(0, 10).map((item, index) => <p key={index}>Record {item.rowNumber}: {item.reason}</p>)}
              {preview.skipped.length > 10 && <p>…and {preview.skipped.length - 10} more.</p>}
            </div>
          )}
          {!!plan.fresh.length && (
            <div className="ts-card" style={{ overflowX: 'auto' }}>
              <h3>New closed positions</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead><tr>{['Ticket', 'Open (local)', 'Close (local)', 'Symbol', 'Direction', 'Volume', 'Entry', 'SL', 'TP', 'Exit', 'Net P&L'].map((heading) => <th style={cellStyle} key={heading}>{heading}</th>)}</tr></thead>
                <tbody>{plan.fresh.slice(0, 15).map((trade) => (
                  <tr key={trade.id}>
                    <td style={cellStyle}>{trade.ticket}</td>
                    <td style={cellStyle}>{formatToLocalTime(trade.openAt, brokerUtcOffset)}</td>
                    <td style={cellStyle}>{formatToLocalTime(trade.closeAt, brokerUtcOffset)}</td>
                    <td style={cellStyle}>{trade.symbol}</td><td style={cellStyle}>{trade.direction}</td>
                    <td style={cellStyle}>{trade.volume}</td><td style={cellStyle}>{trade.entryPrice}</td>
                    <td style={cellStyle}>{trade.stopLoss || '—'}</td><td style={cellStyle}>{trade.takeProfit || '—'}</td>
                    <td style={cellStyle}>{trade.exitPrice}</td><td style={cellStyle}>{money(trade.pnl)}</td>
                  </tr>
                ))}</tbody>
              </table>
              <p>Showing {Math.min(15, plan.fresh.length)} of {plan.fresh.length} new positions. Preview does not save trades.</p>
            </div>
          )}
        </>
      )}

      <div className="ts-card">
        <h3><ScrollText size={16} /> Activity Log</h3>
        {!!activityLog.length && <button className="ts-btn ts-btn-danger" onClick={clearActivityLog}>Clear Log</button>}
        {!activityLog.length ? <p>No import or export history recorded yet.</p> : activityLog.map((log) => (
          <div key={log.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
            <strong>{log.type === 'import' ? 'Imported' : 'Exported'}</strong> {log.tradeCount} trade{log.tradeCount === 1 ? '' : 's'} ({log.filename}) — {new Date(log.timestamp).toLocaleString()}
          </div>
        ))}
      </div>
    </div>
  );
}