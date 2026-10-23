import {
  TRADE_MISTAKES,
  normalizeTradeMistakes,
  toggleTradeMistake,
} from '../utils/tradeMistakes.js';

export default function TradeMistakeFields({ value, onChange }) {
  const selected = normalizeTradeMistakes(value);

  return (
    <details
      style={{
        marginTop: '16px',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '12px',
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
        Mistakes &amp; execution review (optional)
      </summary>

      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
        Record actions that broke your plan. A loss is not automatically a
        mistake, and a win does not prove good execution. Emotions alone do
        not establish a mistake.
      </p>

      <fieldset
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          padding: '12px',
          margin: '12px 0',
        }}
      >
        <legend>Mistake tags</legend>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: '10px',
          }}
        >
          {TRADE_MISTAKES.map(([id, label, help]) => (
            <label
              key={id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(id)}
                onChange={() => onChange(toggleTradeMistake(selected, id))}
              />

              <span>
                <strong>{label}</strong>
                <small
                  style={{
                    display: 'block',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {help}
                </small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <p
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          marginBottom: 0,
        }}
      >
        Select multiple mistakes if needed. "No mistake identified" is
        exclusive. Untick all to leave unrecorded. Use Notes for details,
        especially Other. These selections do not change financial values
        or automatically mark the trade as reviewed.
      </p>
    </details>
  );
}