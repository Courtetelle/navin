import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { ShareButton } from '../../components/shared/ShareButton.tsx';
import { SwipeRow } from '../../features/prep/index.ts';
import { openListPublish } from '../../features/publish/index.ts';
import { sosDeleteId } from '../../features/safety/safetyState.ts';
import { toastThenRedraw } from '../../features/safety/toastThenRedraw.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
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
 * An ended SOS log: its events, publish, and deletion after a confirmation.
 * @param props - Log, state and redraw.
 * @returns The folded details.
 */
export function EndedLog({ log, open, onRedraw }: EndedLogProps) {
  useSignals();
  const tr = useTr();
  const deleting = sosDeleteId.value === log.id;
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
          <ButtonRow className="row c2">
            <ShareButton
              small
              data-share={log.id}
              onShare={(format) => openListPublish('soslogs', log.id, format)}
            />
            <Button
              className="btn danger"
              data-del={log.id}
              onClick={() => {
                buzz();
                sosDeleteId.value = deleting ? null : log.id;
                onRedraw(log.id);
              }}
            >
              {tr('🗑 Effacer')}
            </Button>
          </ButtonRow>
          {deleting ? <DeleteForm log={log} onRedraw={onRedraw} /> : null}
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

function DeleteForm({ log, onRedraw }: Omit<EndedLogProps, 'open'>) {
  const tr = useTr();
  return (
    <div className="sl-pwd">
      <Button
        className="btn big danger"
        data-delok={log.id}
        onClick={() => {
          buzz();
          toastThenRedraw('Log SOS effacé', () => {
            state.data.sosLogs.value = state.data.sosLogs.value.filter(
              (one) => one.id !== log.id,
            );
            saveSosLogs();
            sosDeleteId.value = null;
            onRedraw();
          });
        }}
      >
        {tr('Confirmer l’effacement de ce log')}
      </Button>
    </div>
  );
}
