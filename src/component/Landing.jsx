import { BarChart3, Target, Library, Shield, Share2, Lock, BookOpen, Rocket, Smartphone, Luggage, TrendingUp, Heart, Coffee } from 'lucide-react';
import { SHOW_LOVE_URL } from '../config.js';

const FEATURES = [
  { icon: BarChart3, title: 'Deep Analytics', text: 'Win rate, profit factor, expectancy, R-multiples, streaks, drawdowns — every number that matters, calculated instantly.' },
  { icon: Target, title: 'Know Your Edge', text: '7-dimension breakdown: which sessions, setups, days, symbols and emotions actually make you money.' },
  { icon: Library, title: 'Playbooks & Discipline', text: 'Define your strategies, tag every trade, and see the cost of breaking your own rules.' },
  { icon: Shield, title: 'Risk Guardrails', text: 'Daily & max drawdown monitors with breach alerts. Set any limit to 0% to hide it.' },
  { icon: Share2, title: 'Shareable PnL Cards', text: 'One-click performance images for WhatsApp & X — with a privacy mode that hides $ amounts.' },
  { icon: Lock, title: '100% Private', text: 'No account, no servers, no tracking. Your data lives in your browser and nowhere else.' },
];

const FAQS = [
  { q: 'Is it really free?', a: 'Yes — free forever. No premium tier, no locked features, no trial period. If it helps your trading, you can drop a tip on our Show Love page, but nothing is ever paywalled.' },
  { q: 'Do I need an account?', a: 'No. There is no signup, no login, no password. Open the app and start journaling in 10 seconds.' },
  { q: 'Where is my data stored?', a: 'Entirely in your own browser (local storage). Nothing is uploaded anywhere, which means your trade history is private by design.' },
  { q: 'How do I switch devices?', a: 'Export a JSON backup on your old device (one click), then import it on the new one. Takes 30 seconds.' },
  { q: 'Which brokers are supported?', a: 'Any broker that exports MT5 deal history as CSV — which is nearly all of them. Just export and drag the file in.' },
];

export default function Landing({ onLaunch, tradeCount = 0 }) {
  const hasData = tradeCount > 0;

  return (
    <div style={pageStyle}>
      {/* NAV */}
      <header style={navStyle}>
        <div style={brandStyle}>
          <div style={logoBadgeStyle}>MY</div>
          <span style={brandNameStyle}>My_PnL_Lens</span>
        </div>
        <button onClick={onLaunch} className="ts-btn ts-btn-primary">
          {hasData ? `Continue (${tradeCount})` : 'Launch App'}
        </button>
      </header>

      {/* HERO */}
      <section style={heroStyle}>
        <div style={pillStyle}>100% FREE · NO SIGNUP · NO TRACKING</div>
        <h1 style={h1Style}>The Trading Journal That Shows You Your Edge</h1>
        <p style={subStyle}>
          Import your MT5 history and discover what actually makes you money —
          sessions, setups, emotions, discipline. Your data never leaves your device.
        </p>
        <div style={ctaRowStyle}>
          <button onClick={onLaunch} className="ts-btn ts-btn-primary" style={ctaPrimaryStyle}>
            {hasData ? <><BookOpen size={16} style={{ verticalAlign: '-3px', marginRight: '8px' }} />Continue Journal ({tradeCount} trades)</> : <><Rocket size={16} style={{ verticalAlign: '-3px', marginRight: '8px' }} />Launch Free Journal</>}
          </button>
          <a href="#screenshots" className="ts-btn ts-btn-ghost" style={ctaGhostStyle}>See it in action ↓</a>
        </div>
        <div style={heroShotWrapStyle}>
          <img src="/screenshots/dashboard.png" alt="My_PnL_Lens command dashboard" style={shotStyle} />
        </div>
      </section>

      {/* TRUST STRIP */}
      <div style={trustStripStyle}>
        <span><strong>40+</strong> metrics tracked</span>
        <span><strong>7</strong> edge dimensions</span>
        <span><strong>0</strong> accounts needed</span>
        <span><strong>₦0</strong> forever</span>
      </div>

      {/* FEATURES */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Everything a serious trader needs</h2>
        <p style={sectionSubStyle}>Not a spreadsheet. Not a subscription. A proper analytics cockpit for your trading.</p>
        <div style={featureGridStyle}>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="ts-card">
                <div style={{ marginBottom: '10px' }}><Icon size={28} style={{ color: '#38bdf8' }} /></div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fff' }}>{f.title}</h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section id="screenshots" style={sectionStyle}>
        <h2 style={h2Style}>See it in action</h2>
        <p style={sectionSubStyle}>Real screens from the live app. Dark, dense, and built for traders.</p>
        <div style={shotGridStyle}>
          <ShotFigure src="/screenshots/analytics.png" caption="Deep analytics — sessions, R-multiples & edge matrix" />
          <ShotFigure src="/screenshots/journal.png" caption="Trade journal — filter, tag & review every position" />
          <ShotFigure src="/screenshots/playbooks.png" caption="Playbooks — systems, rules & discipline tracking" />
        </div>
        <div style={writeupGridStyle}>
          <div className="ts-card">
            <div style={{ marginBottom: '10px' }}><Share2 size={28} style={{ color: '#38bdf8' }} /></div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', color: '#fff' }}>Shareable PnL Cards</h3>
            <p style={writeupTextStyle}>
              Turn any period into a clean, branded image in one click.
              Show your wins on WhatsApp and X without ever exposing your journal.
            </p>
            <ul style={writeupListStyle}>
              <li>Period selector — Today, 7D, 30D, 90D, All Time</li>
              <li><Lock size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />Privacy mode swaps $ amounts for percentages</li>
              <li>Crisp high-resolution PNG, ready to send</li>
            </ul>
          </div>
          <div className="ts-card">
            <div style={{ marginBottom: '10px' }}><Smartphone size={28} style={{ color: '#38bdf8' }} /></div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', color: '#fff' }}>Fully Responsive</h3>
            <p style={writeupTextStyle}>
              The full journal in your pocket. Dashboard, journal and analytics
              adapt to any screen — log a trade upstairs, review it downstairs.
            </p>
            <ul style={writeupListStyle}>
              <li>Mobile-friendly layout with thumb-sized buttons</li>
              <li>Same app, same data on every device</li>
              <li>30-second backup moves you between devices</li>
            </ul>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>Live in 60 seconds</h2>
        <div style={stepsGridStyle}>
          <div className="ts-card" style={{ textAlign: 'center' }}>
            <div style={stepNumStyle}>1</div>
            <h3 style={stepTitleStyle}>Export from MT5</h3>
            <p style={stepTextStyle}>Save your deal history as CSV from MetaTrader 5. Any account, any broker.</p>
          </div>
          <div className="ts-card" style={{ textAlign: 'center' }}>
            <div style={stepNumStyle}>2</div>
            <h3 style={stepTitleStyle}>Import & tag</h3>
            <p style={stepTextStyle}>Drag the file in. Tag playbooks, log emotions, add notes.</p>
          </div>
          <div className="ts-card" style={{ textAlign: 'center' }}>
            <div style={stepNumStyle}>3</div>
            <h3 style={stepTitleStyle}>Find your edge</h3>
            <p style={stepTextStyle}>Analytics reveal what works. Double down on it. Cut the rest.</p>
          </div>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '16px' }}>
          Switching devices? One-click JSON export → import. Your journal travels with you. <Luggage size={14} style={{ verticalAlign: '-2px' }} />
        </p>
      </section>

      {/* FAQ */}
      <section style={{ ...sectionStyle, maxWidth: '760px' }}>
        <h2 style={h2Style}>Questions, answered</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          {FAQS.map((f) => (
            <details key={f.q} style={faqStyle}>
              <summary style={faqQStyle}>{f.q}</summary>
              <p style={faqAStyle}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section style={finalCtaStyle}>
        <h2 style={{ margin: '0 0 10px 0', fontSize: '28px', color: '#fff' }}>Stop guessing. Start knowing.</h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>Free forever. No signup. Your edge is waiting.</p>
        <button onClick={onLaunch} className="ts-btn ts-btn-primary" style={ctaPrimaryStyle}>
          {hasData ? <><BookOpen size={16} style={{ verticalAlign: '-3px', marginRight: '8px' }} />Continue Journal ({tradeCount} trades)</> : <><Rocket size={16} style={{ verticalAlign: '-3px', marginRight: '8px' }} />Launch Free Journal</>}
        </button>
      </section>

      {/* FOOTER */}
      <footer style={footerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ ...logoBadgeStyle, width: '28px', height: '28px', fontSize: '11px' }}>MY</div>
          <span style={{ fontWeight: 700, color: '#fff' }}>My_PnL_Lens</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Built by Paz · Green pips only <TrendingUp size={13} style={{ verticalAlign: '-1px' }} /> <Heart size={13} style={{ verticalAlign: '-1px', color: '#22c55e' }} /></span>
          <a href={SHOW_LOVE_URL} target="_blank" rel="noopener noreferrer" style={footerLinkStyle}><Coffee size={13} style={{ verticalAlign: '-1px', marginRight: '4px' }} />Show Love</a>
        </div>
      </footer>
    </div>
  );
}

function ShotFigure({ src, caption }) {
  return (
    <figure style={{ margin: 0 }}>
      <img src={src} alt={caption} style={shotStyle} loading="lazy" />
      <figcaption style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '8px' }}>{caption}</figcaption>
    </figure>
  );
}

const pageStyle = { minHeight: '100vh', backgroundColor: 'var(--bg-main)', color: 'var(--text-primary)' };
const navStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', maxWidth: '1100px', margin: '0 auto' };
const brandStyle = { display: 'flex', alignItems: 'center', gap: '10px' };
const logoBadgeStyle = { width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', color: '#fff', boxShadow: '0 4px 12px rgba(41, 98, 255, 0.4)' };
const brandNameStyle = { fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 700, color: '#fff' };
const heroStyle = { textAlign: 'center', padding: '48px 24px 24px', maxWidth: '1100px', margin: '0 auto' };
const pillStyle = { display: 'inline-block', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: '#00e676', backgroundColor: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.35)', borderRadius: '20px', padding: '6px 16px', marginBottom: '20px' };
const h1Style = { fontSize: 'clamp(32px, 6vw, 56px)', fontWeight: 700, color: '#fff', margin: '0 0 16px 0', lineHeight: 1.15, letterSpacing: '-0.02em' };
const subStyle = { fontSize: 'clamp(15px, 2.5vw, 18px)', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto 28px', lineHeight: 1.6 };
const ctaRowStyle = { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '40px' };
const ctaPrimaryStyle = { padding: '14px 28px', fontSize: '15px' };
const ctaGhostStyle = { padding: '14px 28px', fontSize: '15px', textDecoration: 'none' };
const heroShotWrapStyle = { maxWidth: '900px', margin: '0 auto' };
const shotStyle = { width: '100%', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)', display: 'block' };
const trustStripStyle = { display: 'flex', justifyContent: 'center', gap: 'clamp(16px, 5vw, 48px)', flexWrap: 'wrap', padding: '20px', color: 'var(--text-secondary)', fontSize: '14px', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', maxWidth: '1100px', margin: '24px auto 0' };
const sectionStyle = { padding: '64px 24px 0', maxWidth: '1100px', margin: '0 auto' };
const h2Style = { fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 700, color: '#fff', textAlign: 'center', margin: '0 0 8px 0' };
const sectionSubStyle = { textAlign: 'center', color: 'var(--text-secondary)', margin: '0 0 28px 0' };
const featureGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' };
const shotGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '24px' };
const writeupGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', maxWidth: '860px', margin: '0 auto' };
const writeupTextStyle = { margin: '0 0 12px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 };
const writeupListStyle = { margin: 0, paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.8 };
const stepsGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '20px' };
const stepNumStyle = { width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--accent-blue)', color: '#fff', fontWeight: 700, fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' };
const stepTitleStyle = { margin: '0 0 8px 0', fontSize: '16px', color: '#fff' };
const stepTextStyle = { margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 };
const faqStyle = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px 18px' };
const faqQStyle = { cursor: 'pointer', fontWeight: 600, color: '#fff', fontSize: '14px' };
const faqAStyle = { margin: '10px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 };
const finalCtaStyle = { textAlign: 'center', padding: '80px 24px', maxWidth: '1100px', margin: '0 auto' };
const footerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '24px', borderTop: '1px solid var(--border-color)', maxWidth: '1100px', margin: '0 auto' };
const footerLinkStyle = { color: '#f59e0b', fontSize: '13px', fontWeight: 700, textDecoration: 'none' };