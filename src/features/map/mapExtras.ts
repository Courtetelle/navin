import type { LayerGroup, Map as LeafletMap } from 'leaflet';

/** What legacy kept in `map._xxx` properties. */
export interface MapExtras {
  /** Ends the DOM listeners attached to the map container. */
  controller: AbortController;
  removed: boolean;
  gotoLine: LayerGroup | null;
  marks: LayerGroup | null;
}

const extras = new WeakMap<LeafletMap, MapExtras>();

/**
 * The extras of a map, created at first use.
 * @param map - Leaflet map.
 * @returns Its extras.
 */
export function extrasOf(map: LeafletMap): MapExtras {
  let found = extras.get(map);
  if (!found) {
    found = {
      controller: new AbortController(),
      removed: false,
      gotoLine: null,
      marks: null,
    };
    extras.set(map, found);
  }
  return found;
}

/**
 * Whether a map is still on screen (legacy `map._container.isConnected`).
 * @param map - Leaflet map.
 * @returns `true` while it can be drawn on.
 */
export function isMapLive(map: LeafletMap): boolean {
  return !extrasOf(map).removed && map.getContainer().isConnected;
}

/**
 * Remove a map and everything attached to its container.
 * @param map - Leaflet map.
 */
export function disposeMap(map: LeafletMap): void {
  const found = extrasOf(map);
  if (found.removed) return;
  found.removed = true;
  found.controller.abort();
  map.remove();
}

/**
 * Run later, unless the map left the screen meanwhile.
 * @param map - Leaflet map.
 * @param action - What to run.
 * @param delay - Milliseconds.
 */
export function whileMapLive(
  map: LeafletMap,
  action: () => void,
  delay: number,
): void {
  setTimeout(() => {
    if (isMapLive(map)) action();
  }, delay);
}
