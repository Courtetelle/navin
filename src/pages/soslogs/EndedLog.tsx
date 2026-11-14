import { useSignals } from '@preact/signals-react/runtime';

import { SwipeRow } from '../../features/prep/index.ts';
import { openListPublish } from '../../features/publish/index.ts';
import { toastThenRedraw } from '../../features/safety/toastThenRedraw.ts';
import { useTr } from '../../i18n/useTr.ts';
import { fmtShortDate, pad } from '../../lib/format.ts';
import type { SosLog } from '../../model/types.ts';
import { saveSosLogs, state } from '../../state/index.ts';

import { SosEvents } from './SosEvents.tsx';

/** Props of {@link EndedLog}. */
interface EndedLogProps {
  log: SosLog;
  /** The details are open. */
  open: boolean;
  onRedraw: (open?: string | null) => void;
}

/**
 * An ended SOS log, a band: its events inside; swiped left, 👁, 📤 and 🗑
 * (long press).
 * @param props - Log, state and redraw.
 * @returns The folded details.
 */
export function EndedLog({ log, open, onRedraw }: EndedLogProps) {
  useSignals();
  const tr = useTr();
  return (
    <SwipeRow
      id={log.id}
      name={summaryOf(log)}
      silent
      onShare={(format) => openListPublish('soslogs', log.id, format)}
      onDelete={(id) => {
        toastThenRedraw('Log SOS effacé', () => {
          state.data.sosLogs.value = state.data.sosLogs.value.filter(
            (one) => one.id !== id,
          );
          saveSosLogs();
          onRedraw();
        });
      }}
    >
      <details className="section" open={open}>
        <summary>{tr(summaryOf(log))}</summary>
        <div style={{ padding: '0 14px 12px' }}>
          <SosEvents log={log} />
        </div>
      </details>
    </SwipeRow>
  );
}

function summaryOf(log: SosLog): string {
  const start = new Date(log.start);
  const parts = [
    `${log.ex ? '🧪 Exercice · ' : ''}${fmtShortDate(start)}`,
    `${hoursMinutes(log.start)} → ${hoursMinutes(log.end as string)}`,
    `${log.events.length} actions`,
  ];
  if (log.boat) parts.push(log.boat);
  return parts.join(' · ');
}

function hoursMinutes(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
