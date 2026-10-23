import { useEffect, useState } from 'react';
import {
  REVIEW_PROMPTS,
  REVIEW_TEXT_LIMIT,
  blankReviewAnswers,
  getReviewPeriod,
  localReviewDay,
  moveReviewPeriod,
} from '../utils/reviewPeriods.js';
import { buildReviewSummary } from '../utils/reviewSummary.js';
import {
  findReviewRecord,
  readReviewRecords,
  saveReviewRecord,
} from '../utils/reviewStorage.js';

function loadReview(accountId, type, start) {
  try {
    const record = findReviewRecord(
      readReviewRecords(),
      accountId,
      type,
      start
    );

    const answers = record?.answers || blankReviewAnswers();

    return {
      answers,
      savedAnswers: answers,
      updatedAt: record?.updatedAt || '',
      error: '',
      blocked: false,
    };
  } catch (error) {
    const answers = blankReviewAnswers();

    return {
      answers,
      savedAnswers: answers,
      updatedAt: '',
      error: error.message || 'Could not read saved reviews.',
      blocked: true,
    };
  }
}

function ReviewEditor({ accountId, period, onDirtyChange }) {
  const [draft, setDraft] = useState(() =>
    loadReview(accountId, period.type, period.start)
  );
  const [message, setMessage] = useState('');

  const dirty =
    JSON.stringify(draft.answers) !== JSON.stringify(draft.savedAnswers);

  function changeAnswer(id, value) {
    const answers = { ...draft.answers, [id]: value };

    setDraft({ ...draft, answers });
    setMessage('');

    onDirtyChange(
      JSON.stringify(answers) !== JSON.stringify(draft.savedAnswers)
    );
  }

  function save(event) {
    event.preventDefault();

    try {
      const record = saveReviewRecord(
        accountId,
        period.type,
        period.start,
        draft.answers
      );

      setDraft({
        answers: record.answers,
        savedAnswers: record.answers,
        updatedAt: record.updatedAt,
        error: '',
        blocked: false,
      });

      onDirtyChange(false);
      setMessage('Review saved on this device.');
    } catch (error) {
      setDraft({
        ...draft,
        error: error.message || 'Save failed. Your draft is still here.',
      });
      setMessage('');
    }
  }

  function discard() {
    if (
      dirty &&
      !window.confirm('Discard unsaved changes to this review?')
    ) {
      return;
    }

    const reloaded = loadReview(accountId, period.type, period.start);

    if (reloaded.blocked) {
      setDraft({ ...draft, error: reloaded.error });
      return;
    }

    setDraft(reloaded);
    onDirtyChange(false);
    setMessage('Saved version loaded.');
  }

  return (
    <form
      className="ts-card"
      onSubmit={save}
      style={{ marginTop: '20px' }}
    >
      <h2 style={{ fontSize: '18px', marginTop: 0 }}>
        Written review
      </h2>

      <p style={hintStyle}>
        All answers are optional. Save before leaving this page or switching
        accounts. Written answers stay saved; the summary above recalculates
        when trades change.
      </p>

      {draft.blocked && (
        <p role="alert">
          Reviews could not be loaded. Editing is disabled to protect saved
          data. Check storage access or your backup, then revisit this page.
        </p>
      )}

      {REVIEW_PROMPTS.map(([id, label]) => (
        <label
          key={id}
          style={{
            display: 'block',
            marginTop: '16px',
            fontSize: '13px',
          }}
        >
          <strong>{label}</strong>

          <textarea
            className="ts-input"
            rows={4}
            maxLength={REVIEW_TEXT_LIMIT}
            value={draft.answers[id]}
            disabled={draft.blocked}
            onChange={(event) => changeAnswer(id, event.target.value)}
            style={{ marginTop: '6px', resize: 'vertical' }}
          />

          <small style={hintStyle}>
            {draft.answers[id].length} / {REVIEW_TEXT_LIMIT}
          </small>
        </label>
      ))}

      {draft.error && (
        <p role="alert" style={{ color: 'var(--color-loss)' }}>
          {draft.error}
        </p>
      )}

      <p aria-live="polite" style={hintStyle}>
        {message || (
          dirty
            ? 'Unsaved changes.'
            : draft.updatedAt
              ? `Last saved: ${draft.updatedAt}`
              : 'No saved review for this period yet.'
        )}
      </p>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="ts-btn ts-btn-success"
          disabled={draft.blocked}
        >
          Save review
        </button>

        <button
          type="button"
          className="ts-btn ts-btn-ghost"
          onClick={discard}
        >
          Reload saved version
        </button>
      </div>
    </form>
  );
}

export default function Reviews({
  accountId,
  accountName = 'Account',
  trades = [],
  settings,
}) {
  const [type, setType] = useState('weekly');
  const [day, setDay] = useState(() => localReviewDay());
  const [dirty, setDirty] = useState(false);

  const period = getReviewPeriod(type, day);

  const summary = buildReviewSummary(
    trades,
    type,
    day,
    settings?.brokerUtcOffset ?? 2
  );

  const symbol = (
    { USD: '$', EUR: '€', GBP: '£', NGN: '₦' }
  )[settings?.currency] || settings?.currency || '$';

  useEffect(() => {
    if (!dirty) return;

    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function changePeriod(nextType, nextDay) {
    const next = getReviewPeriod(nextType, nextDay);
    if (!next) return;

    const same =
      next.type === period.type &&
      next.start === period.start;

    if (
      !same &&
      dirty &&
      !window.confirm(
        'Discard unsaved changes and change review period?'
      )
    ) {
      return;
    }

    if (!same) setDirty(false);

    setType(nextType);
    setDay(nextDay);
  }

  function move(direction) {
    const next = moveReviewPeriod(type, day, direction);
    if (next) changePeriod(type, next.start);
  }

  if (!accountId || !period || !summary) {
    return <p>Select an account and a valid review period.</p>;
  }

  const money =
    `${summary.netPnl < 0 ? '-' : ''}${symbol}${Math.abs(summary.netPnl).toFixed(2)}`;

  return (
    <div>
      <h1 style={{ fontSize: '22px', marginTop: 0 }}>
        Weekly &amp; Monthly Reviews
      </h1>

      <p><strong>Account: {accountName}</strong></p>

      <p style={hintStyle}>
        All trades closed during the selected period for this account.
        Global filters do not apply. Weeks run Monday–Sunday. Timed closes
        use your device's local timezone; date-only manual trades keep
        their recorded date.
      </p>

      <div
        style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          alignItems: 'end',
        }}
      >
        <label>
          Review type
          <select
            className="ts-input"
            value={type}
            onChange={(event) => changePeriod(event.target.value, day)}
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>

        <label>
          Choose a date in the period
          <input
            className="ts-input"
            type="date"
            value={day}
            onChange={(event) => changePeriod(type, event.target.value)}
          />
        </label>

        <button
          type="button"
          className="ts-btn"
          onClick={() => move(-1)}
        >
          Previous
        </button>

        <button
          type="button"
          className="ts-btn"
          onClick={() => changePeriod(type, localReviewDay())}
        >
          Current
        </button>

        <button
          type="button"
          className="ts-btn"
          onClick={() => move(1)}
        >
          Next
        </button>
      </div>

      <h2 style={{ fontSize: '18px' }}>
        {period.start} — {period.end}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))',
          gap: '12px',
        }}
      >
        <SummaryCard
          label="Closed trades"
          value={summary.closedCount}
        />

        <SummaryCard
          label={
            summary.invalidPnl
              ? 'Net P&L (valid values only)'
              : 'Net P&L'
          }
          value={money}
        />

        <SummaryCard
          label="Win rate"
          value={
            summary.winRate === null
              ? '—'
              : `${summary.winRate.toFixed(1)}%`
          }
        />

        <SummaryCard
          label="Wins / Losses / Breakevens"
          value={`${summary.wins} / ${summary.losses} / ${summary.breakevens}`}
        />
      </div>

      <p style={hintStyle}>
        Win rate = wins / trades with valid Net P&amp;L, including
        breakevens. No trades with valid P&amp;L means no win rate.
      </p>

      {summary.closedCount === 0 && (
        <p>
          No dated closed trades in this period. You can still write a review.
        </p>
      )}

      {summary.invalidPnl > 0 && (
        <p role="alert">
          {summary.invalidPnl} period trade(s) have missing or invalid Net
          P&amp;L. They are excluded from P&amp;L and win/loss/breakeven
          figures, but included in trade count and mistake coverage.
        </p>
      )}

      {summary.undatedClosed > 0 && (
        <p role="alert">
          {summary.undatedClosed} closed trade(s) across this account have
          no usable close date and cannot be assigned to a review period.
          Entry dates are not substituted.
        </p>
      )}

      <section className="ts-card" style={{ marginTop: '20px' }}>
        <h2 style={{ fontSize: '18px', marginTop: 0 }}>
          Mistake-recording coverage
        </h2>

        <p>
          Specific mistakes recorded: <strong>{summary.withMistakes}</strong>
        </p>

        <p>
          Explicitly “No mistake identified”:{' '}
          <strong>{summary.noMistakeIdentified}</strong>
        </p>

        <p>
          Unrecorded: <strong>{summary.unrecorded}</strong>
        </p>

        <h3 style={{ fontSize: '15px' }}>
          Recorded mistake frequency
        </h3>

        {summary.mistakeCounts.length ? (
          <ul>
            {summary.mistakeCounts.map(({ id, label, count }) => (
              <li key={id}>
                {label}: <strong>{count}</strong> trade(s)
              </li>
            ))}
          </ul>
        ) : (
          <p>No specific mistake tags recorded for this period.</p>
        )}

        <p style={hintStyle}>
          A trade can have multiple tags, so tag counts can exceed the number
          of trades with mistakes. Unrecorded does not mean mistake-free.
          These counts do not estimate the financial cost of a mistake.
        </p>
      </section>

      <ReviewEditor
        key={JSON.stringify([accountId, type, period.start])}
        accountId={accountId}
        period={period}
        onDirtyChange={setDirty}
      />
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="ts-card">
      <div style={hintStyle}>{label}</div>
      <strong
        style={{
          display: 'block',
          marginTop: '8px',
          fontSize: '20px',
        }}
      >
        {value}
      </strong>
    </div>
  );
}

const hintStyle = {
  fontSize: '12px',
  color: 'var(--text-secondary)',
};