import { TzTime } from '../../components/shared/TzTime.tsx';
import { localText } from '../../components/shared/timeText.ts';
import { sosPlaceWords } from '../../features/safety/sosPlaces.ts';
import { useTr } from '../../i18n/useTr.ts';
import { fmtPos } from '../../lib/geo.ts';
import { keyedItems } from '../../lib/keyedItems.ts';
import type { LogEvent, SosLog } from '../../model/types.ts';

/** Props of the components of a log. */
export interface SosLogProps {
  log: SosLog;
}

/**
 * Title of the running procedure.
 * @param props - The log.
 * @returns The title.
 */
export function ActiveHeading({ log }: SosLogProps) {
  const tr = useTr();
  return (
    <b>
      {tr(`${log.ex ? '🧪 Exercice · ' : ''}⏺ Procédure SOS en cours depuis `)}
      <LogTime log={log} date={log.start} />
      {tr(` · ${log.events.length} actions`)}
    </b>
  );
}

/**
 * The events of a log (local time only for a lake log).
 * @param props - The log.
 * @returns The list.
 */
export function SosEvents({ log }: SosLogProps) {
  return (
    <ol className="mob-log">
      {keyedItems(log.events, (event) => event.t + event.what).map(
        ({ key, item }) => (
          <EventRow key={key} log={log} event={item} />
        ),
      )}
    </ol>
  );
}

function EventRow({ log, event }: SosLogProps & { event: LogEvent }) {
  const tr = useTr();
  const classes = event.type ? `mob-ev ${event.type}` : 'mob-ev';
  const words = event.pos ? sosPlaceWords(event.pos) : '';
  return (
    <li className={classes}>
      <b>
        <LogTime log={log} date={event.t} />
      </b>
      <span>
        {tr(event.what)}
        <small className="mob-ev-pos">
          {event.pos ? `${fmtPos(event.pos)}${words ? ` · ${words}` : ''}` : ''}
        </small>
      </span>
    </li>
  );
}

function LogTime({ log, date }: SosLogProps & { date: string }) {
  if (log.zone === 'lac') {
    return <time className="tz-loc">{localText(new Date(date), true)}</time>;
  }
  return <TzTime date={date} seconds />;
}
