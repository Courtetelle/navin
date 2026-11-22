import { signal } from '@preact/signals-react';

import { distKm } from '../../lib/geo.ts';
import type { FixedAlert } from '../../model/fixedAlerts.ts';

/** The position the fixed alerts are sorted from, or null: sorted sea by sea. */
export const fixedNear = signal<{ lat: number; lon: number } | null>(null);

/**
 * How far an alert is from a position: to the edge of its zone, 0 inside.
 * @param alert - The alert.
 * @param from - The position.
 * @returns Kilometres, or `Infinity` for an alert without a zone.
 */
export function fixedDistance(
  alert: FixedAlert,
  from: { lat: number; lon: number },
): number {
  if (!alert.zone) return Number.POSITIVE_INFINITY;
  const { lat, lon, km } = alert.zone;
  return Math.max(0, distKm(from.lat, from.lon, lat, lon) - km);
}

/**
 * The alerts from the nearest to the farthest; those without a zone last, in
 * their order.
 * @param alerts - The alerts.
 * @param from - The position.
 * @returns The alerts sorted.
 */
export function byDistance(
  alerts: readonly FixedAlert[],
  from: { lat: number; lon: number },
): FixedAlert[] {
  return alerts.toSorted(
    (first, second) => fixedDistance(first, from) - fixedDistance(second, from),
  );
}
