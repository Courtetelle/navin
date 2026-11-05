import { textOf } from '../../../lib/format.ts';

/** State of an expiry date: `bad` expired, `warn` within 3 months, `ok`, `''` not a date. */
export type ExpiryState = 'bad' | 'warn' | 'ok' | '';

/**
 * Parse a date typed in any usual form: `2027-03-31`, `31.03.2027`, `31/3/27`,
 * `03.2027` (last day of the month) (legacy `expParse`).
 * @param text - Typed text.
 * @returns The date, or null.
 */
export function expParse(text: unknown): Date | null {
  const value = textOf(text).trim();
  let match = /(?<y>\d{4})-(?<m>\d{1,2})-(?<d>\d{1,2})/.exec(value);
  if (match?.groups) {
    const { y, m, d } = match.groups;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  match =
    /(?<d>\d{1,2})\s*[./\- ]\s*(?<m>\d{1,2})\s*[./\- ]\s*(?<y>\d{2,4})/.exec(
      value,
    );
  if (match?.groups) {
    const { y, m, d } = match.groups;
    const year = Number(y) < 100 ? Number(y) + 2000 : Number(y);
    return new Date(year, Number(m) - 1, Number(d));
  }
  match = /^(?<m>\d{1,2})\s*[./\- ]\s*(?<y>\d{4})$/.exec(value);
  if (match?.groups) {
    return new Date(Number(match.groups.y), Number(match.groups.m), 0);
  }
  return null;
}

/**
 * Validity of a document (legacy `expState`).
 * @param text - Typed date.
 * @param now - Current time.
 * @returns The state.
 */
export function expState(text: unknown, now = new Date()): ExpiryState {
  const date = expParse(text);
  if (!date || Number.isNaN(date.getTime())) return '';
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setMonth(limit.getMonth() + 3);
  if (date < today) return 'bad';
  return date < limit ? 'warn' : 'ok';
}

/**
 * Note under an expiry field.
 * @param state - Expiry state.
 * @returns The text, `''` when valid.
 */
export function expNote(state: ExpiryState): string {
  if (state === 'bad') return 'Expirée';
  return state === 'warn' ? 'Expire dans moins de 3 mois' : '';
}
