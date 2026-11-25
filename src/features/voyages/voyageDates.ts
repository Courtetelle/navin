import { fmtShortDate } from '../../lib/format.ts';

/**
 * A date read with its day, « Samedi 12/06/2027 », and its hour if any.
 * @param value - `AAAA-MM-JJ`.
 * @param hour - `HH:MM`, or empty.
 * @returns The text.
 */
export function dayText(value: string, hour: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const day = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const parts = [
    `${day.charAt(0).toUpperCase()}${day.slice(1)} ${fmtShortDate(date)}`,
  ];
  if (hour) parts.push(hour.replace(':', ' h '));
  return parts.join(' · ');
}
