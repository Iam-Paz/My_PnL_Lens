import {
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';

import {
  getSaveFailures,
  subscribeSaveFailures,
  retryFailedSaves,
  getPendingSaveValues,
} from '../utils/persistence.js';

export default function SaveFailureBanner() {
  const failures = useSyncExternalStore(
    subscribeSaveFailures,
    getSaveFailures,
    getSaveFailures
  );

  const [message, setMessage] = useState('');

  useEffect(() => {
    const warnBeforeLeaving = (event) => {
      if (!getSaveFailures().length) return;

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener(
      'beforeunload',
      warnBeforeLeaving
    );

    return () => window.removeEventListener(
      'beforeunload',
      warnBeforeLeaving
    );
  }, []);

  const retry = () => {
    setMessage('');

    if (!retryFailedSaves()) {
      setMessage(
        'Some saves still failed. Keep this tab open and download the unsaved recovery JSON.'
      );
    }
  };

  const downloadRecovery = () => {
    setMessage('');

    try {
      const entries = getPendingSaveValues();
      if (!entries.length) return;

      const recovery = {
        app: 'My_PnL_Lens',
        kind: 'unsaved-recovery',
        version: 1,
        exportedAt: new Date().toISOString(),
        warning: 'Partial rescue copy: only failed-save values. Not a full backup. Not accepted by Settings restore. Keep it for assisted recovery.',
        entries,
      };

      // Serialise before starting a download so circular/unusable data does
      // not produce a file that appears to contain a successful rescue.
      const text = JSON.stringify(recovery, null, 2);
      const blob = new Blob(
        [text],
        { type: 'application/json' }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      try {
        link.href = url;
        link.download =
          `mypnl-lens-unsaved-recovery-${Date.now()}.json`;

        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();

        setTimeout(
          () => URL.revokeObjectURL(url),
          1000
        );
      }

      setMessage(
        'Recovery download requested. Check Downloads for the JSON file. It contains failed-save values at download time only. Saving is still unresolved; later edits need a fresh recovery copy.'
      );
    } catch {
      setMessage(
        'The recovery file could not be prepared. Do not close or refresh this tab. Keep your visible work and report this error.'
      );
    }
  };

  // Keep hooks mounted even when there is currently nothing to warn about.
  if (!failures.length) return null;

  return (
    <section
      aria-label="Unsaved data warning"
      style={{
        border: '2px solid var(--color-loss, #dc2626)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px',
        backgroundColor: 'var(--bg-surface, #fff)',
        color: 'var(--text-primary, #111)',
        overflowWrap: 'anywhere',
      }}
    >
      <div role="alert" aria-atomic="true">
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '17px',
            color: 'var(--color-loss, #dc2626)',
          }}
        >
          Changes are not confirmed saved
        </h2>

        <p
          style={{
            margin: '0 0 10px',
            fontSize: '13px',
          }}
        >
          Your working changes are still in this tab, but browser
          storage could not write or verify the latest values below.
          Do not close, refresh, or switch devices until you have
          retried saving or kept a recovery copy.
        </p>

        <ul
          style={{
            margin: '0 0 12px',
            paddingLeft: '20px',
            fontSize: '13px',
          }}
        >
          {failures.map((failure) => (
            <li key={failure.key}>
              <strong>{failure.label}:</strong>{' '}
              {failure.message}
            </li>
          ))}
        </ul>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="ts-btn ts-btn-primary"
          onClick={retry}
        >
          Retry failed saves
        </button>

        <button
          type="button"
          className="ts-btn ts-btn-ghost"
          onClick={downloadRecovery}
        >
          Download unsaved recovery JSON
        </button>
      </div>

      <p style={{ fontSize: '12px', marginBottom: 0 }}>
        Recovery JSON contains only failed-save values. It is not
        a full backup and cannot be imported through Settings restore.
        Keep it private for assisted recovery. A regular backup reads
        saved storage and may miss these latest changes. A recovery
        download does not clear this warning.
      </p>

      {message && (
        <p
          role="status"
          style={{ fontSize: '13px', marginBottom: 0 }}
        >
          {message}
        </p>
      )}
    </section>
  );
}