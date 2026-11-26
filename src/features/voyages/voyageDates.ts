import { showsUtc } from '../../lib/clockMode.ts';
import { fmtShortDate, pad } from '../../lib/format.ts';

/**
 * A date read with its day, « Samedi 12/06/2027 », and its hour if any. The
 * hour is typed in the phone's time; when the top bar clock shows UTC, the
 * date and the hour are given in UTC, « Samedi 12/06/2027 · 07 h 00 UTC ».
 * @param value - `AAAA-MM-JJ`.
 * @param hour - `HH:MM`, or empty.
 * @returns The text.
 */
export function dayText(value: string, hour: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const moment = hour ? new Date(`${value}T${hour}`) : null;
  if (moment && !Number.isNaN(moment.getTime()) && showsUtc()) {
    return utcDayText(moment);
  }
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const parts = [
    `${day.charAt(0).toUpperCase()}${day.slice(1)} ${fmtShortDate(date)}`,
  ];
  if (hour) parts.push(hour.replace(':', ' h '));
  return parts.join(' · ');
}

function utcDayText(moment: Date): string {
  const day = moment.toLocaleDateString('fr-FR', {
    weekday: 'long',
    timeZone: 'UTC',
  });
  const date = `${pad(moment.getUTCDate())}/${pad(moment.getUTCMonth() + 1)}/${moment.getUTCFullYear()}`;
  const time = `${pad(moment.getUTCHours())} h ${pad(moment.getUTCMinutes())} UTC`;
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${date} · ${time}`;
}

/**
 * The dates of a cruise for its label, « Croisière du Samedi 12/06/2027 au
 * Samedi 19/06/2027 », without the hours; empty while one of them is missing.
 * @param info - The cruise fields (`du`, `au`).
 * @returns The text, or `''`.
 */
export function cruiseSpan(info: Readonly<Record<string, string>>): string {
  const from = info.du?.trim() ?? '';
  const to = info.au?.trim() ?? '';
  if (!from || !to) return '';
  return `Croisière du ${dayText(from, '')} au ${dayText(to, '')}`;
}
