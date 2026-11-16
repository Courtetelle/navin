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

/** Back from a station card, the map opens this close on its badge. */
export const LIVE_FOCUS_ZOOM = 12;

/**
 * Where the map must open, back from a station card: on its badge.
 * @returns The place, or null.
 */
export function liveFocusPlace(): { lat: number; lon: number } | null {
  const key = liveBlink.peek();
  if (!key) return null;
  const [lat, lon] = key.split(',').map(Number);
  return lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)
    ? null
    : { lat, lon };
}

/**
 * The key of a station for {@link liveBlink}.
 * @param station - The station.
 * @returns `lat,lon`.
 */
export function blinkKey(station: Pick<LiveStation, 'lat' | 'lon'>): string {
  return `${station.lat.toFixed(5)},${station.lon.toFixed(5)}`;
}
