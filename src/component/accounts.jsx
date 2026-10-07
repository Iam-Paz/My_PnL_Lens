import { useState } from 'react';
import { Users, Plus, Pencil, Trash2, Check, X } from 'lucide-react';

// Default per-account settings — the Settings page edits a copy of this shape
// for the active account, and new accounts start from it.
export const DEFAULT_ACCOUNT_SETTINGS = {
  traderName: '',
  currency: 'USD',
  brokerUtcOffset: 2,
  startingBalance: 10000,
  riskPerTrade: 1,
  maxDailyDrawdownPercent: 3,
  maxDrawdownPercent: 10,
};

export function createAccount(name) {
  return {
    id: 'acc-' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
    name: name || 'Account',
    trades: [],
    settings: { ...DEFAULT_ACCOUNT_SETTINGS },
  };
}

function accountPnl(account) {
  return (account.trades || []).reduce((s, t) => s + (Number(t.profit ?? t.pnl) || 0), 0);
}

export default function AccountsPage({ accounts, setAccounts, activeAccountId, setActiveAccountId }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  const handleAdd = () => {
    const name = newName.trim() || `Account ${accounts.length + 1}`;
    const acc = createAccount(name);
    setAccounts((prev) => [...prev, acc]);
    setActiveAccountId(acc.id);
    setNewName('');
  };

  const handleDelete = (id) => {
    if (accounts.length <= 1) {
      alert('You need at least one account.');
      return;
    }
    const target = accounts.find((a) => a.id === id);
    const n = target?.trades?.length || 0;
    if (!confirm(`Delete "${target?.name}" and its ${n} trade${n === 1 ? '' : 's'}? This cannot be undone.`)) return;
    const remaining = accounts.filter((a) => a.id !== id);
    setAccounts(remaining);
    if (id === activeAccountId && remaining.length > 0) setActiveAccountId(remaining[0].id);
  };

  const startRename = (account) => {
    setEditingId(account.id);
    setEditDraft(account.name);
  };

  const commitRename = () => {
    if (!editingId) return;
    const name = editDraft.trim();
    if (name) {
      setAccounts((prev) => prev.map((a) => (a.id === editingId ? { ...a, name } : a)));
    }
    setEditingId(null);
    setEditDraft('');
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Users size={24} /> Manage Accounts
      </h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: 0, marginBottom: '24px' }}>
        {accounts.length} account{accounts.length === 1 ? '' : 's'} · the active account drives every page.
      </p>

      <div className="ts-card" style={{ marginBottom: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="ts-input"
          placeholder="New account name (e.g. Funded $100k)"
          value={newName}
          maxLength={60}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          style={{ flex: 1, minWidth: '200px' }}
        />
        <button onClick={handleAdd} className="ts-btn ts-btn-primary">
          <Plus size={14} style={{ verticalAlign: '-2px', marginRight: '6px' }} />Add & Switch
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {accounts.map((a) => {
          const active = a.id === activeAccountId;
          const pnl = accountPnl(a);
          const n = (a.trades || []).length;
          const editing = editingId === a.id;
          return (
            <div
              key={a.id}
              className="ts-card ts-card-hover"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                flexWrap: 'wrap',
                ...(active ? { borderColor: 'var(--accent-blue)', boxShadow: '0 0 0 1px var(--accent-blue)' } : {}),
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  backgroundColor: active ? 'var(--accent-blue)' : 'var(--bg-main)',
                  border: active ? '1px solid var(--accent-blue)' : '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '16px',
                  color: active ? '#fff' : 'var(--text-secondary)',
                  flexShrink: 0,
                }}
              >
                {(a.name || 'A').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                {editing ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="ts-input"
                      value={editDraft}
                      maxLength={60}
                      autoFocus
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') { setEditingId(null); setEditDraft(''); }
                      }}
                    />
                    <button onClick={commitRename} className="ts-btn ts-btn-success" title="Save name" style={{ padding: '10px 12px' }}>
                      <Check size={14} />
                    </button>
                    <button onClick={() => { setEditingId(null); setEditDraft(''); }} className="ts-btn ts-btn-ghost" title="Cancel" style={{ padding: '10px 12px' }}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)' }}>{a.name}</span>
                      {active && <span className="ts-badge ts-badge-blue">ACTIVE</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <span className="pill pill-blue number-font">{n} trade{n === 1 ? '' : 's'}</span>
                      <span className={`pill number-font ${pnl >= 0 ? 'pill-green' : 'pill-red'}`}>
                        Net {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                      </span>
                      <span className="pill pill-gray">{a.settings?.currency || 'USD'}</span>
                    </div>
                  </>
                )}
              </div>
              {!editing && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {!active && (
                    <button onClick={() => setActiveAccountId(a.id)} className="ts-btn ts-btn-ghost" style={{ fontSize: '12px' }}>
                      Switch
                    </button>
                  )}
                  <button onClick={() => startRename(a)} className="ts-btn ts-btn-ghost" title="Rename account" style={{ fontSize: '12px' }}>
                    <Pencil size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />Rename
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="ts-btn ts-btn-danger" title="Delete account" style={{ fontSize: '12px' }}>
                    <Trash2 size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}