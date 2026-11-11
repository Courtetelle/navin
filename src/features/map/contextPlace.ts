import { lastKnownPos, state } from '../../state/index.ts';

import { lakePlace } from './lakeCenter.ts';
import { seaPlace } from './seaCenter.ts';
import { defaultMapCenter, shownMapCenter } from './shownMap.ts';

/** A place the menus refer to. */
export interface ContextPlace {
  lat: number;
  lon: number;
  /** Chosen with NavIn (zone forced), not read from the GPS. */
  forced: boolean;
}

/** A position older than this no longer tells where one sails. */
const FRESH_MS = 12 * 3600e3;

/**
 * The place every menu speaks of (weather, Live météo, rescue, VHF or phone):
 * the zone chosen with NavIn first (at sea the sea place of the settings, on
 * a lake the lake place of the settings), else a recent GPS position, else the map last shown.
 * @returns The place.
 */
export function contextPlace(): ContextPlace {
  const forced = state.view.zoneSimV.value;
  if (forced === 'mer') {
    const { lat, lon } = seaPlace();
    return { lat, lon, forced: true };
  }
  if (forced === 'lac') {
    const { lat, lon } = lakePlace();
    return { lat, lon, forced: true };
  }
  const known = lastKnownPos();
  if (known && (!known.at || Date.now() - Date.parse(known.at) < FRESH_MS)) {
    return { lat: known.lat, lon: known.lon, forced: false };
  }
  const shown = shownMapCenter();
  if (shown) return { ...shown, forced: false };
  return { ...defaultMapCenter(true), forced: false };
}
