import { useState, useRef, useEffect, Fragment } from 'react';
import { Upload, Download, Pencil, Plus, Camera, Trash2, Save, StickyNote, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import { toDate, isTradeOpen, filterTradesGlobal, countGlobalFilter, sanitizeJournalFilters, sanitizeJournalColumns, moveColumnId } from '../utils/dateUtils';
import { getExcursion, optionalNumber } from '../utils/excursion';
import TradeContextFields from './TradeContextFields.jsx';
import { normalizeTradeContext, getTradeContextDisplay, contextCSVValue } from '../utils/tradeContext.js';
import { STORAGE_KEYS } from '../utils/storageKeys';
import { parseCSVToTrades } from '../utils/csvParser';
import { formatToLocalTime } from '../utils/tradeStats';

const EMOTIONS = ['Calm','Confident','Disciplined','Patient','FOMO','Revenge Trading','Anxious','Overconfident','Fearful','Greedy','Bored'];

function getTradePnL(t){ return Number(t.pnl ?? t.profit) || 0; }
function getOpenTime(t){ return t.openAt || t.openTime || t.date || ''; }
function getCloseTime(t){ return t.closeAt || t.closeTime || ''; }
function getTicket(t){ return t.brokerId || t.ticket || t.id || ''; }
function getDirection(t){
  const raw = String(t.direction || t.type || '').trim().toLowerCase();
  if (raw.includes('sell') || raw === 'short') return 'sell';
  return 'buy';
}
function getVolume(t){ return t.volume ?? t.size ?? 0; }
const EXIT_TYPES=[['','Not set'],['sl','Stop Loss'],['tp','Take Profit'],['manual','Manual Close'],['be','Breakeven']];
function formatDuration(t){ const o=toDate(getOpenTime(t)); const c=toDate(getCloseTime(t)); if(!o||!c) return '—'; const mins=Math.round((c-o)/60000); if(mins<0) return '—'; const d=Math.floor(mins/1440); const h=Math.floor((mins%1440)/60); const m=mins%60; if(d>0) return `${d}d ${h}h`; if(h>0) return `${h}h ${m}m`; return `${m}m`; }
function normalizeType(raw){
  const s = String(raw||'').trim().toLowerCase();
  if (!s) return 'buy';
  if (s.includes('sell') || s.includes('short')) return 'sell';
  if (s.includes('buy') || s.includes('long')) return 'buy';
  return 'buy';
}
function todayLocal(){ const d=new Date(); const p=(n)=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`; }
function cleanNumber(val){
  if (val===undefined||val===null) return 0;
  let s=String(val).trim(); if(!s) return 0;
  s=s.replace(/["'\s$€£₦]/g,'');
  if(s.startsWith('(')&&s.endsWith(')')) s='-'+s.slice(1,-1);
  // Turn phone-keyboard dashes into a plain "-" (same 5 characters as before,
  // written as plain code numbers so there is nothing odd to mistype).
  s=s.split('').map((ch)=>{
    const c=ch.charCodeAt(0);
    const isFancyDash=(c>=0x2012&&c<=0x2015)||c===0x2212;
    return isFancyDash?'-':ch;
  }).join('');
  if(s.includes(',')&&s.includes('.')){ if(s.lastIndexOf(',')>s.lastIndexOf('.')) s=s.replace(/\./g,'').replace(',','.'); else s=s.replace(/,/g,''); }
  else if(s.includes(',')){ const cparts=s.split(','); const ctail=cparts[cparts.length-1]; if(cparts.length===2&&/^\d{1,2}$/.test(ctail)) s=s.replace(',', '.'); else s=s.replace(/,/g,''); }
  const match=s.match(/-?\d+(\.\d+)?/);
  return match?parseFloat(match[0])||0:0;
}

// All 25 toggleable journal columns in default order. The Action column is
// fixed (always visible, always last) so edit/delete are never lost.
const JOURNAL_ALL_COLUMNS = [
  { id: 'ticket', label: 'Ticket' },
  { id: 'status', label: 'Status' },
  { id: 'open', label: 'Open (Local)' },
  { id: 'close', label: 'Close (Local)' },
  { id: 'symbol', label: 'Symbol' },
  { id: 'dir', label: 'Dir' },
  { id: 'vol', label: 'Vol' },
  { id: 'entry', label: 'Entry' },
  { id: 'sl', label: 'SL' },
  { id: 'tp', label: 'TP' },
  { id: 'exit', label: 'Exit' },
  { id: 'comm', label: 'Comm' },
  { id: 'swap', label: 'Swap' },
  { id: 'pnl', label: 'Net P&L' },
  { id: 'mfeR', label: 'MFE (R)' },
  { id: 'maeR', label: 'MAE (R)' },
  { id: 'mfeMoney', label: 'MFE Money' },
  { id: 'maeMoney', label: 'MAE Money' },
  { id: 'outcome', label: 'Outcome' },
  { id: 'setup', label: 'Setup' },
  { id: 'entryTimeframe', label: 'Entry Timeframe' },
  { id: 'marketCondition', label: 'Market Condition' },
  { id: 'entryExecution', label: 'Entry Execution' },
  { id: 'slManagement', label: 'SL Management' },
  { id: 'tpManagement', label: 'TP Management' },
];
const JOURNAL_ALL_IDS = JOURNAL_ALL_COLUMNS.map((c) => c.id);
const JOURNAL_HEAD_CELLS = {
  ticket: <th>Ticket</th>,
  status: <th>Status</th>,
  open: <th>Open (Local)</th>,
  close: <th>Close (Local)</th>,
  symbol: <th>Symbol</th>,
  dir: <th className="center">Dir</th>,
  vol: <th className="num">Vol</th>,
  entry: <th className="num">Entry</th>,
  sl: <th className="num">SL</th>,
  tp: <th className="num">TP</th>,
  exit: <th className="num">Exit</th>,
  comm: <th className="num">Comm</th>,
  swap: <th className="num">Swap</th>,
  pnl: <th className="num">Net P&L</th>,
  mfeR: <th>MFE (R)</th>,
  maeR: <th>MAE (R)</th>,
  mfeMoney: <th>MFE Money</th>,
  maeMoney: <th>MAE Money</th>,
  outcome: <th>Outcome</th>,
  setup: <th>Setup</th>,
  entryTimeframe: <th>Entry Timeframe</th>,
  marketCondition: <th>Market Condition</th>,
  entryExecution: <th>Entry Execution</th>,
  slManagement: <th>SL Management</th>,
  tpManagement: <th>TP Management</th>,
};
// Export value per column id. visibleIds drives which columns (and which
// order) land in the CSV; 'notes' is always appended last since it has no
// table column but must never be silently dropped from an export.
const JOURNAL_EXPORT_COLUMNS = {
  ticket: { header: 'Ticket', value: (t) => getTicket(t) },
  status: { header: 'Status', value: (t) => (isTradeOpen(t) ? 'Open' : 'Closed') },
  open: { header: 'Open Time', value: (t) => getOpenTime(t) },
  close: { header: 'Close Time', value: (t) => getCloseTime(t) },
  symbol: { header: 'Symbol', value: (t) => t.symbol },
  dir: { header: 'Type', value: (t) => getDirection(t) },
  vol: { header: 'Volume', value: (t) => getVolume(t) },
  entry: { header: 'Entry', value: (t) => t.entryPrice },
  sl: { header: 'SL', value: (t) => t.stopLoss ?? '' },
  tp: { header: 'TP', value: (t) => t.takeProfit ?? '' },
  exit: { header: 'Exit', value: (t) => t.exitPrice },
  comm: { header: 'Commission', value: (t) => t.commission ?? 0 },
  swap: { header: 'Swap', value: (t) => t.swap ?? 0 },
  pnl: { header: 'Profit', value: (t) => getTradePnL(t) },
  mfeR: { header: 'MFE (R)', value: (t) => getExcursion(t).mfeR ?? '' },
  maeR: { header: 'MAE (R)', value: (t) => getExcursion(t).maeR ?? '' },
  mfeMoney: { header: 'MFE Money', value: (t) => getExcursion(t).mfeMoney ?? '' },
  maeMoney: { header: 'MAE Money', value: (t) => getExcursion(t).maeMoney ?? '' },
  outcome: { header: 'Outcome', value: (t) => getExcursion(t).outcome ?? '' },
  setup: { header: 'Setup', value: (t) => t.setup || 'Untagged' },
  entryTimeframe: { header: 'Entry Timeframe', value: (t) => contextCSVValue(t, 'entryTimeframe') },
  marketCondition: { header: 'Market Condition', value: (t) => contextCSVValue(t, 'marketCondition') },
  entryExecution: { header: 'Entry Execution', value: (t) => contextCSVValue(t, 'entryExecution') },
  slManagement: { header: 'SL Management', value: (t) => contextCSVValue(t, 'slManagement') },
  tpManagement: { header: 'TP Management', value: (t) => contextCSVValue(t, 'tpManagement') },
  notes: { header: 'Notes', value: (t) => `"${String(t.notes||'').replace(/"/g,'""')}"` },
};
function readJournalJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch { return fallback; }
}
function writeJournalJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full/blocked */ }
}
function loadJournalFilters() { return sanitizeJournalFilters(readJournalJSON(STORAGE_KEYS.journalFilters, null)); }
function loadJournalColumns() { return sanitizeJournalColumns(readJournalJSON(STORAGE_KEYS.journalColumns, null), JOURNAL_ALL_IDS); }
function ExcursionFields({ trade, onChange, sym }) {
  const ex=getExcursion(trade);
  const show=(r,m)=>r===null?'Not recorded':`${r.toFixed(2)}R${m===null?'':` (${m<0?'-':''}${sym}${Math.abs(m).toFixed(2)})`}`;
  return (
    <fieldset style={{marginTop:'16px',border:'1px solid var(--border-color)',borderRadius:'8px',padding:'12px'}}>
      <legend>Trade excursion and outcome</legend>
      <p style={{fontSize:'12px',color:'var(--text-secondary)'}}>Use original risk as 1R. Record extremes only while the trade was open, including the exit. Use net-of-costs figures to match Net P&amp;L. Blank means unknown; zero means confirmed none.</p>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:'12px'}}>
        <label>Max R reached - MFE<input className="ts-input" type="number" step="any" min="0" value={trade.mfeR??''} onChange={e=>onChange('mfeR',e.target.value)} placeholder="e.g. 5" /></label>
        <label>Max adverse R - MAE<input className="ts-input" type="number" step="any" max="0" value={trade.maeR??''} onChange={e=>onChange('maeR',e.target.value)} placeholder="e.g. -0.6" /></label>
      </div>
      <p aria-live="polite">MFE: {show(ex.mfeR,ex.mfeMoney)} / MAE: {show(ex.maeR,ex.maeMoney)}</p>
      <p>Outcome: <strong>{ex.outcome}</strong>{ex.capture===null?'':` / Capture: ${ex.capture.toFixed(1)}%`}</p>
      {ex.realisedR!==null&&<p>Realised: {ex.realisedR.toFixed(2)}R</p>}
      {ex.error&&<p role="alert" style={{color:'var(--color-loss)'}}>{ex.error}</p>}
      <p style={{fontSize:'12px',color:'var(--text-secondary)'}}>Money equivalents need positive original risk. Capture labels describe results, not plan quality. For a breakeven exit with costs, select Breakeven as Exit Type.</p>
    </fieldset>
  );
}

export default function Journal({ trades=[], setTrades, playbooks=[], logActivity, settings, globalFilter=null, onOpenFilters=null }){
  const brokerUtcOffset = settings?.brokerUtcOffset ?? 2;
  const sym = ({ USD: '$', EUR: '€', GBP: '£', NGN: '₦' })[settings?.currency] || '$';
  const [isModalOpen,setIsModalOpen]=useState(false);
  const [isDetailOpen,setIsDetailOpen]=useState(false);
  const [editingTrade,setEditingTrade]=useState(null);
  const [search,setSearch]=useState(()=>loadJournalFilters().search);
  const [sortOrder,setSortOrder]=useState(()=>loadJournalFilters().sort);
  const [filterReview,setFilterReview]=useState(()=>loadJournalFilters().review);
  const [filterStatus,setFilterStatus]=useState(()=>loadJournalFilters().status);
  const [colPrefs,setColPrefs]=useState(()=>loadJournalColumns());
  const [colPanelOpen,setColPanelOpen]=useState(false);
  useEffect(()=>{ writeJournalJSON(STORAGE_KEYS.journalFilters,{search,sort:sortOrder,review:filterReview,status:filterStatus}); },[search,sortOrder,filterReview,filterStatus]);
  useEffect(()=>{ writeJournalJSON(STORAGE_KEYS.journalColumns,colPrefs); },[colPrefs]);
  const setupOptions=['Untagged',...playbooks.map(p=>p.title)];
  const activeFilters=countGlobalFilter(globalFilter);
  const visibleIds=colPrefs.order.filter((id)=>colPrefs.visible.includes(id));
  const hiddenCount=JOURNAL_ALL_IDS.length-colPrefs.visible.length;
  const toggleColumn=(id)=>setColPrefs((prev)=>{ const on=prev.visible.includes(id); if(on&&prev.visible.length<=1) return prev; return { order:prev.order, visible:on?prev.visible.filter((v)=>v!==id):[...prev.visible,id] }; });
  const moveColumn=(id,dir)=>setColPrefs((prev)=>({ order:moveColumnId(prev.order,id,dir), visible:prev.visible }));
  const resetColumns=()=>setColPrefs({ visible:JOURNAL_ALL_IDS.slice(), order:JOURNAL_ALL_IDS.slice() });
  const [formData,setFormData]=useState({ ...normalizeTradeContext({}), symbol:'EURUSD', type:'buy', volume:'0.01', entryPrice:'', exitPrice:'', stopLoss:'', takeProfit:'', profit:'', riskAmount:'', mfeR:'', maeR:'', exitType:'', setup:'Untagged', notes:'', openTime:todayLocal(), closeDate:todayLocal(), isOpen:false });
  const fileInputRef=useRef(null); const screenshotRef=useRef(null);
  useEffect(()=>{ if(!isModalOpen&&!isDetailOpen&&!colPanelOpen) return; document.body.style.overflow='hidden'; return ()=>{ document.body.style.overflow=''; }; },[isModalOpen,isDetailOpen,colPanelOpen]);
  function displayLocal(val){ return formatToLocalTime(val, brokerUtcOffset); }
  const handleImportClick=()=>fileInputRef.current.click();
  const handleFileUpload=(event)=>{
    const file=event.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(e)=>parseCSV(e.target.result,file.name);
    reader.readAsText(file); event.target.value='';
  };
  // Quick Import with the same duplicate protection as the Imports page:
  // rows whose ticket already exists are skipped and reported, never doubled.
  const parseCSV=(csvText,filename)=>{
    try{
      const parsed=parseCSVToTrades(csvText);
      const existingTickets=new Set(trades.map(t=>String(t.brokerId||t.ticket||t.id||'')).filter(Boolean));
      const fresh=[]; let dupes=0;
      for(const t of parsed){ const ticket=String(t.brokerId||t.ticket||''); if(ticket&&existingTickets.has(ticket)){ dupes++; continue; } if(ticket) existingTickets.add(ticket); fresh.push(t); }
      if(fresh.length>0){ setTrades(prev=>[...fresh,...prev]); if(logActivity) logActivity('import',filename,fresh.length); alert(`Successfully imported ${fresh.length} trades!${dupes>0?` (${dupes} duplicates skipped.)`:''}`); }
      else if(dupes>0) alert(`No new trades — all ${dupes} rows were duplicates of trades you already have.`);
      else alert('Could not parse trades. Please check the CSV format.');
    }catch(err){ console.error(err); alert('Error parsing CSV file.'); }
  };
  const handleExportCSV=()=>{
    if(trades.length===0) return alert('No trades to export.');
    const ids=[...visibleIds,'notes'];
    const headers=ids.map((id)=>JOURNAL_EXPORT_COLUMNS[id].header);
    const rows=trades.map((t)=>ids.map((id)=>JOURNAL_EXPORT_COLUMNS[id].value(t)));
    const csvContent=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
    const filename=`trades_export_${new Date().toISOString().slice(0,10)}.csv`;
    const blob=new Blob([csvContent],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
    const link=document.createElement('a'); link.href=url; link.setAttribute('download',filename); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    if(logActivity) logActivity('export',filename,trades.length);
  };
  const handleFormSubmit=(e)=>{
    e.preventDefault(); const id=String(Date.now()); const open=formData.openTime; const dir=normalizeType(formData.type);
    const newTrade={ ...normalizeTradeContext(formData), id, brokerId:id, ticket:id, openTime:open, openAt:open, closeAt:formData.isOpen?'':(formData.closeDate||''), symbol:formData.symbol.toUpperCase(), type:dir, direction:dir==='sell'?'Short':'Long', volume:cleanNumber(formData.volume), size:cleanNumber(formData.volume), entryPrice:cleanNumber(formData.entryPrice), exitPrice:cleanNumber(formData.exitPrice), stopLoss:cleanNumber(formData.stopLoss), takeProfit:cleanNumber(formData.takeProfit), exitType:formData.exitType||'', commission:0, swap:0, profit:cleanNumber(formData.profit), pnl:cleanNumber(formData.profit), riskAmount:cleanNumber(formData.riskAmount), mfeR:optionalNumber(formData.mfeR), maeR:optionalNumber(formData.maeR), setup:formData.setup||'Untagged', notes:formData.notes||'', emotions:[], rulesChecked:[], screenshot:null, reviewed:false };
    const excursionError=getExcursion(newTrade).error; if(excursionError) return alert(excursionError);
    setTrades([newTrade,...trades]); setIsModalOpen(false);
    setFormData({ ...normalizeTradeContext({}), symbol:'EURUSD', type:'buy', volume:'0.01', entryPrice:'', exitPrice:'', stopLoss:'', takeProfit:'', profit:'', riskAmount:'', mfeR:'', maeR:'', exitType:'', setup:'Untagged', notes:'', openTime:todayLocal(), closeDate:todayLocal(), isOpen:false });
  };
  // Retagging clears rule ticks — they belong to the previous playbook's rule set.
  const handleTagChange=(id,newSetup)=>setTrades(trades.map(t=>t.id===id?{...t,setup:newSetup,rulesChecked:[]}:t));
  const handleDeleteTrade=(id)=>{ if(confirm('Delete trade?')) setTrades(trades.filter(t=>t.id!==id)); };
  const handleOpenDetail=(trade)=>{ setEditingTrade({ ...trade, emotions:trade.emotions||[], notes:trade.notes||'', rulesChecked:trade.rulesChecked||[], screenshot:trade.screenshot||null, openTime:getOpenTime(trade), closeTime:getCloseTime(trade), type:getDirection(trade), volume:getVolume(trade), profit:getTradePnL(trade), stopLoss:trade.stopLoss??'', takeProfit:trade.takeProfit??'', commission:trade.commission??0, swap:trade.swap??0, ticket:getTicket(trade) }); setIsDetailOpen(true); };
  const handleDetailChange=(key,value)=>setEditingTrade(prev=>({...prev,[key]:value}));
  const toggleEmotion=(emo)=>setEditingTrade(prev=>{ const cur=prev.emotions||[]; return {...prev, emotions: cur.includes(emo)?cur.filter(e=>e!==emo):[...cur,emo]}; });
  const toggleRule=(rule)=>setEditingTrade(prev=>{ const cur=Array.isArray(prev.rulesChecked)?prev.rulesChecked:[]; return {...prev, rulesChecked: cur.includes(rule)?cur.filter(r=>r!==rule):[...cur,rule]}; });
  const handleScreenshotUpload=(e)=>{ const file=e.target.files[0]; if(!file) return; if(file.size>1.5*1024*1024) return alert('Image too large. Keep screenshots under 1.5MB.'); const reader=new FileReader(); reader.onload=(ev)=>setEditingTrade(prev=>({...prev,screenshot:ev.target.result})); reader.readAsDataURL(file); };
  const handleSaveDetail=(e)=>{ e.preventDefault(); if(!editingTrade) return; const dir=normalizeType(editingTrade.type); const net=cleanNumber(editingTrade.profit); const updated={ ...editingTrade, ...normalizeTradeContext(editingTrade), id:editingTrade.id, brokerId:editingTrade.ticket||editingTrade.brokerId||editingTrade.id, ticket:editingTrade.ticket||editingTrade.brokerId||editingTrade.id, openTime:editingTrade.openTime, openAt:editingTrade.openTime, closeAt:editingTrade.closeTime||editingTrade.closeAt||'', closeTime:editingTrade.closeTime||'', symbol:(editingTrade.symbol||'').toUpperCase(), type:dir, direction:dir==='sell'?'Short':'Long', volume:cleanNumber(editingTrade.volume), size:cleanNumber(editingTrade.volume), entryPrice:cleanNumber(editingTrade.entryPrice), exitPrice:cleanNumber(editingTrade.exitPrice), stopLoss:cleanNumber(editingTrade.stopLoss), takeProfit:cleanNumber(editingTrade.takeProfit), commission:cleanNumber(editingTrade.commission), swap:cleanNumber(editingTrade.swap), profit:net, pnl:net, riskAmount:cleanNumber(editingTrade.riskAmount), mfeR:optionalNumber(editingTrade.mfeR), maeR:optionalNumber(editingTrade.maeR), setup:editingTrade.setup||'Untagged' }; const excursionError=getExcursion(updated).error; if(excursionError) return alert(excursionError); setTrades(trades.map(t=>t.id===updated.id?updated:t)); setIsDetailOpen(false); setEditingTrade(null); };
  const handleDeleteFromDetail=(id)=>{ if(confirm('Delete this trade?')){ setTrades(trades.filter(t=>t.id!==id)); setIsDetailOpen(false); setEditingTrade(null);} };

  const filteredTrades=filterTradesGlobal(trades,globalFilter).filter(t=>{
    const q=search.toLowerCase().trim(); const ticket=String(getTicket(t)).toLowerCase();
    const matchesSearch=!q||String(t.symbol||'').toLowerCase().includes(q)||ticket.includes(q);
    const unrev=t.reviewed===false;
    const matchesReview=filterReview==='all'||(filterReview==='unreviewed'&&unrev)||(filterReview==='reviewed'&&!unrev);
    const tradeOpen=isTradeOpen(t);
    const matchesStatus=filterStatus==='all'||(filterStatus==='open'&&tradeOpen)||(filterStatus==='closed'&&!tradeOpen);
    return matchesSearch&&matchesReview&&matchesStatus;
  }).sort((a,b)=>{
    if(sortOrder==='pnlHigh') return getTradePnL(b)-getTradePnL(a);
    if(sortOrder==='pnlLow') return getTradePnL(a)-getTradePnL(b);
    const da=toDate(getOpenTime(a))?.getTime()||0; const db=toDate(getOpenTime(b))?.getTime()||0;
    return sortOrder==='oldest'?da-db:db-da;
  });

  const getOptionsForTrade=(current)=>{ if(!current||setupOptions.includes(current)) return setupOptions; return [...setupOptions,current]; };

  // Rules of the playbook currently selected in the detail modal (empty unless tagged).
  const detailPlaybook = editingTrade ? playbooks.find(p=>p.title===(editingTrade.setup||'Untagged')) : null;
  const detailRules = detailPlaybook ? (detailPlaybook.rules||[]).filter(r=>r.trim()!=='') : [];
  const detailChecked = editingTrade && Array.isArray(editingTrade.rulesChecked) ? editingTrade.rulesChecked : [];
  const riskAmt = editingTrade ? (Number(editingTrade.riskAmount)||0) : 0;
  const riskBal = Number(settings?.startingBalance) || 10000;
  const riskPctDisplay = riskAmt>0&&riskBal>0 ? (riskAmt/riskBal*100).toFixed(2)+'%' : '—';

  return (
    <div>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" style={{display:'none'}} />
      <div className="header-bar" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px',flexWrap:'wrap',gap:'16px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,color:'var(--text-bright)',margin:0}}>Trading Journal</h1>
          <p style={{color:'var(--text-secondary)',fontSize:'13px',margin:'4px 0 0 0'}}>Times shown in your local timezone (broker offset UTC{brokerUtcOffset>=0?'+':''}{brokerUtcOffset}). Click a row for detail.</p>
        </div>
        <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
          {trades.length>0&&<button onClick={handleExportCSV} className="ts-btn ts-btn-ghost"><Upload size={14} style={{verticalAlign:'-2px',marginRight:'6px'}} />Export</button>}
          <button onClick={handleImportClick} className="ts-btn ts-btn-primary"><Download size={14} style={{verticalAlign:'-2px',marginRight:'6px'}} />Quick Import</button>
          <button onClick={()=>setIsModalOpen(true)} className="ts-btn ts-btn-success">+ Log Trade</button>
        </div>
      </div>

      <div className="filter-bar" style={{display:'flex',gap:'12px',marginBottom:'20px',flexWrap:'wrap'}}>
        <input type="text" className="ts-input" placeholder="Search symbol or ticket..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,minWidth:'180px'}} />
        <select className="ts-input" value={sortOrder} onChange={e=>setSortOrder(e.target.value)} style={{width:'170px'}}>
          <option value="newest">Newest First</option><option value="oldest">Oldest First</option><option value="pnlHigh">Highest P&L</option><option value="pnlLow">Lowest P&L</option>
        </select>
        <button onClick={()=>{ if(onOpenFilters) onOpenFilters(); }} className="ts-btn" title="Global filters — one filter shared by Dashboard, Analytics & Journal" style={{display:'flex',alignItems:'center',gap:'6px'}}><Filter size={14} />Filters{activeFilters>0?` (${activeFilters})`:''}</button>
        <button onClick={()=>setColPanelOpen(true)} className="ts-btn" title="Show, hide and reorder journal columns" style={{display:'flex',alignItems:'center',gap:'6px'}}>Columns{hiddenCount>0?` (${hiddenCount} hidden)`:''}</button>
        <span style={{alignSelf:'center',fontSize:'12px',color:'var(--text-muted)'}}>{filteredTrades.length} of {trades.length} trades</span>
        <select className="ts-input" value={filterReview} onChange={e=>setFilterReview(e.target.value)} style={{width:'150px'}}>
          <option value="all">All Reviews</option><option value="unreviewed">Needs Review</option><option value="reviewed">Reviewed</option>
        </select>
        <select className="ts-input" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{width:'130px'}}>
          <option value="all">All Statuses</option><option value="open">Open</option><option value="closed">Closed</option>
        </select>
      </div>

      <div className="ts-card" style={{padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table className="ts-table">
            <thead><tr>{visibleIds.map((id)=><Fragment key={id}>{JOURNAL_HEAD_CELLS[id]}</Fragment>)}<th className="center">Action</th></tr></thead>
            <tbody>
              {filteredTrades.length===0?(
                <tr><td colSpan={visibleIds.length+1} style={{padding:'40px',textAlign:'center',color:'var(--text-secondary)'}}>No trades match filters.</td></tr>
              ):(
                filteredTrades.map((trade,index)=>{
                  const p=getTradePnL(trade); const dir=getDirection(trade); const tradeOpen=isTradeOpen(trade); const sl=Number(trade.stopLoss)||0; const tp=Number(trade.takeProfit)||0; const comm=Number(trade.commission)||0; const swap=Number(trade.swap)||0;
                  const ex=getExcursion(trade);
                  const context=getTradeContextDisplay(trade);
                  const cells={
                    entryTimeframe:(<td>{context.entryTimeframe||'—'}</td>),
                    marketCondition:(<td>{context.marketCondition||'—'}</td>),
                    entryExecution:(<td>{context.entryExecution||'—'}</td>),
                    slManagement:(<td>{context.slManagement||'—'}</td>),
                    tpManagement:(<td>{context.tpManagement||'—'}</td>),
                    ticket:(<td className="number-font" style={{color:'var(--text-secondary)',fontSize:'12px'}}>{getTicket(trade)}</td>),
                    status:(<td><span style={{fontSize:'11px',fontWeight:700,padding:'3px 8px',borderRadius:'10px',backgroundColor:tradeOpen?'rgba(255,171,0,0.15)':'rgba(0,230,118,0.10)',color:tradeOpen?'#ffab00':'var(--color-win)'}}>{tradeOpen?'Open':'Closed'}</span></td>),
                    open:(<td className="number-font" style={{color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{displayLocal(getOpenTime(trade))}</td>),
                    close:(<td className="number-font" style={{color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{getCloseTime(trade)?displayLocal(getCloseTime(trade)):'—'}</td>),
                    symbol:(<td style={{fontWeight:700,color:'var(--text-bright)'}}>{trade.symbol}{trade.notes?<span style={{marginLeft:'6px'}}><StickyNote size={13} style={{verticalAlign:'-2px'}} /></span>:null}{trade.screenshot?<span style={{marginLeft:'4px'}}><Camera size={13} style={{verticalAlign:'-2px'}} /></span>:null}</td>),
                    dir:(<td className="center"><span className={dir==='buy'?'badge-buy':'badge-sell'}>{dir.toUpperCase()}</span></td>),
                    vol:(<td className="num number-font">{getVolume(trade)}</td>),
                    entry:(<td className="num number-font">{trade.entryPrice||'—'}</td>),
                    sl:(<td className="num number-font" style={{color:'var(--text-secondary)'}}>{sl||'—'}</td>),
                    tp:(<td className="num number-font" style={{color:'var(--text-secondary)'}}>{tp||'—'}</td>),
                    exit:(<td className="num number-font">{trade.exitPrice||'—'}</td>),
                    comm:(<td className="num number-font" style={{color:'var(--text-secondary)'}}>{comm?comm.toFixed(2):'—'}</td>),
                    swap:(<td className="num number-font" style={{color:'var(--text-secondary)'}}>{swap?swap.toFixed(2):'—'}</td>),
                    pnl:(<td className="num number-font" style={{fontWeight:700,color:p>=0?'var(--color-win)':'var(--color-loss)'}}>{p>=0?`+${sym}${p.toFixed(2)}`:`-${sym}${Math.abs(p).toFixed(2)}`}</td>),
                    mfeR:(<td className="num number-font">{ex.mfeR===null?'—':ex.mfeR.toFixed(2)}</td>),
                    maeR:(<td className="num number-font">{ex.maeR===null?'—':ex.maeR.toFixed(2)}</td>),
                    mfeMoney:(<td className="num number-font">{ex.mfeMoney===null?'—':ex.mfeMoney.toFixed(2)}</td>),
                    maeMoney:(<td className="num number-font">{ex.maeMoney===null?'—':ex.maeMoney.toFixed(2)}</td>),
                    outcome:(<td className="num number-font">{ex.outcome}</td>),
                    setup:(<td onClick={e=>e.stopPropagation()}><select value={trade.setup||'Untagged'} onChange={e=>handleTagChange(trade.id,e.target.value)} style={{backgroundColor:'var(--bg-main)',color:trade.setup==='Untagged'?'var(--text-muted)':'var(--accent-blue)',border:'1px solid var(--border-color)',borderRadius:'4px',padding:'4px 8px',fontSize:'12px',fontWeight:600}}>{getOptionsForTrade(trade.setup).map(s=><option key={s} value={s}>{s}</option>)}</select></td>),
                  };
                  return (
                    <tr key={String(getTicket(trade))+'-'+index} onClick={()=>handleOpenDetail(trade)} style={{cursor:'pointer'}}>
                      {visibleIds.map((id)=><Fragment key={id}>{cells[id]}</Fragment>)}
                      <td className="center" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>handleOpenDetail(trade)} style={{background:'none',border:'none',cursor:'pointer',fontSize:'15px',marginRight:'8px'}}><Pencil size={15} style={{verticalAlign:'middle'}} /></button>
                        <button onClick={()=>handleDeleteTrade(trade.id)} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'15px'}}>✕</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>


      {colPanelOpen && (
        <div style={overlayStyle}>
          <div className="ts-card modal-mobile" style={{margin:'auto',width:'420px',maxWidth:'92%',maxHeight:'86vh',overflowY:'auto',backgroundColor:'var(--bg-surface)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
              <h2 style={{margin:0,fontSize:'18px'}}>Journal Columns</h2>
              <button onClick={()=>setColPanelOpen(false)} className="ts-btn ts-btn-ghost">Close</button>
            </div>
            <p style={{fontSize:'12px',color:'var(--text-secondary)',marginTop:0}}>Tick columns to show them. Arrows reorder. Action stays fixed on the right.</p>
            <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
              {colPrefs.order.map((id,index)=>{
                const col=JOURNAL_ALL_COLUMNS.find((c)=>c.id===id);
                if(!col) return null;
                const on=colPrefs.visible.includes(id);
                const lastOne=on&&colPrefs.visible.length<=1;
                return (
                  <div key={id} style={{display:'flex',alignItems:'center',gap:'8px',backgroundColor:'var(--bg-main)',border:'1px solid var(--border-color)',borderRadius:'8px',padding:'8px 10px'}}>
                    <button type="button" onClick={()=>moveColumn(id,-1)} disabled={index===0} className="ts-btn ts-btn-ghost" style={{padding:'4px 8px'}} title="Move up"><ChevronUp size={14} /></button>
                    <button type="button" onClick={()=>moveColumn(id,1)} disabled={index===colPrefs.order.length-1} className="ts-btn ts-btn-ghost" style={{padding:'4px 8px'}} title="Move down"><ChevronDown size={14} /></button>
                    <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',cursor:lastOne?'not-allowed':'pointer',color:'var(--text-bright)',flex:1}}>
                      <input type="checkbox" checked={on} disabled={lastOne} onChange={()=>toggleColumn(id)} style={{width:'16px',height:'16px',accentColor:'#2962ff',cursor:lastOne?'not-allowed':'pointer'}} />
                      {col.label}
                    </label>
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:'16px'}}>
              <button type="button" onClick={resetColumns} className="ts-btn ts-btn-ghost">Reset to default</button>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <div style={overlayStyle}>
          <div className="ts-card modal-mobile" style={{margin:'auto',width:'520px',maxWidth:'92%',backgroundColor:'var(--bg-surface)'}}>
            <h2 style={{marginTop:0,marginBottom:'20px',fontSize:'18px',display:'flex',alignItems:'center',gap:'8px'}}><Plus size={18} /> Log Manual Trade</h2>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-mobile-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
                <div><label style={labelStyle}>Date</label><input type="date" className="ts-input" value={formData.openTime} onChange={e=>setFormData({...formData,openTime:e.target.value})} required /></div>
                <div><label style={labelStyle}>Close Date</label><input type="date" className="ts-input" value={formData.closeDate} onChange={e=>setFormData({...formData,closeDate:e.target.value})} disabled={formData.isOpen} required={!formData.isOpen} /></div>
                <div><label style={labelStyle}>Symbol</label><input type="text" className="ts-input" value={formData.symbol} onChange={e=>setFormData({...formData,symbol:e.target.value})} required /></div>
                <div><label style={labelStyle}>Direction</label><select className="ts-input" value={formData.type} onChange={e=>setFormData({...formData,type:e.target.value})}><option value="buy">BUY</option><option value="sell">SELL</option></select></div>
                <div><label style={labelStyle}>Volume</label><input type="number" step="any" className="ts-input" value={formData.volume} onChange={e=>setFormData({...formData,volume:e.target.value})} required /></div>
                <div><label style={labelStyle}>Entry Price</label><input type="number" step="any" className="ts-input" value={formData.entryPrice} onChange={e=>setFormData({...formData,entryPrice:e.target.value})} required /></div>
                <div><label style={labelStyle}>Exit Price</label><input type="number" step="any" className="ts-input" value={formData.exitPrice} onChange={e=>setFormData({...formData,exitPrice:e.target.value})} disabled={formData.isOpen} required={!formData.isOpen} /></div>
                <div><label style={labelStyle}>Stop Loss</label><input type="number" step="any" className="ts-input" value={formData.stopLoss} onChange={e=>setFormData({...formData,stopLoss:e.target.value})} /></div>
                <div><label style={labelStyle}>Take Profit</label><input type="number" step="any" className="ts-input" value={formData.takeProfit} onChange={e=>setFormData({...formData,takeProfit:e.target.value})} /></div>
                <div><label style={labelStyle}>Setup</label><select className="ts-input" value={formData.setup} onChange={e=>setFormData({...formData,setup:e.target.value})}>{setupOptions.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                <div><label style={labelStyle}>Profit / Loss ({sym})</label><input type="number" step="0.01" className="ts-input" value={formData.profit} onChange={e=>setFormData({...formData,profit:e.target.value})} required={!formData.isOpen} /></div>
                <div><label style={labelStyle}>Risk ({sym})</label><input type="number" step="0.01" className="ts-input" value={formData.riskAmount} onChange={e=>setFormData({...formData,riskAmount:e.target.value})} /></div>
                <div><label style={labelStyle}>Exit Type</label><select className="ts-input" value={formData.exitType} onChange={e=>setFormData({...formData,exitType:e.target.value})}>{EXIT_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
                <div style={{display:'flex',alignItems:'flex-end'}}><label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',cursor:'pointer',color:'var(--text-bright)'}}><input type="checkbox" checked={formData.isOpen} onChange={e=>setFormData({...formData,isOpen:e.target.checked})} style={{width:'16px',height:'16px',accentColor:'#2962ff',cursor:'pointer'}} />Still open (no exit yet)</label></div>
              </div>
              <TradeContextFields trade={formData} onChange={(key,value)=>setFormData(prev=>({...prev,[key]:value}))} />
              <ExcursionFields trade={{...formData,closeAt:formData.isOpen?'':formData.closeDate,exitPrice:formData.isOpen?'':formData.exitPrice}} onChange={(key,value)=>setFormData(prev=>({...prev,[key]:value}))} sym={sym} />
              <div style={{marginTop:'14px'}}><label style={labelStyle}>Notes (optional)</label><textarea rows="2" className="ts-input" value={formData.notes} onChange={e=>setFormData({...formData,notes:e.target.value})} placeholder="Plan, mistakes, lessons..." style={{resize:'vertical'}} /></div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'10px',marginTop:'24px'}}>
                <button type="button" onClick={()=>setIsModalOpen(false)} className="ts-btn ts-btn-ghost">Cancel</button>
                <button type="submit" className="ts-btn ts-btn-success">Save Trade</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailOpen && editingTrade && (
        <div style={overlayStyle}>
          <div className="ts-card modal-mobile" style={{margin:'auto',width:'720px',maxWidth:'96%',maxHeight:'90vh',overflowY:'auto',backgroundColor:'var(--bg-surface)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
              <div>
                <h2 style={{margin:0,fontSize:'18px'}}>{editingTrade.symbol} — Trade Detail</h2>
                <p style={{margin:'4px 0 0 0',fontSize:'12px',color:'var(--text-secondary)'}}>Ticket #{editingTrade.ticket||editingTrade.id} · Local: {displayLocal(editingTrade.openTime)}{editingTrade.closeTime?` → ${displayLocal(editingTrade.closeTime)}`:''} · Duration: {formatDuration(editingTrade)} · {isTradeOpen(editingTrade)?'Open':'Closed'}</p>
              </div>
              <button onClick={()=>{setIsDetailOpen(false);setEditingTrade(null);}} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'18px'}}>✕</button>
            </div>
            <form onSubmit={handleSaveDetail}>
              <p style={{fontSize:'11px',color:'var(--text-muted)',marginTop:0}}>Open/Close fields below are raw broker server time (not converted). Table shows local time.</p>
              <div className="modal-mobile-grid" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
                <div><label style={labelStyle}>Ticket</label><input type="text" className="ts-input" value={editingTrade.ticket||''} onChange={e=>handleDetailChange('ticket',e.target.value)} /></div>
                <div><label style={labelStyle}>Open Time (broker)</label><input type="text" className="ts-input" value={editingTrade.openTime||''} onChange={e=>handleDetailChange('openTime',e.target.value)} /></div>
                <div><label style={labelStyle}>Close Time (broker)</label><input type="text" className="ts-input" value={editingTrade.closeTime||''} onChange={e=>handleDetailChange('closeTime',e.target.value)} /></div>
                <div><label style={labelStyle}>Symbol</label><input type="text" className="ts-input" value={editingTrade.symbol||''} onChange={e=>handleDetailChange('symbol',e.target.value)} /></div>
                <div><label style={labelStyle}>Direction</label><select className="ts-input" value={editingTrade.type} onChange={e=>handleDetailChange('type',e.target.value)}><option value="buy">BUY</option><option value="sell">SELL</option></select></div>
                <div><label style={labelStyle}>Volume</label><input type="number" step="any" className="ts-input" value={editingTrade.volume??''} onChange={e=>handleDetailChange('volume',e.target.value)} /></div>
                <div><label style={labelStyle}>Entry</label><input type="number" step="any" className="ts-input" value={editingTrade.entryPrice??''} onChange={e=>handleDetailChange('entryPrice',e.target.value)} /></div>
                <div><label style={labelStyle}>Stop Loss</label><input type="number" step="any" className="ts-input" value={editingTrade.stopLoss??''} onChange={e=>handleDetailChange('stopLoss',e.target.value)} /></div>
                <div><label style={labelStyle}>Take Profit</label><input type="number" step="any" className="ts-input" value={editingTrade.takeProfit??''} onChange={e=>handleDetailChange('takeProfit',e.target.value)} /></div>
                <div><label style={labelStyle}>Exit</label><input type="number" step="any" className="ts-input" value={editingTrade.exitPrice??''} onChange={e=>handleDetailChange('exitPrice',e.target.value)} /></div>
                <div><label style={labelStyle}>Commission</label><input type="number" step="any" className="ts-input" value={editingTrade.commission??''} onChange={e=>handleDetailChange('commission',e.target.value)} /></div>
                <div><label style={labelStyle}>Swap</label><input type="number" step="any" className="ts-input" value={editingTrade.swap??''} onChange={e=>handleDetailChange('swap',e.target.value)} /></div>
                <div><label style={labelStyle}>Net P&L ({sym})</label><input type="number" step="any" className="ts-input" value={editingTrade.profit??''} onChange={e=>handleDetailChange('profit',e.target.value)} /></div>
                <div><label style={labelStyle}>Risk ({sym})</label><input type="number" step="0.01" className="ts-input" value={editingTrade.riskAmount??''} onChange={e=>handleDetailChange('riskAmount',e.target.value)} /></div>
                <div><label style={labelStyle}>Risk % of Balance</label><input type="text" className="ts-input" value={riskPctDisplay} readOnly style={{color:'var(--text-bright)',fontWeight:700}} /></div>
                <div><label style={labelStyle}>Playbook Setup</label><select className="ts-input" value={editingTrade.setup||'Untagged'} onChange={e=>{handleDetailChange('setup',e.target.value); setEditingTrade(prev=>({...prev,rulesChecked:[]}));}}>{getOptionsForTrade(editingTrade.setup).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                <div><label style={labelStyle}>Exit Type</label><select className="ts-input" value={editingTrade.exitType||''} onChange={e=>handleDetailChange('exitType',e.target.value)}>{EXIT_TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
              </div>
              <TradeContextFields trade={editingTrade} onChange={handleDetailChange} />
              <ExcursionFields trade={{...editingTrade,pnl:editingTrade.profit,closeAt:editingTrade.closeTime}} onChange={handleDetailChange} sym={sym} />
              <div style={{marginTop:'12px'}}>
                <label style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'13px',cursor:'pointer',color:'var(--text-bright)'}}>
                  <input type="checkbox" checked={editingTrade.reviewed!==false} onChange={e=>handleDetailChange('reviewed',e.target.checked)} style={{width:'16px',height:'16px',accentColor:'#2962ff',cursor:'pointer'}} />
                  Mark this trade as reviewed
                </label>
              </div>
              {detailPlaybook && detailRules.length>0 && (
                <div style={{marginTop:'16px'}}>
                  <label style={labelStyle}>Playbook Checklist — tick the rules you followed</label>
                  <div style={{display:'flex',flexDirection:'column',gap:'8px',backgroundColor:'var(--bg-main)',border:'1px solid var(--border-color)',borderRadius:'8px',padding:'12px'}}>
                    {detailRules.map(rule=>(
                      <label key={rule} style={{display:'flex',alignItems:'center',gap:'10px',fontSize:'13px',cursor:'pointer',color:detailChecked.includes(rule)?'var(--text-primary)':'var(--text-secondary)'}}>
                        <input type="checkbox" checked={detailChecked.includes(rule)} onChange={()=>toggleRule(rule)} style={{width:'16px',height:'16px',accentColor:'#2962ff',cursor:'pointer',flexShrink:0}} />
                        <span>{rule}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {detailPlaybook && detailRules.length===0 && (
                <div style={{marginTop:'16px'}}>
                  <label style={labelStyle}>Playbook Checklist</label>
                  <p style={{fontSize:'12px',color:'var(--text-muted)',margin:0}}>This playbook has no checklist rules yet — add some on the Playbooks page.</p>
                </div>
              )}
              <div style={{marginTop:'16px'}}>
                <label style={labelStyle}>Emotional State</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                  {EMOTIONS.map(emo=>{
                    const active=(editingTrade.emotions||[]).includes(emo);
                    return <button key={emo} type="button" onClick={()=>toggleEmotion(emo)} style={{padding:'5px 10px',borderRadius:'14px',fontSize:'12px',cursor:'pointer',border:active?'1px solid var(--accent-blue)':'1px solid #363a45',backgroundColor:active?'var(--accent-blue)':'transparent',color:active?'white':'var(--text-bright)'}}>{emo}</button>;
                  })}
                </div>
              </div>
              <div style={{marginTop:'16px'}}><label style={labelStyle}>Trade Notes / Review</label><textarea rows="4" className="ts-input" value={editingTrade.notes||''} onChange={e=>handleDetailChange('notes',e.target.value)} style={{resize:'vertical'}} /></div>
              <div style={{marginTop:'16px'}}>
                <label style={labelStyle}>Chart Screenshot</label>
                <input type="file" ref={screenshotRef} accept="image/*" onChange={handleScreenshotUpload} style={{display:'none'}} />
                {!editingTrade.screenshot?(
                  <button type="button" onClick={()=>screenshotRef.current.click()} className="ts-btn ts-btn-ghost"><Camera size={14} style={{verticalAlign:'-2px',marginRight:'6px'}} />Upload Screenshot</button>
                ):(
                  <div><img src={editingTrade.screenshot} alt="Chart" style={{width:'100%',borderRadius:'8px',border:'1px solid var(--border-color)',maxHeight:'300px',objectFit:'contain',background:'#000'}} /><div style={{display:'flex',gap:'8px',marginTop:'8px'}}><button type="button" onClick={()=>screenshotRef.current.click()} className="ts-btn ts-btn-ghost">Replace</button><button type="button" onClick={()=>handleDetailChange('screenshot',null)} className="ts-btn ts-btn-danger">Remove</button></div></div>
                )}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',gap:'10px',marginTop:'24px',flexWrap:'wrap'}}>
                <button type="button" onClick={()=>handleDeleteFromDetail(editingTrade.id)} className="ts-btn ts-btn-danger"><Trash2 size={14} style={{verticalAlign:'-2px',marginRight:'6px'}} />Delete</button>
                <div style={{display:'flex',gap:'10px'}}><button type="button" onClick={()=>{setIsDetailOpen(false);setEditingTrade(null);}} className="ts-btn ts-btn-ghost">Cancel</button><button type="submit" className="ts-btn ts-btn-success"><Save size={14} style={{verticalAlign:'-2px',marginRight:'6px'}} />Save</button></div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
const labelStyle={display:'block',fontSize:'12px',color:'var(--text-secondary)',marginBottom:'4px'};
const overlayStyle={position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.8)',backdropFilter:'blur(4px)',display:'flex',overflowY:'auto',padding:'24px 12px',zIndex:2000};