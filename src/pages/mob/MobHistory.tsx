import { untracked } from '@preact/signals-react';
import { useSignals } from '@preact/signals-react/runtime';

import { Button } from '../../components/shared/Button.tsx';
import { ButtonRow } from '../../components/shared/ButtonRow.tsx';
import { TzTime } from '../../components/shared/TzTime.tsx';
import type { MobLogRecord } from '../../features/safety/mobLog.ts';
import { mobEventPositions } from '../../features/safety/mobLog.ts';
import { mobLogText } from '../../features/safety/mobLogText.ts';
import { mobKind } from '../../features/safety/mobProcedures.ts';
import { useTr } from '../../i18n/useTr.ts';
import { buzz } from '../../lib/dom.ts';
import { fmtShortDate } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';
import { keyedItems } from '../../lib/keyedItems.ts';
import type { LogEvent } from '../../model/types.ts';
import { deliver, mobLogs, state } from '../../state/index.ts';

/** Props of {@link MobHistory}. */
interface MobHistoryProps {
  /** Open log, or `null`. */
  log: MobLogRecord | null;
}

/**
 * The open log and the previous logs of this procedure.
 * @param props - Open log.
 * @returns The sections.
 */
export function MobHistory({ log }: MobHistoryProps) {
  const tr = useTr();
  const past = untracked(pastLogs);
  return (
    <>
      {log ? (
        <>
          <h2 className="sub-h">{tr('Log de l’incident')}</h2>
          <EventList log={log} />
          <ButtonRow className="row ck-pub-row">
            <Button
              className="btn big ck-pub"
              data-mshare={log.id}
              onClick={() => share(log)}
            >
              {tr('📤 Partager')}
              <small>{tr('texte du log')}</small>
            </Button>
          </ButtonRow>
        </>
      ) : null}
      {past.length > 0 ? (
        <details className="section">
          <summary>{tr(`Logs précédents (${past.length})`)}</summary>
          {past.map((item) => (
            <div key={item.id} style={{ padding: '0 14px 12px' }}>
              <h3 className="sub-h">
                {`${fmtShortDate(new Date(item.start))} · `}
                <TzTime date={item.start} />
                {' → '}
                <TzTime date={item.end as string} />
              </h3>
              <EventList log={item} />
              <ButtonRow>
                <Button
                  className="btn ck-pub"
                  data-mshare={item.id}
                  onClick={() => share(item)}
                >
                  {tr('📤 Partager ce log')}
                </Button>
              </ButtonRow>
            </div>
          ))}
        </details>
      ) : null}
    </>
  );
}

function pastLogs(): MobLogRecord[] {
  const kind = mobKind.value;
  const past: MobLogRecord[] = [];
  for (const log of mobLogs() as readonly MobLogRecord[]) {
    if (log.kind === kind && log.end) past.unshift(log);
  }
  return past;
}

function share(log: MobLogRecord): void {
  buzz();
  const start = log.start.slice(0, 16).replaceAll(/[:T]/g, '-');
  void deliver(
    mobLogText(log, state.data.cruise.value?.info.name),
    `log-homme-a-la-mer-${start}.txt`,
    'text/plain',
  );
}

function EventList({ log }: { log: MobLogRecord }) {
  useSignals();
  const late = mobEventPositions.value;
  const seen = new Set<string>();
  return (
    <ol className="mob-log">
      {keyedItems(log.events, (event) => event.t + event.what).map(
        ({ key, item }) => {
          const first = !seen.has(item.t);
          seen.add(item.t);
          return (
            <EventRow key={key} event={item} late={first ? late[item.t] : ''} />
          );
        },
      )}
    </ol>
  );
}

function EventRow({ event, late }: { event: LogEvent; late?: string }) {
  const tr = useTr();
  const classes = event.type ? `mob-ev ${event.type}` : 'mob-ev';
  return (
    <li className={classes} data-ev={event.t}>
      <b>
        <TzTime date={event.t} seconds />
      </b>
      <span>
        {tr(event.what)}
        <small className="mob-ev-pos">
          {late || (event.pos ? fmtPos(event.pos) : '')}
        </small>
      </span>
    </li>
  );
}
