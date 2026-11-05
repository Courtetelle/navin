import { bothTimes, fmtShortDate, hms } from '../../lib/format.ts';
import { fmtPos } from '../../lib/geo.ts';

import type { MobLogRecord } from './mobLog.ts';

/**
 * Plain text of a man-overboard log (legacy `mobLogText`).
 * @param log - Log.
 * @param cruiseName - Name of the open cruise, if any.
 * @returns The text, one event per line.
 */
export function mobLogText(
  log: MobLogRecord,
  cruiseName: string | undefined,
): string {
  const title = log.kind === 'train' ? 'ENTRAÎNEMENT' : 'INCIDENT';
  const lines = [
    `${title} HOMME À LA MER · ${fmtShortDate(new Date(log.start))}${cruiseName ? ` · ${cruiseName}` : ''}`,
  ];
  for (const event of log.events) {
    const time =
      log.zone === 'lac' ? hms(new Date(event.t)) : bothTimes(event.t);
    const position = event.pos ? `  (${fmtPos(event.pos)})` : '';
    lines.push(`${time}  ${event.what}${position}`);
  }
  if (log.end) lines.push(`Durée : ${minutesBetween(log.start, log.end)} min`);
  return lines.join('\n');
}

/**
 * Duration in whole minutes.
 * @param start - ISO start.
 * @param end - ISO end.
 * @returns Rounded minutes.
 */
export function minutesBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
}
