import { signal } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import { state } from '../../state/index.ts';

/**
 * The live weather stations stand on the NavIn map: the time they were asked
 * for, 0 when they are off (asked again, they are read again for the map
 * shown then).
 */
export const liveOnMap = signal(0);

/**
 * How the stations are chosen: the map shown (long press on Météo), or a
 * circle of 120 km across around the zone chosen with NavIn, else the GPS
 * (the Météo menu).
 */
export const liveOnMapAround = signal(false);

/** Lay the live weather stations of the map shown (long press on Météo). */
export function showLiveOnMap(): void {
  buzz();
  liveOnMapAround.value = false;
  liveOnMap.value = Date.now();
  go('tracker');
}

/**
 * Lay the live weather stations within 60 km of the zone (or the GPS), the
 * circle drawn and the map zoomed on it (the Météo menu).
 */
export function showLiveAround(): void {
  buzz();
  liveOnMapAround.value = true;
  liveOnMap.value = Date.now();
  go('tracker');
}

/** Take the stations off the map. */
export function hideLiveOnMap(): void {
  buzz();
  liveOnMap.value = 0;
}

/** The radii LiveMétéo offers in Réglages, in nautical miles. */
export const LIVE_RADII_NM = [15, 30, 60, 120, 180] as const;

/**
 * The radius of LiveMétéo around the zone or the GPS, in nautical miles
 * (Réglages › LiveMétéo), 30 NM by default.
 * @returns Nautical miles.
 */
export function liveRadiusNm(): number {
  const chosen = Number(state.preferences.settings.value.liveRadiusNm);
  return (LIVE_RADII_NM as readonly number[]).includes(chosen) ? chosen : 30;
}

/**
 * The same radius in km, for the networks read.
 * @returns Kilometres.
 */
export function liveRadius(): number {
  return Math.round(liveRadiusNm() * 1.852);
}
