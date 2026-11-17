import { useEffect, useState } from 'react';

import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';

import { Button } from './Button.tsx';

/** The look « en cours » stays at least this long, even for a quick read. */
const LEAST_RUN_MS = 1200;
/** « ✓ Actualisé » is shown this long. */
const DONE_MS = 2500;

type Phase = 'idle' | 'running' | 'done';

/** Props of {@link RefreshButton}. */
export interface RefreshButtonProps {
  /** Launch the refresh; a promise keeps the look « en cours » until it ends. */
  onRefresh: () => unknown;
  /** A refresh is running (launched here or elsewhere). */
  busy?: boolean;
  /** The words at rest. */
  label?: string;
  /** Extra classes. */
  className?: string;
  /** Data attributes for the tests. */
  [data: `data-${string}`]: string | undefined;
}

/**
 * The rule of the « Actualiser » buttons, the same everywhere: touched, the
 * button turns yellow (red at night), its arrow turns, it says « Actualisation
 * en cours… » and cannot be touched again; done, it says « ✓ Actualisé à
 * 10h58 » for a moment, then comes back.
 * @param props - The button.
 * @returns The button.
 */
export function RefreshButton({
  onRefresh,
  busy = false,
  label = '↻ Actualiser maintenant',
  className = 'btn',
  ...data
}: RefreshButtonProps) {
  const tr = useTr();
  const [phase, setPhase] = useState<Phase>('idle');
  const [startedAt, setStartedAt] = useState(0);
  const [pending, setPending] = useState(false);
  const [doneText, setDoneText] = useState('');
  useEffect(() => {
    if (phase !== 'running' || busy || pending) return undefined;
    const timer = setTimeout(
      () => {
        const now = new Date();
        setDoneText(
          `✓ Actualisé à ${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}`,
        );
        setPhase('done');
      },
      Math.max(0, startedAt + LEAST_RUN_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [phase, busy, pending, startedAt]);
  useEffect(() => {
    if (phase !== 'done') return undefined;
    const timer = setTimeout(() => setPhase('idle'), DONE_MS);
    return () => clearTimeout(timer);
  }, [phase]);
  const running = phase === 'running' || busy;
  const look = running ? ' refreshing' : phase === 'done' ? ' refreshed' : '';
  return (
    <Button
      {...data}
      className={`${className || 'btn'} refresh-btn${look}`}
      data-refresh={running ? 'running' : phase}
      aria-busy={running}
      disabled={running}
      noUiEdit
      onClick={() => {
        buzz();
        setStartedAt(Date.now());
        setPhase('running');
        const result = onRefresh();
        if (result instanceof Promise) {
          setPending(true);
          void result
            .catch(() => undefined)
            .finally(() => {
              setPending(false);
            });
        }
      }}
    >
      {running ? (
        <>
          <span className="refresh-spin" aria-hidden="true">
            ↻
          </span>{' '}
          {tr('Actualisation en cours…')}
        </>
      ) : phase === 'done' ? (
        tr(doneText)
      ) : (
        tr(label)
      )}
    </Button>
  );
}
