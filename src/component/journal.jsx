import { useState, useRef } from 'react';
import { Upload, Download, Pencil, Plus, Camera, Trash2, Save, StickyNote } from 'lucide-react';
import { toDate } from '../utils/dateUtils';
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
function normalizeType(raw){
  const s = String(raw||'').trim().toLowerCase();
  if (!s) return 'buy';
  if (s.includes('sell') || s.includes('short')) return 'sell';
  if (s.includes('buy') || s.includes('long')) return 'buy';
  return 'buy';
}
function cleanNumber(val){
  if (val===undefined||val===null) return 0;
  let s=String(val).trim(); if(!s) return 0;
  s=s.replace(/["'\s$€£₦]/g,'');
  if(s.startsWith('(')&&s.endsWith(')')) s='-'+s.slice(1,-1);
  s=s.replace(/[\u2012\u2013\u2014\u2015\u2212]/g,'-');
  if(s.includes(',')&&s.includes('.')) s=s.replace(/,/g,'');
  else if(s.includes(',')&&!s.includes('.')) s=s.replace(',', '.');
  const match=s.match(/-?\d+(\.\d+)?/);
  return match?parseFloat(match[0])||0:0;
}

export default function Journal({ trades=[], setTrades, playbooks=[], logActivity, settings }){
  const brokerUtcOffset = settings?.brokerUtcOffset ?? 2;
  const [isModalOpen,setIsModalOpen]=useState(false);
  const [isDetailOpen,setIsDetailOpen]=useState(false);
  const [editingTrade,setEditingTrade]=useState(null);
  const [search,setSearch]=useState('');
  const [filterType,setFilterType]=useState('all');
  const [filterSetup,setFilterSetup]=useState('all');
  const [sortOrder,setSortOrder]=useState('newest');
  const setupOptions=['Untagged',...playbooks.map(p=>p.title)];
  const [formData,setFormData]=useState({ symbol:'EURUSD', type:'buy', volume:'0.01', entryPrice:'', exitPrice:'', stopLoss:'', takeProfit:'', profit:'', setup:'Untagged', notes:'', openTime:new Date().toISOString().slice(0,10) });
  const fileInputRef=useRef(null); const screenshotRef=useRef(null);
  function displayLocal(val){ return formatToLocalTime(val, brokerUtcOffset); }
  const handleImportClick=()=>fileInputRef.current.click();
  const handleFileUpload=(event)=>{
    const file=event.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(e)=>parseCSV(e.target.result,file.name);
    reader.readAsText(file); event.target.value='';
  };
  const parseCSV=(csvText,filename)=>{
    try{
      const newTrades=parseCSVToTrades(csvText);
      if(newTrades.length>0){ setTrades(prev=>[...newTrades,...prev]); if(logActivity) logActivity('import',filename,newTrades.length); alert(`Successfully imported ${newTrades.length} trades!`); }
      else alert('Could not parse trades. Please check the CSV format.');
    }catch(err){ console.error(err); alert('Error parsing CSV file.'); }
  };
  const handleExportCSV=()=>{
    if(trades.length===0) return alert('No trades to export.');
    const headers=['Ticket','Open Time','Close Time','Symbol','Type','Volume','Entry','SL','TP','Exit','Commission','Swap','Profit','Setup','Notes'];
    const rows=trades.map(t=>[getTicket(t),getOpenTime(t),getCloseTime(t),t.symbol,getDirection(t),getVolume(t),t.entryPrice,t.stopLoss??'',t.takeProfit??'',t.exitPrice,t.commission??0,t.swap??0,getTradePnL(t),t.setup||'Untagged',`"${String(t.notes||'').replace(/"/g,'""')}"`]);
    const csvContent=[headers.join(','),...rows.map(r=>r.join(','))].join('\n');
    const filename=`trades_export_${new Date().toISOString().slice(0,10)}.csv`;
    const blob=new Blob([csvContent],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
    const link=document.createElement('a'); link.href=url; link.setAttribute('download',filename); document.body.appendChild(link); link.click(); document.body.removeChild(link);
    if(logActivity) logActivity('export',filename,trades.length);
  };
  const handleFormSubmit=(e)=>{
    e.preventDefault(); const id=String(Date.now()); const open=formData.openTime; const dir=normalizeType(formData.type);
    const newTrade={ id, brokerId:id, ticket:id, openTime:open, openAt:open, closeAt:'', symbol:formData.symbol.toUpperCase(), type:dir, direction:dir==='sell'?'Short':'Long', volume:cleanNumber(formData.volume), size:cleanNumber(formData.volume), entryPrice:cleanNumber(formData.entryPrice), exitPrice:cleanNumber(formData.exitPrice), stopLoss:cleanNumber(formData.stopLoss), takeProfit:cleanNumber(formData.takeProfit), commission:0, swap:0, profit:cleanNumber(formData.profit), pnl:cleanNumber(formData.profit), setup:formData.setup||'Untagged', notes:formData.notes||'', emotions:[], screenshot:null };
    setTrades([newTrade,...trades]); setIsModalOpen(false);
    setFormData({ symbol:'EURUSD', type:'buy', volume:'0.01', entryPrice:'', exitPrice:'', stopLoss:'', takeProfit:'', profit:'', setup:'Untagged', notes:'', openTime:new Date().toISOString().slice(0,10) });
  };
  const handleTagChange=(id,newSetup)=>setTrades(trades.map(t=>t.id===id?{...t,setup:newSetup}:t));
  const handleDeleteTrade=(id)=>{ if(confirm('Delete trade?')) setTrades(trades.filter(t=>t.id!==id)); };
  const handleOpenDetail=(trade)=>{ setEditingTrade({ ...trade, emotions:trade.emotions||[], notes:trade.notes||'', screenshot:trade.screenshot||null, openTime:getOpenTime(trade), closeTime:getCloseTime(trade), type:getDirection(trade), volume:getVolume(trade), profit:getTradePnL(trade), stopLoss:trade.stopLoss??'', takeProfit:trade.takeProfit??'', commission:trade.commission??0, swap:trade.swap??0, ticket:getTicket(trade) }); setIsDetailOpen(true); };
  const handleDetailChange=(key,value)=>setEditingTrade(prev=>({...prev,[key]:value}));
  const toggleEmotion=(emo)=>setEditingTrade(prev=>{ const cur=prev.emotions||[]; return {...prev, emotions: cur.includes(emo)?cur.filter(e=>e!==emo):[...cur,emo]}; });
  const handleScreenshotUpload=(e)=>{ const file=e.target.files[0]; if(!file) return; if(file.size>1.5*1024*1024) return alert('Image too large. Keep screenshots under 1.5MB.'); const reader=new FileReader(); reader.onload=(ev)=>setEditingTrade(prev=>({...prev,screenshot:ev.target.result})); reader.readAsDataURL(file); };
  const handleSaveDetail=(e)=>{ e.preventDefault(); if(!editingTrade) return; const dir=normalizeType(editingTrade.type); const net=cleanNumber(editingTrade.profit); const updated={ ...editingTrade, id:editingTrade.id, brokerId:editingTrade.ticket||editingTrade.brokerId||editingTrade.id, ticket:editingTrade.ticket||editingTrade.brokerId||editingTrade.id, openTime:editingTrade.openTime, openAt:editingTrade.openTime, closeAt:editingTrade.closeTime||editingTrade.closeAt||'', closeTime:editingTrade.closeTime||'', symbol:(editingTrade.symbol||'').toUpperCase(), type:dir, direction:dir==='sell'?'Short':'Long', volume:cleanNumber(editingTrade.volume), size:cleanNumber(editingTrade.volume), entryPrice:cleanNumber(editingTrade.entryPrice), exitPrice:cleanNumber(editingTrade.exitPrice), stopLoss:cleanNumber(editingTrade.stopLoss), takeProfit:cleanNumber(editingTrade.takeProfit), commission:cleanNumber(editingTrade.commission), swap:cleanNumber(editingTrade.swap), profit:net, pnl:net, setup:editingTrade.setup||'Untagged' }; setTrades(trades.map(t=>t.id===updated.id?updated:t)); setIsDetailOpen(false); setEditingTrade(null); };
  const handleDeleteFromDetail=(id)=>{ if(confirm('Delete this trade?')){ setTrades(trades.filter(t=>t.id!==id)); setIsDetailOpen(false); setEditingTrade(null);} };

  const filteredTrades=trades.filter(t=>{
    const q=search.toLowerCase().trim(); const ticket=String(getTicket(t)).toLowerCase();
    const matchesSearch=!q||String(t.symbol||'').toLowerCase().includes(q)||ticket.includes(q);
    const p=getTradePnL(t); const dir=getDirection(t);
    const matchesType=filterType==='all'||(filterType==='buy'&&dir==='buy')||(filterType==='sell'&&dir==='sell')||(filterType==='win'&&p>0)||(filterType==='loss'&&p<0);
    const matchesSetup=filterSetup==='all'||(t.setup||'Untagged')===filterSetup;
    return matchesSearch&&matchesType&&matchesSetup;
  }).sort((a,b)=>{
    if(sortOrder==='pnlHigh') return getTradePnL(b)-getTradePnL(a);
    if(sortOrder==='pnlLow') return getTradePnL(a)-getTradePnL(b);
    const da=toDate(getOpenTime(a))?.getTime()||0; const db=toDate(getOpenTime(b))?.getTime()||0;
    return sortOrder==='oldest'?da-db:db-da;
  });

  const getOptionsForTrade=(current)=>{ if(!current||setupOptions.includes(current)) return setupOptions; return [...setupOptions,current]; };

  return (
    <div>
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv,.txt" style={{display:'none'}} />
      <div className="header-bar" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px',flexWrap:'wrap',gap:'16px'}}>
        <div>
          <h1 style={{fontSize:'22px',fontWeight:700,color:'#fff',margin:0}}>Trading Journal</h1>
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
        <select className="ts-input" value={filterType} onChange={e=>setFilterType(e.target.value)} style={{width:'150px'}}>
          <option value="all">All Outcomes</option><option value="buy">BUY Only</option><option value="sell">SELL Only</option><option value="win">Wins</option><option value="loss">Losses</option>
        </select>
        <select className="ts-input" value={filterSetup} onChange={e=>setFilterSetup(e.target.value)} style={{width:'170px'}}>
          <option value="all">All Playbooks</option>{setupOptions.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="ts-card" style={{padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table className="ts-table">
            <thead><tr><th>Ticket</th><th>Open (Local)</th><th>Close (Local)</th><th>Symbol</th><th className="center">Dir</th><th className="num">Vol</th><th className="num">Entry</th><th className="num">SL</th><th className="num">TP</th><th className="num">Exit</th><th className="num">Comm</th><th className="num">Swap</th><th className="num">Net P&L</th><th>Setup</th><th className="center">Action</th></tr></thead>
            <tbody>
              {filteredTrades.length===0?(
                <tr><td colSpan="15" style={{padding:'40px',textAlign:'center',color:'var(--text-secondary)'}}>No trades match filters.</td></tr>
              ):(
                filteredTrades.map((trade,index)=>{
                  const p=getTradePnL(trade); const dir=getDirection(trade); const sl=Number(trade.stopLoss)||0; const tp=Number(trade.takeProfit)||0; const comm=Number(trade.commission)||0; const swap=Number(trade.swap)||0;
                  return (
                    <tr key={String(getTicket(trade))+'-'+index} onClick={()=>handleOpenDetail(trade)} style={{cursor:'pointer'}}>
                      <td className="number-font" style={{color:'var(--text-secondary)',fontSize:'12px'}}>{getTicket(trade)}</td>
                      <td className="number-font" style={{color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{displayLocal(getOpenTime(trade))}</td>
                      <td className="number-font" style={{color:'var(--text-secondary)',whiteSpace:'nowrap'}}>{getCloseTime(trade)?displayLocal(getCloseTime(trade)):'—'}</td>
                      <td style={{fontWeight:700,color:'#fff'}}>{trade.symbol}{trade.notes?<span style={{marginLeft:'6px'}}><StickyNote size={13} style={{verticalAlign:'-2px'}} /></span>:null}{trade.screenshot?<span style={{marginLeft:'4px'}}><Camera size={13} style={{verticalAlign:'-2px'}} /></span>:null}</td>
                      <td className="center"><span className={dir==='buy'?'badge-buy':'badge-sell'}>{dir.toUpperCase()}</span></td>
                      <td className="num number-font">{getVolume(trade)}</td>
                      <td className="num number-font">{trade.entryPrice||'—'}</td>
                      <td className="num number-font" style={{color:'var(--text-secondary)'}}>{sl||'—'}</td>
                      <td className="num number-font" style={{color:'var(--text-secondary)'}}>{tp||'—'}</td>
                      <td className="num number-font">{trade.exitPrice||'—'}</td>
                      <td className="num number-font" style={{color:'var(--text-secondary)'}}>{comm?comm.toFixed(2):'—'}</td>
                      <td className="num number-font" style={{color:'var(--text-secondary)'}}>{swap?swap.toFixed(2):'—'}</td>
                      <td className="num number-font" style={{fontWeight:700,color:p>=0?'var(--color-win)':'var(--color-loss)'}}>{p>=0?`+$${p.toFixed(2)}`:`-$${Math.abs(p).toFixed(2)}`}</td>
                      <td onClick={e=>e.stopPropagation()}>
                        <select value={trade.setup||'Untagged'} onChange={e=>handleTagChange(trade.id,e.target.value)} style={{backgroundColor:'var(--bg-main)',color:trade.setup==='Untagged'?'var(--text-muted)':'var(--accent-blue)',border:'1px solid var(--border-color)',borderRadius:'4px',padding:'4px 8px',fontSize:'12px',fontWeight:600}}>
                          {getOptionsForTrade(trade.setup).map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
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

      {isModalOpen && (
        <div style={overlayStyle}>
          <div className="ts-card modal-mobile" style={{width:'520px',maxWidth:'92%',backgroundColor:'var(--bg-surface)'}}>
            <h2 style={{marginTop:0,marginBottom:'20px',fontSize:'18px',display:'flex',alignItems:'center',gap:'8px'}}><Plus size={18} /> Log Manual Trade</h2>
            <form onSubmit={handleFormSubmit}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
                <div><label style={labelStyle}>Date</label><input type="date" className="ts-input" value={formData.openTime} onChange={e=>setFormData({...formData,openTime:e.target.value})} required /></div>
                <div><label style={labelStyle}>Symbol</label><input type="text" className="ts-input" value={formData.symbol} onChange={e=>setFormData({...formData,symbol:e.target.value})} required /></div>
                <div><label style={labelStyle}>Direction</label><select className="ts-input" value={formData.type} onChange={e=>setFormData({...formData,type:e.target.value})}><option value="buy">BUY</option><option value="sell">SELL</option></select></div>
                <div><label style={labelStyle}>Volume</label><input type="number" step="any" className="ts-input" value={formData.volume} onChange={e=>setFormData({...formData,volume:e.target.value})} required /></div>
                <div><label style={labelStyle}>Entry Price</label><input type="number" step="any" className="ts-input" value={formData.entryPrice} onChange={e=>setFormData({...formData,entryPrice:e.target.value})} required /></div>
                <div><label style={labelStyle}>Exit Price</label><input type="number" step="any" className="ts-input" value={formData.exitPrice} onChange={e=>setFormData({...formData,exitPrice:e.target.value})} required /></div>
                <div><label style={labelStyle}>Stop Loss</label><input type="number" step="any" className="ts-input" value={formData.stopLoss} onChange={e=>setFormData({...formData,stopLoss:e.target.value})} /></div>
                <div><label style={labelStyle}>Take Profit</label><input type="number" step="any" className="ts-input" value={formData.takeProfit} onChange={e=>setFormData({...formData,takeProfit:e.target.value})} /></div>
                <div><label style={labelStyle}>Setup</label><select className="ts-input" value={formData.setup} onChange={e=>setFormData({...formData,setup:e.target.value})}>{setupOptions.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                <div><label style={labelStyle}>Profit / Loss ($)</label><input type="number" step="0.01" className="ts-input" value={formData.profit} onChange={e=>setFormData({...formData,profit:e.target.value})} required /></div>
              </div>
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
          <div className="ts-card modal-mobile" style={{width:'720px',maxWidth:'96%',maxHeight:'90vh',overflowY:'auto',backgroundColor:'var(--bg-surface)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
              <div>
                <h2 style={{margin:0,fontSize:'18px'}}>{editingTrade.symbol} — Trade Detail</h2>
                <p style={{margin:'4px 0 0 0',fontSize:'12px',color:'var(--text-secondary)'}}>Ticket #{editingTrade.ticket||editingTrade.id} · Local: {displayLocal(editingTrade.openTime)}{editingTrade.closeTime?` → ${displayLocal(editingTrade.closeTime)}`:''}</p>
              </div>
              <button onClick={()=>{setIsDetailOpen(false);setEditingTrade(null);}} style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'18px'}}>✕</button>
            </div>
            <form onSubmit={handleSaveDetail}>
              <p style={{fontSize:'11px',color:'var(--text-muted)',marginTop:0}}>Open/Close fields below are raw broker server time (not converted). Table shows local time.</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px'}}>
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
                <div><label style={labelStyle}>Net P&L ($)</label><input type="number" step="any" className="ts-input" value={editingTrade.profit??''} onChange={e=>handleDetailChange('profit',e.target.value)} /></div>
                <div><label style={labelStyle}>Playbook Setup</label><select className="ts-input" value={editingTrade.setup||'Untagged'} onChange={e=>handleDetailChange('setup',e.target.value)}>{getOptionsForTrade(editingTrade.setup).map(s=><option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div style={{marginTop:'16px'}}>
                <label style={labelStyle}>Emotional State</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                  {EMOTIONS.map(emo=>{
                    const active=(editingTrade.emotions||[]).includes(emo);
                    return <button key={emo} type="button" onClick={()=>toggleEmotion(emo)} style={{padding:'5px 10px',borderRadius:'14px',fontSize:'12px',cursor:'pointer',border:active?'1px solid #2962ff':'1px solid #363a45',backgroundColor:active?'#2962ff':'transparent',color:'white'}}>{emo}</button>;
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
const overlayStyle={position:'fixed',inset:0,backgroundColor:'rgba(0,0,0,0.8)',backdropFilter:'blur(4px)',display:'flex',justifyContent:'center',alignItems:'center',zIndex:1000};