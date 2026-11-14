import { lastKnownPos, navinSpot, state } from '../../state/index.ts';

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
 * The place every menu speaks of (weather, LiveMétéo, wind alerts, rescue,
 * VHF or phone): with a zone chosen with NavIn, the place NavIn looks at (where
 * the map was left with the fingers, else the place of the settings for the
 * sea or the lake); on the GPS (the boat arrow), a recent GPS position, else
 * the map last shown.
 * @returns The place.
 */
export function contextPlace(): ContextPlace {
  const forced = state.view.zoneSimV.value;
  // NavIn is the master: where the fingers last left its map, in the zone
  // chosen with it.
  const spot = forced ? navinSpot() : null;
  if (spot) return { lat: spot.lat, lon: spot.lon, forced: true };
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
