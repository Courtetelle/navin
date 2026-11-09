import type { Map as LeafletMap } from 'leaflet';

import { store } from '../../storage/store.ts';

import { LEMAN_CENTER, SEA_CENTER } from './constants.ts';

/** Centre of the map last shown, kept from one start to the next. */
const CENTER_KEY = 'ldb.mapCenter';

/** A place, in degrees. */
export interface Place {
  lat: number;
  lon: number;
}

/**
 * Remember the centre of a map each time it moves: the last map shown gives
 * the place of the sunrise and sunset when the GPS is off.
 * @param map - The map.
 */
export function followShownMap(map: LeafletMap): void {
  const note = () => {
    try {
      const { lat, lng } = map.getCenter();
      store.set(CENTER_KEY, { lat, lon: lng });
    } catch {
      // A map without a view yet has no centre.
    }
  };
  map.on('load moveend', note);
  note();
}

/**
 * The centre of the map last shown, even before a start.
 * @returns The place, or `null` when no map was ever shown.
 */
export function shownMapCenter(): Place | null {
  const center = store.get<Place | null>(CENTER_KEY, null);
  return center && Number.isFinite(center.lat) && Number.isFinite(center.lon)
    ? center
    : null;
}

/**
 * Where the map opens when nothing is known: Lake Geneva or the sea.
 * @param lake - Inland waters.
 * @returns The place.
 */
export function defaultMapCenter(lake: boolean): Place {
  const [lat, lon] = lake ? LEMAN_CENTER : SEA_CENTER;
  return { lat, lon };
}
