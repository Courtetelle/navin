import { signal } from '@preact/signals-react';

import type { LiveStation } from '../../features/onwater/index.ts';

/**
 * The station whose whole card LiveMétéo opens (a long press on its badge
 * on the NavIn map): its ◀ comes back to the map. Taken by the page once.
 */
export const liveDetail = signal<LiveStation | null>(null);

/**
 * The station whose badge blinks three times when the map is back (« 📍
 * Toucher : voir sur la carte » on its card), as `lat,lon`. Taken once.
 */
export const liveBlink = signal<string | null>(null);

/**
 * The key of a station for {@link liveBlink}.
 * @param station - The station.
 * @returns `lat,lon`.
 */
export function blinkKey(station: Pick<LiveStation, 'lat' | 'lon'>): string {
  return `${station.lat.toFixed(5)},${station.lon.toFixed(5)}`;
}
