import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../utils/storageKeys.js';
import { SHOW_LOVE_URL } from '../config.js';

// 👉 Your live Formspree endpoint
const FORMSPREE_URL = 'https://formspree.io/f/mnpqgjnd';

const CATEGORIES = [
  '🐛 Bug Report',
  '💡 Feature Request',
  '📥 CSV Import Problem',
  '❓ Question',
  '💬 General Feedback',
];

export default function Feedback() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    category: CATEGORIES[0],
    subject: '',
    message: '',
  });

  const [status, setStatus] = useState('idle'); // idle | sending | success | error

  // Local copy of what this user has sent so they can track their tickets
  const [myTickets, setMyTickets] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.myTickets);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.myTickets, JSON.stringify(myTickets));
  }, [myTickets]);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.message.trim()) return;

    setStatus('sending');

    const ticket = {
      id: 'PL-' + Date.now().toString().slice(-6),
      date: new Date().toLocaleString(),
      ...form,
    };

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(ticket),
      });

      if (!res.ok) throw new Error('Send failed');

      setMyTickets([ticket, ...myTickets]);
      setStatus('success');
      setForm({ name: '', email: '', category: CATEGORIES[0], subject: '', message: '' });
      setTimeout(() => setStatus('idle'), 4000);
    } catch (err) {
      console.error('Submission error:', err);
      setStatus('error');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>💬 Support & Feedback</h1>
      <p style={{ color: '#787b86', marginTop: 0, marginBottom: '24px' }}>
        Found a bug? Have a request? Send us a message — it lands straight in our inbox.
      </p>

      {/* Donate banner */}
      <div style={donateBannerStyle}>
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', color: '#fff' }}>☕ Enjoying My_PnL_Lens?</h3>
          <p style={{ margin: 0, color: '#d1d4dc', fontSize: '13px', lineHeight: 1.5 }}>
            This journal is free forever. If it&apos;s helping your trading, show some love — every tip keeps new features coming.
          </p>
        </div>
        <a href={SHOW_LOVE_URL} target="_blank" rel="noopener noreferrer" style={coffeeBtnStyle}>
          ☕ Show Love
        </a>
      </div>

      <div className="support-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 520px) 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Contact Form */}
        <form onSubmit={handleSubmit} style={cardStyle}>
          <div className="support-name-email-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Your Name</label>
              <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)} style={inputStyle} placeholder="John" required />
            </div>
            <div>
              <label style={labelStyle}>Email (for our reply)</label>
              <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} style={inputStyle} placeholder="you@email.com" required />
            </div>
          </div>

          <label style={{ ...labelStyle, marginTop: '12px' }}>Category</label>
          <select value={form.category} onChange={(e) => handleChange('category', e.target.value)} style={inputStyle}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>

          <label style={{ ...labelStyle, marginTop: '12px' }}>Subject</label>
          <input type="text" value={form.subject} onChange={(e) => handleChange('subject', e.target.value)} style={inputStyle} placeholder="Short summary" required />

          <label style={{ ...labelStyle, marginTop: '12px' }}>Message</label>
          <textarea rows="5" value={form.message} onChange={(e) => handleChange('message', e.target.value)} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} placeholder="Describe the issue or idea in detail. For bugs: what did you do, what happened, what did you expect?" required />

          <button
            type="submit"
            disabled={status === 'sending'}
            style={{ ...btnStyle, backgroundColor: status === 'sending' ? '#4b5563' : '#2962ff', width: '100%', marginTop: '18px' }}
          >
            {status === 'sending' ? 'Sending...' : '📨 Send Message'}
          </button>

          {status === 'success' && (
            <p style={{ color: '#00e676', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>
              ✅ Message sent! We'll reply to your email.
            </p>
          )}
          {status === 'error' && (
            <p style={{ color: '#ff5252', fontSize: '14px', marginTop: '12px', marginBottom: 0 }}>
              ❌ Something went wrong. Please try again.
            </p>
          )}
        </form>

        {/* User's own submitted tickets */}
        <div>
          <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '16px', color: '#d1d4dc' }}>
            Your Sent Messages ({myTickets.length})
          </h3>

          {myTickets.length === 0 ? (
            <div style={{ ...cardStyle, color: '#787b86', textAlign: 'center', padding: '36px' }}>
              You haven't sent any messages yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myTickets.map((t) => (
                <div key={t.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>{t.subject}</span>
                    <span style={{ color: '#787b86', fontSize: '12px' }}>#{t.id}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span style={badgeStyle}>{t.category}</span>
                    <span style={{ ...badgeStyle, backgroundColor: '#0d47a1' }}>Sent</span>
                    <span style={{ color: '#787b86', fontSize: '12px', alignSelf: 'center' }}>{t.date}</span>
                  </div>
                  <p style={{ margin: 0, color: '#d1d4dc', fontSize: '13px', lineHeight: 1.5 }}>{t.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle = { backgroundColor: '#1e222d', padding: '20px', borderRadius: '10px' };
const labelStyle = { display: 'block', fontSize: '12px', color: '#787b86', marginBottom: '5px' };
const inputStyle = { width: '100%', padding: '10px', backgroundColor: '#131722', border: '1px solid #363a45', color: 'white', borderRadius: '6px', boxSizing: 'border-box' };
const btnStyle = { border: 'none', color: 'white', padding: '11px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' };
const badgeStyle = { backgroundColor: '#2a2e39', color: '#d1d4dc', fontSize: '11px', padding: '3px 8px', borderRadius: '4px' };
const donateBannerStyle = { backgroundColor: '#1e222d', padding: '20px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.4)', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' };
const coffeeBtnStyle = { backgroundColor: '#f59e0b', color: '#1a1a1a', padding: '11px 20px', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', textDecoration: 'none', whiteSpace: 'nowrap' };