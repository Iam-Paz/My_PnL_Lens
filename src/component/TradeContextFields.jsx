import {
  MARKET_CONDITIONS, ENTRY_EXECUTIONS, SL_MANAGEMENT, TP_MANAGEMENT,
  normalizeTradeContext, toggleManagement,
} from '../utils/tradeContext.js';

function ManagementChoices({ legend, field, options, selected, onChange }) {
  return (
    <fieldset style={{ border:'1px solid var(--border-color)', borderRadius:'8px', padding:'12px', margin:'12px 0' }}>
      <legend>{legend}</legend>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
        {options.map(([id, label]) => (
          <label key={id} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', cursor:'pointer' }}>
            <input type="checkbox" checked={selected.includes(id)} onChange={() => onChange(field, toggleManagement(selected, field, id))} />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function TradeContextFields({ trade = {}, onChange }) {
  const context = normalizeTradeContext(trade);
  return (
    <details style={{ marginTop:'16px', border:'1px solid var(--border-color)', borderRadius:'8px', padding:'12px' }}>
      <summary style={{ cursor:'pointer', fontWeight:700 }}>Entry context &amp; management (optional)</summary>
      <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
        Blank means not recorded, not "as planned". Entry timeframe describes this trade, not the playbook's default timeframe. Record context at entry and management actions actually taken.
      </p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'12px' }}>
        <label style={{ fontSize:'13px' }}>Entry timeframe
          <input className="ts-input" type="text" maxLength={24} value={typeof trade.entryTimeframe === 'string' ? trade.entryTimeframe : ''} onChange={(e) => onChange('entryTimeframe', e.target.value)} placeholder="e.g. M5, M15, H1" />
        </label>
        <label style={{ fontSize:'13px' }}>Market condition at entry
          <select className="ts-input" value={context.marketCondition} onChange={(e) => onChange('marketCondition', e.target.value)}>
            <option value="">Not recorded</option>
            {MARKET_CONDITIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label style={{ fontSize:'13px' }}>Entry execution
          <select className="ts-input" value={context.entryExecution} onChange={(e) => onChange('entryExecution', e.target.value)}>
            <option value="">Not recorded</option>
            {ENTRY_EXECUTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>
      <ManagementChoices legend="SL management" field="slManagement" options={SL_MANAGEMENT} selected={context.slManagement} onChange={onChange} />
      <ManagementChoices legend="TP management" field="tpManagement" options={TP_MANAGEMENT} selected={context.tpManagement} onChange={onChange} />
      <p style={{ fontSize:'12px', color:'var(--text-secondary)', marginBottom:0 }}>
        Select multiple actions if needed. "Left unchanged" is exclusive. Untick all to leave unrecorded. Use Notes for details, especially Other. Exit Type still records how the trade closed; these actions do not change prices, risk, P&amp;L or MFE/MAE calculations.
      </p>
    </details>
  );
}