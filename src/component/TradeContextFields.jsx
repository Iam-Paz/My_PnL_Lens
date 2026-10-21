import {
  MARKET_CONDITIONS, ENTRY_EXECUTIONS, SL_MANAGEMENT, TP_MANAGEMENT,
  normalizeTradeContext, toggleManagement, toggleContextTag,
  DIRECTIONAL_BIASES, CONFLUENCES, KEY_LEVELS, NEWS_CONTEXT,
} from '../utils/tradeContext.js';

function ManagementChoices({ legend, field, options, selected, onChange }) {
  return (
    <fieldset style={{ border:'1px solid var(--border-color)', borderRadius:'8px', padding:'12px', margin:'12px 0' }}>
      <legend>{legend}</legend>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'10px' }}>
        {options.map(([id, label]) => (
          <label key={id} style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px', cursor:'pointer' }}>
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={() => onChange(field, toggleManagement(selected, field, id))}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ContextTags({ legend, field, options, selected, onChange }) {
  return (
    <fieldset style={{ border:'1px solid var(--border-color)', borderRadius:'8px', padding:'12px', margin:'12px 0' }}>
      <legend>{legend}</legend>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'10px' }}>
        {options.map(([id, label, help]) => (
          <label key={id} style={{ display:'flex', alignItems:'flex-start', gap:'6px', fontSize:'13px', cursor:'pointer' }}>
            <input
              type="checkbox"
              checked={selected.includes(id)}
              onChange={() => onChange(field, toggleContextTag(selected, field, id))}
            />
            <span>
              <strong>{label}</strong>
              <small style={{ display:'block', color:'var(--text-secondary)' }}>
                {help}
              </small>
            </span>
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
      <summary style={{ cursor:'pointer', fontWeight:700 }}>
        Entry context &amp; management (optional)
      </summary>

      <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
        Blank means not recorded, not "as planned". Entry timeframe describes
        this trade, not the playbook's default timeframe. Record context at
        entry and management actions actually taken.
      </p>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap:'12px' }}>
        <label style={{ fontSize:'13px' }}>
          Entry timeframe
          <input
            className="ts-input"
            type="text"
            maxLength={24}
            value={typeof trade.entryTimeframe === 'string' ? trade.entryTimeframe : ''}
            onChange={(e) => onChange('entryTimeframe', e.target.value)}
            placeholder="e.g. M5, M15, H1"
          />
        </label>

        <label style={{ fontSize:'13px' }}>
          Market condition at entry
          <select
            className="ts-input"
            value={context.marketCondition}
            onChange={(e) => onChange('marketCondition', e.target.value)}
          >
            <option value="">Not recorded</option>
            {MARKET_CONDITIONS.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize:'13px' }}>
          Entry execution
          <select
            className="ts-input"
            value={context.entryExecution}
            onChange={(e) => onChange('entryExecution', e.target.value)}
          >
            <option value="">Not recorded</option>
            {ENTRY_EXECUTIONS.map(([id, label]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display:'block', marginTop:'12px', fontSize:'13px' }}>
        Directional bias at entry
        <select
          className="ts-input"
          value={context.directionalBias}
          onChange={(e) => onChange('directionalBias', e.target.value)}
        >
          <option value="">Not recorded</option>
          {DIRECTIONAL_BIASES.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </label>

      <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
        Bias is your market view, not the buy/sell direction. Select only
        context identified at entry, not reasons inferred from the result.
        Tags do not replace your playbook checklist.
      </p>

      <ContextTags
        legend="Confluences"
        field="confluences"
        options={CONFLUENCES}
        selected={context.confluences}
        onChange={onChange}
      />

      <ContextTags
        legend="Key levels / zones"
        field="keyLevels"
        options={KEY_LEVELS}
        selected={context.keyLevels}
        onChange={onChange}
      />

      <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
        Zone definitions vary by strategy. Use Notes for exact prices,
        timeframe, session and chart timezone.
      </p>

      <ContextTags
        legend="News context"
        field="newsContext"
        options={NEWS_CONTEXT}
        selected={context.newsContext}
        onChange={onChange}
      />

      <p style={{ fontSize:'12px', color:'var(--text-secondary)' }}>
        Your assessment, not an automatic calendar. "No major news expected"
        is exclusive. Other news tags may coexist for different releases;
        explain in Notes. Untick all to leave unrecorded.
      </p>

      <ManagementChoices
        legend="SL management"
        field="slManagement"
        options={SL_MANAGEMENT}
        selected={context.slManagement}
        onChange={onChange}
      />

      <ManagementChoices
        legend="TP management"
        field="tpManagement"
        options={TP_MANAGEMENT}
        selected={context.tpManagement}
        onChange={onChange}
      />

      <p style={{ fontSize:'12px', color:'var(--text-secondary)', marginBottom:0 }}>
        Select multiple actions if needed. "Left unchanged" is exclusive.
        Untick all to leave unrecorded. Use Notes for details, especially
        Other. Exit Type still records how the trade closed; these actions
        do not change prices, risk, P&amp;L or MFE/MAE calculations.
      </p>
    </details>
  );
}