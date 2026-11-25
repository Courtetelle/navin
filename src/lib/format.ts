import { shownParts, utcClock } from './clockMode.ts';

/**
 * Left-pad with zeros (legacy `pad`).
 * @param value - Value to pad.
 * @param length - Target length.
 * @returns The padded string.
 */
export function pad(value: unknown, length = 2): string {
  return String(value).padStart(length, '0');
}

/**
 * Parse a number written with a comma or a dot (legacy `num`).
 * @param value - Number or text.
 * @returns The number, or `null` when empty or not finite.
 */
export function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(stringOf(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Format a number with a decimal comma (legacy `fr`).
 * @param value - Number to format.
 * @param decimals - Number of decimals.
 * @returns The French formatted number, or `–` when absent.
 */
export function fr(value: number | null | undefined, decimals = 1): string {
  return value == null ? '–' : value.toFixed(decimals).replace('.', ',');
}

/**
 * Replace the decimal dot by a comma (legacy `frN`).
 * @param value - Any value.
 * @returns The text with a comma.
 */
export function frN(value: unknown): string {
  return String(value).replace('.', ',');
}

/**
 * Time `HH:MM` on screen (legacy `fmtTime`): the phone's time, or UTC when
 * the top bar clock shows UTC (then red on screen).
 * @param date - Date to format.
 * @returns The time.
 */
export function fmtTime(date: Date): string {
  const shown = shownParts(date);
  return `${pad(shown.hours)}:${pad(shown.minutes)}`;
}

/**
 * The phone's time `HH:MM`, whatever the clock shows (files whose columns say
 * which time they hold).
 * @param date - Date to format.
 * @returns The local time.
 */
export function fmtLocalTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Time `HH:MM` for a text read away from the screen (shared, printed): with
 * « UTC » when the clock shows UTC, since the red is lost there.
 * @param date - Date to format.
 * @returns The time.
 */
export function fmtTimeShared(date: Date): string {
  return utcClock.value ? fmtUtc(date) : fmtTime(date);
}

/**
 * UTC time `HH:MM UTC` (legacy `fmtUtc`).
 * @param date - Date to format.
 * @returns The UTC time with its suffix.
 */
export function fmtUtc(date: Date): string {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

/**
 * Local and UTC time `HH:MM (HH:MM UTC)` (legacy `fmtTime2`); UTC alone when
 * the clock shows UTC.
 * @param date - Date to format.
 * @returns Both times.
 */
export function fmtTime2(date: Date): string {
  if (utcClock.value) return fmtUtc(date);
  return `${fmtTime(date)} (${fmtUtc(date)})`;
}

/**
 * Long French date, e.g. `mercredi 15 juillet 2026` (legacy `fmtDate`).
 * @param date - Date to format.
 * @returns The date in words.
 */
export function fmtDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Duration `H h MM` (legacy `fmtDur`).
 * @param milliseconds - Duration (negative counts as zero).
 * @returns The duration in hours and minutes.
 */
export function fmtDur(milliseconds: number): string {
  const minutes = Math.max(0, Math.round(milliseconds / 60000));
  return `${Math.floor(minutes / 60)} h ${pad(minutes % 60)}`;
}

/**
 * Short date `DD/MM/YYYY` (legacy `fmtShortDate`).
 * @param date - Date to format.
 * @returns The short date.
 */
export function fmtShortDate(date: Date): string {
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * Date with dots, `14.11.2026`.
 * @param date - Date.
 * @returns The date.
 */
export function fmtDotDate(date: Date): string {
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/**
 * Date and hour, `14.11.2026 à 11h30`, in UTC when the clock shows UTC.
 * @param date - Date.
 * @returns The date and hour.
 */
export function fmtDotDateTime(date: Date): string {
  const shown = shownParts(date);
  return `${pad(shown.day)}.${pad(shown.month)}.${shown.year} à ${pad(shown.hours)}h${pad(shown.minutes)}`;
}

/**
 * Hour and minutes `9h05` on screen, in UTC when the clock shows UTC.
 * @param date - Moment.
 * @returns The text.
 */
export function fmtHhMm(date: Date): string {
  const shown = shownParts(date);
  return `${shown.hours}h${pad(shown.minutes)}`;
}

/**
 * Short date and time, `14/11/2026 11:30`, both in UTC when the clock shows
 * UTC (the day may differ from the phone's near midnight).
 * @param date - Date.
 * @returns The date and time.
 */
export function fmtDateTime(date: Date): string {
  const shown = shownParts(date);
  return `${pad(shown.day)}/${pad(shown.month)}/${shown.year} ${pad(shown.hours)}:${pad(shown.minutes)}`;
}

/**
 * `toLocaleString` / `toLocaleTimeString` options of a time on screen: in UTC
 * when the clock shows UTC.
 * @param options - Other options.
 * @returns The options with the time zone.
 */
export function shownTimeOptions(
  options: Intl.DateTimeFormatOptions = {},
): Intl.DateTimeFormatOptions {
  return utcClock.value ? { ...options, timeZone: 'UTC' } : options;
}

/**
 * Local day key `YYYY-MM-DD` (legacy `dayKey`).
 * @param date - Date.
 * @returns The day key.
 */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Noon of a day key (legacy `keyToDate`).
 * @param key - `YYYY-MM-DD`.
 * @returns The local date at 12:00.
 */
export function keyToDate(key: string): Date {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

/**
 * Value of a `datetime-local` input (legacy `toLocalInput`), in UTC when the
 * clock shows UTC; read it back with {@link fromLocalInput}.
 * @param date - Date.
 * @returns `YYYY-MM-DDTHH:MM`.
 */
export function toLocalInput(date: Date): string {
  const shown = shownParts(date);
  return `${shown.year}-${pad(shown.month)}-${pad(shown.day)}T${pad(shown.hours)}:${pad(shown.minutes)}`;
}

/**
 * Value of a `datetime-local` input in the phone's time, whatever the clock
 * shows (a value kept as typed in the phone's time).
 * @param date - Date.
 * @returns `YYYY-MM-DDTHH:MM`.
 */
export function toPhoneInput(date: Date): string {
  return `${dayKey(date)}T${fmtLocalTime(date)}`;
}

/**
 * The moment of a `datetime-local` value written by {@link toLocalInput}:
 * UTC when the clock shows UTC, else the phone's time.
 * @param value - `YYYY-MM-DDTHH:MM`.
 * @returns Milliseconds, `NaN` when empty or invalid.
 */
export function fromLocalInput(value: string): number {
  if (!value) return Number.NaN;
  return utcClock.value
    ? Date.parse(`${value.length === 16 ? `${value}:00` : value}Z`)
    : new Date(value).getTime();
}

/**
 * `HH:MM:SS` on screen (legacy `hms`): the phone's time, or UTC when the
 * clock shows UTC.
 * @param date - Date.
 * @returns The time with seconds.
 */
export function hms(date: Date): string {
  const shown = shownParts(date);
  return `${pad(shown.hours)}:${pad(shown.minutes)}:${pad(shown.seconds)}`;
}

/**
 * `HH:MM:SS UTC` (legacy `hmsUtc`).
 * @param date - Date.
 * @returns The UTC time with seconds.
 */
export function hmsUtc(date: Date): string {
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

/**
 * Local and UTC times with seconds `HH:MM:SS · HH:MM:SS UTC` (legacy
 * `bothTimes`); UTC alone when the clock shows UTC.
 * @param iso - ISO time.
 * @returns Both times.
 */
export function bothTimes(iso: string): string {
  const date = new Date(iso);
  if (utcClock.value) return hmsUtc(date);
  return `${hms(date)} · ${hmsUtc(date)}`;
}

/**
 * Time of an event of a log (SOS, man overboard), with seconds: local on a
 * lake, local and UTC at sea, UTC alone (« UTC » written) when the clock
 * shows UTC.
 * @param iso - ISO time.
 * @param lake - The log was kept on a lake.
 * @returns The time(s).
 */
export function logTimes(iso: string, lake: boolean): string {
  if (utcClock.value) return hmsUtc(new Date(iso));
  return lake ? hms(new Date(iso)) : bothTimes(iso);
}

/**
 * A unique id: base-36 time + 5 random characters (legacy `uid`).
 * @returns The id.
 */
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/**
 * Text of a loose stored value, `''` when falsy (legacy `String(value || '')`).
 * Stored sheet values are strings; other values are converted as legacy did.
 * @param value - Stored value.
 * @returns The text.
 */
export function textOf(value: unknown): string {
  return value ? stringOf(value) : '';
}

/**
 * `String(value)` for JSON data: strings as-is, arrays joined by commas (empty
 * for null items), objects as `[object Object]`, other values converted.
 * @param value - Stored value.
 * @returns The text.
 */
export function stringOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    let out = '';
    for (let position = 0; position < value.length; position++) {
      const item: unknown = value[position];
      if (position) out += ',';
      if (item != null) out += stringOf(item);
    }
    return out;
  }
  if (typeof value === 'object' && value !== null) return '[object Object]';
  if (typeof value === 'function') return '[function]';
  return String(value);
}
