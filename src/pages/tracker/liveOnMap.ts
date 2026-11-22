import { signal } from '@preact/signals-react';

import { buzz } from '../../lib/dom.ts';
import { go } from '../../shell/router.ts';
import type { ZoneBox } from '../../features/zones/meteoZones.ts';
import { state, updateSettings } from '../../state/index.ts';

/**
 * The live weather stations stand on the NavIn map: the time they were asked
 * for, 0 when they are off (asked again, they are read again for the map
 * shown then).
 */
export const liveOnMap = signal(0);

/**
 * How the stations are chosen: the map shown (long press on Météo), or the
 * Météo-France zones chosen, else that of the zone chosen with NavIn or of
 * the GPS (the Météo menu).
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
 * Lay the live weather stations of the Météo-France zones, their outline
 * drawn and the map zoomed on them (the Météo menu).
 */
export function showLiveAround(): void {
  buzz();
  liveOnMapAround.value = true;
  liveOnMap.value = Date.now();
  go('tracker');
}

/**
 * Lay the stations of the zone without a touch (a wind alert asked for
 * them): no buzz, the map already shown.
 */
export function layLiveAround(): void {
  liveOnMapAround.value = true;
  liveOnMap.value = Date.now();
}

/** Take the stations off the map. */
export function hideLiveOnMap(): void {
  buzz();
  liveOnMap.value = 0;
}

/**
 * The Météo-France zones chosen for LiveMétéo (long press on the button of
 * the zone, or Paramétrages › Alertes › LiveMétéo): their ids, empty for
 * « the zone where I am ».
 * @returns The ids.
 */
export function liveZoneIds(): string[] {
  const chosen = state.preferences.settings.value.liveZones;
  return Array.isArray(chosen)
    ? chosen.filter((id): id is string => typeof id === 'string')
    : [];
}

/**
 * Keep the zones chosen.
 * @param ids - The ids, empty for « the zone where I am ».
 */
export function setLiveZones(ids: readonly string[]): void {
  updateSettings((settings) => {
    settings.liveZones = [...new Set(ids)];
  });
}

/** The chooser of the zones is open over the map. */
export const zonePickOpen = signal(false);

/** The box of the zones shown, for the forecast laid over them. */
export const liveZoneArea = signal<ZoneBox | null>(null);
