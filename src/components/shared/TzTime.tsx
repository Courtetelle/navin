import { useSignals } from '@preact/signals-react/runtime';
import { useEffect, useState } from 'react';

import { state } from '../../state/index.ts';

import { localText, utcText } from './timeText.ts';

/** Props of {@link TzTime}. */
interface TzTimeProps {
  /** Moment shown (Date, ISO string or epoch ms). */
  date: Date | string | number;
  /**
   * Show the seconds too.
   * @default false
   */
  seconds?: boolean;
}

/**
 * A time on screen (legacy `tzHtml` + `tzShowLocal`, app.js:473-488): UTC with
 * a small « UTC », a touch shows the local time for 3 s (« locale », class
 * `tz-local`) without triggering the button around it. In lake procedures
 * (`state.view.tzLocalOnly`), the local time only (`time.tz-loc`).
 * @param props - Moment and seconds flag.
 * @returns The `<time>` element.
 */
export function TzTime({ date, seconds = false }: TzTimeProps) {
  useSignals();
  const moment = date instanceof Date ? date : new Date(date);
  const [local, setLocal] = useState(0);
  useEffect(() => {
    if (!local) return undefined;
    const timer = setTimeout(() => setLocal(0), 3000);
    return () => clearTimeout(timer);
  }, [local]);
  if (state.view.tzLocalOnly.value) {
    return <time className="tz-loc">{localText(moment, seconds)}</time>;
  }
  return (
    <time
      className={local ? 'tz tz-local' : 'tz'}
      data-t={moment.toISOString()}
      data-s={seconds ? '1' : undefined}
      onPointerDown={() => setLocal((count) => count + 1)}
      onClickCapture={(event) => {
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      {local ? localText(moment, seconds) : utcText(moment, seconds)}
      <small>{local ? 'locale' : 'UTC'}</small>
    </time>
  );
}
