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
 * Local time `HH:MM` (legacy `fmtTime`).
 * @param date - Date to format.
 * @returns The local time.
 */
export function fmtTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
 * Local and UTC time `HH:MM (HH:MM UTC)` (legacy `fmtTime2`).
 * @param date - Date to format.
 * @returns Both times.
 */
export function fmtTime2(date: Date): string {
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
 * Date and hour, `14.11.2026 à 11h30`.
 * @param date - Date.
 * @returns The date and hour.
 */
export function fmtDotDateTime(date: Date): string {
  return `${fmtDotDate(date)} à ${pad(date.getHours())}h${pad(date.getMinutes())}`;
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
 * Value of a `datetime-local` input (legacy `toLocalInput`).
 * @param date - Date.
 * @returns `YYYY-MM-DDTHH:MM`.
 */
export function toLocalInput(date: Date): string {
  return `${dayKey(date)}T${fmtTime(date)}`;
}

/**
 * `HH:MM:SS` local time (legacy `hms`).
 * @param date - Date.
 * @returns The time with seconds.
 */
export function hms(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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
 * Local and UTC times with seconds `HH:MM:SS · HH:MM:SS UTC` (legacy `bothTimes`).
 * @param iso - ISO time.
 * @returns Both times.
 */
export function bothTimes(iso: string): string {
  const date = new Date(iso);
  return `${hms(date)} · ${hmsUtc(date)}`;
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
