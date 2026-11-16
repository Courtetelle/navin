/** An area the map must open on: its middle and half its size. */
export interface MapArea {
  lat: number;
  lon: number;
  km: number;
}

/** Asked this long ago at most, the area is still waited for. */
const FRESH_MS = 3000;

let pending: { area: MapArea; at: number } | null = null;

/**
 * Open the map on an area next time it is built (a warning light of a lake
 * touched in its list).
 * @param area - The area.
 */
export function askMapArea(area: MapArea): void {
  pending = { area, at: Date.now() };
}

/**
 * The area the map must open on, while fresh (read again by a map built
 * twice; it lapses on its own).
 * @returns The area, or null.
 */
export function pendingMapArea(): MapArea | null {
  return pending && Date.now() - pending.at < FRESH_MS ? pending.area : null;
}
