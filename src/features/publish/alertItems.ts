import type { AlertRecord } from '../../model/alertLog.ts';
import { ALERT_KINDS, alertIcon, latestFirst } from '../../model/alertLog.ts';

import type { PublishItem } from './types.ts';

/**
 * A time written « 14.11.2026 à 11h30 ».
 * @param iso - ISO time.
 * @returns The text.
 */
export function alertWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()} à ${two(date.getHours())}h${two(date.getMinutes())}`;
}

/**
 * The alerts as elements of the Partager window, the latest first.
 * @param alerts - The journal.
 * @returns One element each.
 */
export function alertItems(alerts: readonly AlertRecord[]): PublishItem[] {
  return latestFirst(alerts).map((alert) => {
    const name = `${alertIcon(alert.kind)} ${alertWhen(alert.t)} · ${alert.title}`;
    const kind = ALERT_KINDS.find(([one]) => one === alert.kind)?.[1] ?? '';
    return {
      id: alert.id,
      name,
      sections: [
        {
          title: name,
          rows: [
            ['Quand', alertWhen(alert.t)],
            ['Catégorie', kind],
            ...(alert.cruise
              ? [['Croisière', alert.cruise] as [string, string]]
              : []),
            ['Message', alert.text],
          ],
        },
      ],
    };
  });
}

/**
 * A number on two digits.
 * @param value - The number.
 * @returns e.g. `07`.
 */
function two(value: number): string {
  return String(value).padStart(2, '0');
}
