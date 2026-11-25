import { showsUtc } from '../../lib/clockMode.ts';
import { pad } from '../../lib/format.ts';

/**
 * `HH:MM` (or `HH:MM:SS`) as shown: local time, or UTC when the top bar clock
 * shows UTC.
 * @param date - Moment.
 * @param seconds - With seconds.
 * @returns The text.
 */
export function shownText(date: Date, seconds: boolean): string {
  return showsUtc() ? utcText(date, seconds) : localText(date, seconds);
}

/**
 * `HH:MM` (or `HH:MM:SS`) in local time.
 * @param date - Moment.
 * @param seconds - With seconds.
 * @returns The text.
 */
export function localText(date: Date, seconds: boolean): string {
  const base = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return seconds ? `${base}:${pad(date.getSeconds())}` : base;
}

/**
 * `HH:MM` (or `HH:MM:SS`) in UTC.
 * @param date - Moment.
 * @param seconds - With seconds.
 * @returns The text.
 */
export function utcText(date: Date, seconds: boolean): string {
  const base = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
  return seconds ? `${base}:${pad(date.getUTCSeconds())}` : base;
}
