import type { Map as LeafletMap } from 'leaflet';

let center: { lat: number; lon: number } | null = null;

/**
 * Remember the centre of a map each time it moves: the last map shown gives
 * the place of the sunrise and sunset of the clock when the GPS is off.
 * @param map - The map.
 */
export function followShownMap(map: LeafletMap): void {
  const note = () => {
    try {
      const { lat, lng } = map.getCenter();
      center = { lat, lon: lng };
    } catch {
      // A map without a view yet has no centre.
    }
  };
  map.on('load moveend', note);
  note();
}

/**
 * The centre of the map last shown.
 * @returns The place, or `null` when no map was shown yet.
 */
export function shownMapCenter(): { lat: number; lon: number } | null {
  return center;
}
