import { useState, useRef } from 'react';

const EMOTIONS = ['Calm', 'Confident', 'Disciplined', 'Patient', 'FOMO', 'Revenge Trading', 'Anxious', 'Overconfident', 'Fearful', 'Greedy', 'Bored'];

// Detect if a string is any form of date/timestamp
function isDateString(str) {
  if (!str) return false;
  const s = String(str).trim();
  if (/^\d{4}[.\/-]\d{2}[.\/-]\d{2}/.test(s)) return true; // YYYY-MM-DD
  if (s.includes('T') && (s.includes('Z') || s.includes(':'))) return true; // ISO format
  if (/\d{2}:\d{2}:\d{2}/.test(s)) return true; // HH:MM:SS
  return false;
}

// Check if a string is a valid trading symbol candidate
function isSymbolCandidate(str) {
  if (!str) return false;
  const s = String(str).trim();
  if (!s) return false;
  if (isDateString(s)) return false; // MUST NOT be a date!
  if (/^-?\d+(\.\d+)?$/.test(s)) return false; // MUST NOT be a pure number/ticket ID
  const lower = s.toLowerCase();
  if (['buy', 'sell', 'buy limit', 'sell limit', 'buy stop', 'sell stop', 'market', 'balance', 'credit', 'close'].includes(lower)) return false; // MUST NOT be a direction
  return true; // Valid ticker symbol!
}

// Clean date display format e.g. 2026-08-27T16:28:17.000Z -> 2026-08-27 16:28
function formatDateDisplay(str) {
  if (!str) return '';
  let s = String(str).trim();
  if (s.includes('T')) {
    const [datePart, timePart] = s.split('T');
    const cleanTime = (timePart || '').slice(0, 5);
    return `${datePart} ${cleanTime}`;
  }
  return s.replace(/\./g, '-');
}

function parseTradeDate(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/\./g, '-').replace(' ', 'T');
  const d = new Date(cleaned);
  return isNaN(d) ? null : d;
}

const normalizeType = (raw) => {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'buy';
  if (s.includes('sell')) return 'sell';
  if (s.includes('buy')) return 'buy';
  if (s.includes('short')) return 'sell';
  if (s.includes('long')) return 'buy';
  return 'buy';
};

export default function Journal({ trades = [], setTrades, playbooks = [], logActivity }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterSetup, setFilterSetup] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

  const setupOptions = ['Untagged', ...playbooks.map((p) => p.title)];

  const [formData, setFormData] = useState({
    symbol: 'EURUSD', type: 'buy', volume: '0.01', entryPrice: '', exitPrice: '',
    profit: '', setup: 'Untagged', notes: '', openTime: new Date().toISOString().split('T')[0],
  });

  const fileInputRef = useRef(null);
  const screenshotRef = useRef(null);

  const cleanNumber = (val) => {
    if (val === undefined || val === null) return 0;
    let s = String(val).trim();
    if (!s) return 0;
    s = s.replace(/["'\s$]/g, '');
    if (s.startsWith('(') && s.endsWith(')')) s = '-' + s.slice(1, -1);
    s = s.replace(/[\u2012\u2013\u2014\u2015\u2212]/g, '-');
    if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
    else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
    const match = s.match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) || 0 : 0;
  };

  const handleImportClick = () => fileInputRef.current.click();

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => parseCSV(e.target.result, file.name);
    reader.readAsText(file);
    event.target.value = '';
  };

  // ---------- INTELLIGENT CSV PARSER ----------
  const parseCSV = (csvText, filename) => {
    const rawLines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (rawLines.length < 2) return alert('CSV file is empty or invalid.');

    const headerLine = rawLines[0];
    let delimiter = ',';
    if (headerLine.includes('\t')) delimiter = '\t';
    else if (headerLine.includes(';')) delimiter = ';';

    const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/["']/g, ''));

    let profitIdx = headers.findIndex((h) => h.includes('profit') || h.includes('p/l') || h.includes('pnl'));
    let symbolIdx = headers.findIndex((h) => h === 'symbol' || h.includes('symbol') || h.includes('item') || h.includes('asset') || h.includes('pair'));
    let typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('direction') || h.includes('side'));
    let volumeIdx = headers.findIndex((h) => h.includes('volume') || h.includes('lots') || h.includes('size'));
    let idIdx = headers.findIndex((h) => h.includes('position') || h.includes('ticket') || h.includes('order'));
    let timeIdx = headers.findIndex((h) => h.includes('time') || h.includes('date'));
    let setupIdx = headers.findIndex((h) => h.includes('setup') || h.includes('playbook') || h.includes('strategy'));
    let notesIdx = headers.findIndex((h) => h.includes('note') || h.includes('comment') || h.includes('review'));
    const priceIndices = headers.map((h, i) => (h.includes('price') ? i : -1)).filter((i) => i !== -1);

    const newTrades = [];

    for (let i = 1; i < rawLines.length; i++) {
      const cols = rawLines[i].split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 3) continue;

      // 1. SMART SYMBOL EXTRACTION
      let symbol = '';
      if (symbolIdx !== -1 && cols[symbolIdx] && isSymbolCandidate(cols[symbolIdx])) {
        symbol = cols[symbolIdx];
      } else {
        // Scan row for the actual symbol candidate
        const found = cols.find((c) => isSymbolCandidate(c));
        symbol = found || 'UNKNOWN';
      }

      // 2. TIME & ID
      const rawTime = (timeIdx !== -1 ? cols[timeIdx] : cols[0]) || '';
      const rawId = (idIdx !== -1 ? cols[idIdx] : cols[1]) || String(Date.now() + i);

      // 3. TYPE & PROFIT
      const rawType = typeIdx !== -1 ? cols[typeIdx] : cols[3];
      const rawProfit = profitIdx !== -1 && cols[profitIdx] !== undefined ? cols[profitIdx] : cols[cols.length - 1];

      let profitValue = cleanNumber(rawProfit);
      if (!profitValue && cols.length > 5) {
        for (let k = cols.length - 1; k >= Math.max(0, cols.length - 4); k--) {
          const maybe = cleanNumber(cols[k]);
          if (maybe !== 0) { profitValue = maybe; break; }
        }
      }

      newTrades.push({
        openTime: formatDateDisplay(rawTime),
        id: isSymbolCandidate(rawId) ? String(Date.now() + i) : rawId,
        symbol: symbol.toUpperCase(),
        type: normalizeType(rawType),
        volume: cleanNumber(volumeIdx !== -1 ? cols[volumeIdx] : cols[4]),
        entryPrice: cleanNumber(priceIndices[0] !== undefined ? cols[priceIndices[0]] : cols[5]),
        exitPrice: cleanNumber(priceIndices[1] !== undefined ? cols[priceIndices[1]] : cols[9]),
        profit: profitValue,
        setup: (setupIdx !== -1 && cols[setupIdx] ? cols[setupIdx].trim() : 'Untagged') || 'Untagged',
        notes: notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx].trim() : '',
        emotions: [],
      });
    }

    if (newTrades.length > 0) {
      setTrades([...newTrades, ...trades]);
      if (logActivity) logActivity('import', filename, newTrades.length);
      alert(`Imported ${newTrades.length} trades successfully!`);
    } else {
      alert('Could not parse trades. Check CSV format.');
    }
  };

  const handleExportCSV = () => {
    if (trades.length === 0) return alert('No trades to export.');
    const headers = ['Time', 'Position', 'Symbol', 'Type', 'Volume', 'Price', 'Close Price', 'Profit', 'Setup', 'Notes'];
    const rows = trades.map((t) => [
      t.openTime, t.id, t.symbol, t.type, t.volume, t.entryPrice, t.exitPrice, t.profit,
      t.setup || 'Untagged', `"${String(t.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const filename = `trades_export_${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    if (logActivity) logActivity('export', filename, trades.length);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    const newTrade = {
      id: String(Date.now()),
      openTime: formatDateDisplay(formData.openTime),
      symbol: formData.symbol.toUpperCase(),
      type: normalizeType(formData.type),
      volume: cleanNumber(formData.volume),
      entryPrice: cleanNumber(formData.entryPrice),
      exitPrice: cleanNumber(formData.exitPrice),
      profit: cleanNumber(formData.profit),
      setup: formData.setup || 'Untagged',
      notes: formData.notes || '',
      emotions: [],
      screenshot: null,
    };
    setTrades([newTrade, ...trades]);
    setIsModalOpen(false);
    setFormData({
      symbol: 'EURUSD', type: 'buy', volume: '0.01',
      entryPrice: '', exitPrice: '', profit: '',
      setup: 'Untagged', notes: '',
      openTime: new Date().toISOString().split('T')[0],
    });
  };

  const handleTagChange = (id, newSetup) => setTrades(trades.map((t) => (t.id === id ? { ...t, setup: newSetup } : t)));
  const handleDeleteTrade = (id) => { if (confirm('Delete trade?')) setTrades(trades.filter((t) => t.id !== id)); };

  const handleOpenDetail = (trade) => {
    setEditingTrade({
      ...trade,
      emotions: trade.emotions || [],
      notes: trade.notes || '',
      screenshot: trade.screenshot || null,
    });
    setIsDetailOpen(true);
  };

  const handleDetailChange = (key, value) => setEditingTrade((prev) => ({ ...prev, [key]: value }));

  const toggleEmotion = (emo) => setEditingTrade((prev) => {
    const cur = prev.emotions || [];
    return { ...prev, emotions: cur.includes(emo) ? cur.filter((e) => e !== emo) : [...cur, emo] };
  });

  const handleScreenshotUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) return alert('Image too large. Keep screenshots under 1.5MB.');
    const reader = new FileReader();
    reader.onload = (ev) => setEditingTrade((prev) => ({ ...prev, screenshot: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleSaveDetail = (e) => {
    e.preventDefault();
    if (!editingTrade) return;
    const updated = {
      ...editingTrade,
      openTime: formatDateDisplay(editingTrade.openTime),
      symbol: (editingTrade.symbol || '').toUpperCase(),
      type: normalizeType(editingTrade.type),
      volume: cleanNumber(editingTrade.volume),
      entryPrice: cleanNumber(editingTrade.entryPrice),
      exitPrice: cleanNumber(editingTrade.exitPrice),
      profit: cleanNumber(editingTrade.profit),
      setup: editingTrade.setup || 'Untagged',
    };
    setTrades(trades.map((t) => (t.id === updated.id ? updated : t)));
    setIsDetailOpen(false);
    setEditingTrade(null);
  };

  const handleDeleteFromDetail = (id) => {
    if (confirm('Delete this trade?')) {
      setTrades(trades.filter((t) => t.id !== id));
      setIsDetailOpen(false);
      setEditingTrade(null);
    }
  };

  const filteredTrades = trades
    .filter((t) => {
      const q = search.toLowerCase().trim();
      const matchesSearch = !q || String(t.symbol || '').toLowerCase().includes(q) || String(t.id || '').toLowerCase().includes(q);
      const p = Number(t.profit) || 0;
      const matchesType = filterType === 'all' ||
        (filterType === 'buy' && t.type === 'buy') ||
        (filterType === 'sell' && t.type === 'sell') ||
        (filterType === 'win' && p > 0) ||
        (filterType === 'loss' && p < 0);
      const matchesSetup = filterSetup === 'all' || (t.setup || 'Untagged') === filterSetup;
      return matchesSearch && matchesType && matchesSetup;
    })
    .sort((a, b) => {
      if (sortOrder === 'pnlHigh') return (Number(b.profit) || 0) - (Number(a.profit) || 0);
      if (sortOrder === 'pnlLow') return (Number(a.profit) || 0) - (Number(b.profit) || 0);
      const da = parseTradeDate(a.openTime)?.getTime() || 0;
      const db = parseTradeDate(b.openTime)?.getTime() || 0;
      return sortOrder === 'oldest' ? da - db : db - da;
    });

  const getOptionsForTrade = (current) => {
    if (!current || setupOptions.includes(current)) return setupOptions;
    return [...setupOptions, current];
  };

  return (
    <div>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" style={{ display: 'none' }} />

      <div className="header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', margin: 0 }}>Trading Journal</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>Click any row to view, edit, add notes & screenshots.</p>
        </div>
        <div className="journal-btn-group" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {trades.length > 0 && <button onClick={handleExportCSV} className="ts-btn ts-btn-ghost">📤 Export</button>}
          <button onClick={handleImportClick} className="ts-btn ts-btn-primary">📥 Import CSV</button>
          <button onClick={() => setIsModalOpen(true)} className="ts-btn ts-btn-success">+ Log Trade</button>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" className="ts-input" placeholder="🔍 Search symbol or ticket..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: '180px' }} />
        <select className="ts-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} style={{ width: '170px' }}>
          <option value="newest">⏳ Newest First</option>
          <option value="oldest">⌛ Oldest First</option>
          <option value="pnlHigh">💰 Highest P&L</option>
          <option value="pnlLow">📉 Lowest P&L</option>
        </select>
        <select className="ts-input" value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: '150px' }}>
          <option value="all">All Outcomes</option>
          <option value="buy">BUY Only</option>
          <option value="sell">SELL Only</option>
          <option value="win">🟢 Wins</option>
          <option value="loss">🔴 Losses</option>
        </select>
        <select className="ts-input" value={filterSetup} onChange={(e) => setFilterSetup(e.target.value)} style={{ width: '170px' }}>
          <option value="all">All Playbooks</option>
          {setupOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="ts-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ts-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Symbol</th>
                <th className="center">Direction</th>
                <th className="num">Volume</th>
                <th className="num">Entry</th>
                <th className="num">Exit</th>
                <th className="num">Profit / Loss</th>
                <th>Setup</th>
                <th className="center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No trades match filters.</td>
                </tr>
              ) : (
                filteredTrades.map((trade, index) => {
                  const p = Number(trade.profit) || 0;
                  return (
                    <tr key={trade.id + '-' + index} onClick={() => handleOpenDetail(trade)} style={{ cursor: 'pointer' }}>
                      <td className="number-font" style={{ color: 'var(--text-secondary)' }}>{formatDateDisplay(trade.openTime)}</td>
                      <td style={{ fontWeight: 700, color: '#fff' }}>
                        {trade.symbol}
                        {trade.notes && <span title="Has notes" style={{ marginLeft: '6px' }}>📝</span>}
                        {trade.screenshot && <span title="Has screenshot" style={{ marginLeft: '4px' }}>📷</span>}
                      </td>
                      <td className="center">
                        <span className={trade.type === 'buy' ? 'badge-buy' : 'badge-sell'}>
                          {String(trade.type).toUpperCase()}
                        </span>
                      </td>
                      <td className="num number-font">{trade.volume}</td>
                      <td className="num number-font">{trade.entryPrice}</td>
                      <td className="num number-font">{trade.exitPrice}</td>
                      <td className="num number-font" style={{ fontWeight: 700, color: p >= 0 ? 'var(--color-win)' : 'var(--color-loss)' }}>
                        {p >= 0 ? `+$${p.toFixed(2)}` : `-$${Math.abs(p).toFixed(2)}`}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          value={trade.setup || 'Untagged'}
                          onChange={(e) => handleTagChange(trade.id, e.target.value)}
                          style={{
                            backgroundColor: 'var(--bg-main)',
                            color: trade.setup === 'Untagged' ? 'var(--text-muted)' : 'var(--accent-blue)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px', padding: '4px 8px', fontSize: '12px', fontWeight: 600,
                          }}
                        >
                          {getOptionsForTrade(trade.setup).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleOpenDetail(trade)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '15px', marginRight: '8px' }} title="Edit">✏️</button>
                        <button onClick={() => handleDeleteTrade(trade.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px' }} title="Delete">✕</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div style={overlayStyle}>
          <div className="ts-card modal-mobile" style={{ width: '480px', maxWidth: '92%', backgroundColor: 'var(--bg-surface)' }}>
            <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px' }}>➕ Log Manual Trade</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-mobile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" className="ts-input" value={formData.openTime}
                    onChange={(e) => setFormData({ ...formData, openTime: e.target.value })} required />
                </div>
                <div>
                  <label style={labelStyle}>Symbol</label>
                  <input type="text" className="ts-input" value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value })} required />
                </div>
                <div>
                  <label style={labelStyle}>Type</label>
                  <select className="ts-input" value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                    <option value="buy">BUY</option>
                    <option value="sell">SELL</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Setup</label>
                  <select className="ts-input" value={formData.setup}
                    onChange={(e) => setFormData({ ...formData, setup: e.target.value })}>
                    {setupOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Entry Price</label>
                  <input type="number" step="any" className="ts-input" value={formData.entryPrice}
                    onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })} required />
                </div>
                <div>
                  <label style={labelStyle}>Exit Price</label>
                  <input type="number" step="any" className="ts-input" value={formData.exitPrice}
                    onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })} required />
                </div>
              </div>
              <div style={{ marginTop: '14px' }}>
                <label style={labelStyle}>Profit / Loss ($)</label>
                <input type="number" step="0.01" className="ts-input" value={formData.profit}
                  onChange={(e) => setFormData({ ...formData, profit: e.target.value })} required />
              </div>
              <div style={{ marginTop: '14px' }}>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea rows="2" className="ts-input" value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Plan, mistakes, lessons..." style={{ resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="ts-btn ts-btn-ghost">Cancel</button>
                <button type="submit" className="ts-btn ts-btn-success">Save Trade</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailOpen && editingTrade && (
        <div style={overlayStyle}>
          <div className="ts-card modal-mobile" style={{ width: '640px', maxWidth: '94%', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>{editingTrade.symbol} — Trade Detail</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>Ticket #{editingTrade.id} • {editingTrade.openTime}</p>
              </div>
              <button onClick={() => { setIsDetailOpen(false); setEditingTrade(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
            </div>
            <form onSubmit={handleSaveDetail}>
              <div className="modal-mobile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Date / Time</label>
                  <input type="text" className="ts-input" value={editingTrade.openTime || ''}
                    onChange={(e) => handleDetailChange('openTime', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Symbol</label>
                  <input type="text" className="ts-input" value={editingTrade.symbol || ''}
                    onChange={(e) => handleDetailChange('symbol', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Direction</label>
                  <select className="ts-input" value={editingTrade.type}
                    onChange={(e) => handleDetailChange('type', e.target.value)}>
                    <option value="buy">BUY</option>
                    <option value="sell">SELL</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Playbook Setup</label>
                  <select className="ts-input" value={editingTrade.setup || 'Untagged'}
                    onChange={(e) => handleDetailChange('setup', e.target.value)}>
                    {getOptionsForTrade(editingTrade.setup).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Volume</label>
                  <input type="number" step="any" className="ts-input" value={editingTrade.volume ?? ''}
                    onChange={(e) => handleDetailChange('volume', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Profit / Loss ($)</label>
                  <input type="number" step="any" className="ts-input" value={editingTrade.profit ?? ''}
                    onChange={(e) => handleDetailChange('profit', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Entry Price</label>
                  <input type="number" step="any" className="ts-input" value={editingTrade.entryPrice ?? ''}
                    onChange={(e) => handleDetailChange('entryPrice', e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Exit Price</label>
                  <input type="number" step="any" className="ts-input" value={editingTrade.exitPrice ?? ''}
                    onChange={(e) => handleDetailChange('exitPrice', e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label style={labelStyle}>Emotional State</label>
                <div className="emotion-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {EMOTIONS.map((emo) => {
                    const active = (editingTrade.emotions || []).includes(emo);
                    return (
                      <button key={emo} type="button" onClick={() => toggleEmotion(emo)}
                        style={{
                          padding: '5px 10px', borderRadius: '14px', fontSize: '12px', cursor: 'pointer',
                          border: active ? '1px solid #2962ff' : '1px solid #363a45',
                          backgroundColor: active ? '#2962ff' : 'transparent', color: 'white'
                        }}>
                        {emo}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginTop: '16px' }}>
                <label style={labelStyle}>Trade Notes / Review</label>
                <textarea rows="4" className="ts-input" value={editingTrade.notes || ''}
                  onChange={(e) => handleDetailChange('notes', e.target.value)}
                  style={{ resize: 'vertical' }} />
              </div>
              <div style={{ marginTop: '16px' }}>
                <label style={labelStyle}>Chart Screenshot</label>
                <input type="file" ref={screenshotRef} accept="image/*" onChange={handleScreenshotUpload} style={{ display: 'none' }} />
                {!editingTrade.screenshot ? (
                  <button type="button" onClick={() => screenshotRef.current.click()} className="ts-btn ts-btn-ghost">📷 Upload Screenshot</button>
                ) : (
                  <div>
                    <img src={editingTrade.screenshot} alt="Chart" style={{ width: '100%', borderRadius: '8px', border: '1px solid var(--border-color)', maxHeight: '300px', objectFit: 'contain', background: '#000' }} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button type="button" onClick={() => screenshotRef.current.click()} className="ts-btn ts-btn-ghost">Replace</button>
                      <button type="button" onClick={() => handleDetailChange('screenshot', null)} className="ts-btn ts-btn-danger">Remove</button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '24px', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleDeleteFromDetail(editingTrade.id)} className="ts-btn ts-btn-danger">🗑️ Delete</button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => { setIsDetailOpen(false); setEditingTrade(null); }} className="ts-btn ts-btn-ghost">Cancel</button>
                  <button type="submit" className="ts-btn ts-btn-success">💾 Save</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' };
const overlayStyle = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 };