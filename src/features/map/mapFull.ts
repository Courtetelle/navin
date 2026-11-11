import type { Map as LeafletMap } from 'leaflet';

/** The map on screen (search, the cross of a tap, the column buttons). */
const shown: { map: LeafletMap | null } = { map: null };

/**
 * Remember the map on screen.
 * @param map - Leaflet map, or `null` when it leaves the screen.
 */
export function setShownMap(map: LeafletMap | null): void {
  shown.map = map;
}

/**
 * The map on screen, if any.
 * @returns The Leaflet map, or `null`.
 */
export function shownMap(): LeafletMap | null {
  return shown.map;
}
