/*
 * The journal of the alerts: every alert NavIn gave, with or without an open
 * cruise, kept on the device until erased.
 */

/** The kinds of alert. */
export type AlertKind = 'vent' | 'orage' | 'feux' | 'profondeur';

/** One alert given. */
export interface AlertRecord {
  id: string;
  /** ISO time. */
  t: string;
  kind: AlertKind;
  /** « Alerte vent », « Fin d’alerte orage »… */
  title: string;
  /** The whole message. */
  text: string;
  /** The cruise open then, by name. */
  cruise?: string;
}

/** The kinds in their order, with their name and sign. */
export const ALERT_KINDS: ReadonlyArray<
  readonly [kind: AlertKind, name: string, icon: string]
> = [
  ['vent', 'Vent', '💨'],
  ['orage', 'Orage', '⚡'],
  ['feux', 'Feux d’avis des lacs', '🚨'],
  ['profondeur', 'Profondeur', '⚓'],
];

/**
 * The sign of a kind.
 * @param kind - The kind.
 * @returns e.g. `⚡`.
 */
export function alertIcon(kind: AlertKind): string {
  return ALERT_KINDS.find(([one]) => one === kind)?.[2] ?? '🔔';
}

/**
 * The alerts of some kinds between two days, both counted.
 * @param alerts - The journal.
 * @param kinds - The kinds kept.
 * @param from - First day `YYYY-MM-DD`, empty for no limit.
 * @param to - Last day `YYYY-MM-DD`, empty for no limit.
 * @returns The alerts kept.
 */
export function alertsIn(
  alerts: readonly AlertRecord[],
  kinds: ReadonlySet<AlertKind>,
  from = '',
  to = '',
): AlertRecord[] {
  return alerts.filter((alert) => {
    const day = localDay(alert.t);
    return (
      kinds.has(alert.kind) && (!from || day >= from) && (!to || day <= to)
    );
  });
}

/**
 * The day of a time, on the device: `YYYY-MM-DD`.
 * @param iso - ISO time.
 * @returns The day.
 */
export function localDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

/**
 * The journal the latest first.
 * @param alerts - The journal.
 * @returns A sorted copy.
 */
export function latestFirst(alerts: readonly AlertRecord[]): AlertRecord[] {
  return alerts.toSorted((first, second) => second.t.localeCompare(first.t));
}

/**
 * A number on two digits.
 * @param value - The number.
 * @returns e.g. `07`.
 */
function two(value: number): string {
  return String(value).padStart(2, '0');
}
