import { signal } from '@preact/signals-react';

import { uid } from '../lib/format.ts';
import type { AlertKind, AlertRecord } from '../model/alertLog.ts';
import { localDay } from '../model/alertLog.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';

/** Where the journal is kept on the device. */
const KEY = 'ldb.alertLog';
/** The oldest alerts go beyond this many. */
const MOST = 3000;

/** The journal of the alerts. */
export const alertLog = signal<readonly AlertRecord[]>(
  store.get<AlertRecord[]>(KEY, []),
);

function save(next: readonly AlertRecord[]): void {
  alertLog.value = next;
  store.set(KEY, next);
}

/**
 * Write an alert in the journal, with or without an open cruise.
 * @param kind - Its kind.
 * @param title - « Alerte vent »…
 * @param text - The whole message.
 * @param at - When, ISO; now by default.
 * @returns The alert written.
 */
export function recordAlert(
  kind: AlertKind,
  title: string,
  text: string,
  at = new Date().toISOString(),
): AlertRecord {
  const cruise = data.cruise.peek()?.info.name;
  const alert: AlertRecord = { id: uid(), t: at, kind, title, text };
  if (cruise) alert.cruise = cruise;
  save([...alertLog.peek(), alert].slice(-MOST));
  return alert;
}

/**
 * Erase alerts.
 * @param ids - Their ids.
 */
export function eraseAlerts(ids: readonly string[]): void {
  const gone = new Set(ids);
  save(alertLog.peek().filter((alert) => !gone.has(alert.id)));
}

/**
 * Erase every alert between two days, both counted.
 * @param from - First day `YYYY-MM-DD`.
 * @param to - Last day `YYYY-MM-DD`.
 * @returns How many were erased.
 */
export function eraseAlertsBetween(from: string, to: string): number {
  const before = alertLog.peek();
  const kept = before.filter((alert) => {
    const day = localDay(alert.t);
    return day < from || day > to;
  });
  save(kept);
  return before.length - kept.length;
}

/**
 * Alerts of a backup put with those of the device: the unknown ones added.
 * @param received - The alerts of the backup.
 */
export function mergeAlerts(received: unknown): void {
  if (!Array.isArray(received)) return;
  const known = new Set(alertLog.peek().map((alert) => alert.id));
  const added = (received as AlertRecord[]).filter(
    (alert) => alert && typeof alert.id === 'string' && !known.has(alert.id),
  );
  if (added.length === 0) return;
  save(
    [...alertLog.peek(), ...added]
      .toSorted((first, second) => first.t.localeCompare(second.t))
      .slice(-MOST),
  );
}
