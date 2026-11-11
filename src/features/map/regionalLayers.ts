import type { Control, Layer, Map as LeafletMap } from 'leaflet';

import type { GeoBox } from './constants.ts';
import { LEMAN_BBOX, SWISS_BOUNDS } from './constants.ts';
import { isMapLive } from './mapExtras.ts';

/** An entry of the layer menu that only makes sense over one area. */
interface Entry {
  layer: Layer;
  name: string;
  box: GeoBox;
  /** For a background map: the background that takes over out of its area. */
  fallback: Layer | null;
  shown: boolean;
}

/** The area of Switzerland, as a box. */
export const SWISS_BOX: GeoBox = {
  s: SWISS_BOUNDS[0][0],
  w: SWISS_BOUNDS[0][1],
  n: SWISS_BOUNDS[1][0],
  e: SWISS_BOUNDS[1][1],
};

/** Lake Geneva and its shores. */
export const LEMAN_BOX: GeoBox = LEMAN_BBOX;

const entriesOf = new WeakMap<Control.Layers, Entry[]>();

/**
 * Whether a box shows a part of an area.
 * @param view - The box on screen.
 * @param area - The area.
 * @returns They meet.
 */
export function boxesMeet(view: GeoBox, area: GeoBox): boolean {
  return (
    view.s <= area.n && view.n >= area.s && view.w <= area.e && view.e >= area.w
  );
}

function update(map: LeafletMap, control: Control.Layers): void {
  if (!isMapLive(map)) return;
  const bounds = map.getBounds();
  const view: GeoBox = {
    s: bounds.getSouth(),
    n: bounds.getNorth(),
    w: bounds.getWest(),
    e: bounds.getEast(),
  };
  for (const entry of entriesOf.get(control) ?? []) {
    const inView = boxesMeet(view, entry.box);
    if (inView === entry.shown) continue;
    entry.shown = inView;
    if (inView) {
      if (entry.fallback) control.addBaseLayer(entry.layer, entry.name);
      else control.addOverlay(entry.layer, entry.name);
      continue;
    }
    control.removeLayer(entry.layer);
    // A background left behind would show nothing out of its area.
    if (entry.fallback && map.hasLayer(entry.layer)) {
      map.removeLayer(entry.layer);
      map.addLayer(entry.fallback);
    }
  }
}

/**
 * Put a layer in the layer menu only while its area is on screen: the Lake
 * Geneva layers when a part of the lake shows, the Swiss ones over
 * Switzerland. An overlay turned on stays on; it only leaves the menu. A
 * background map gives way to its fallback when its area leaves the screen.
 * @param map - The map.
 * @param control - Its layer menu.
 * @param layer - The layer.
 * @param name - Its name in the menu.
 * @param box - Its area.
 * @param fallback - For a background map: the one that takes over out of
 *   its area; without it, the layer is an overlay.
 */
export function addRegional(
  map: LeafletMap,
  control: Control.Layers,
  layer: Layer,
  name: string,
  box: GeoBox,
  fallback: Layer | null = null,
): void {
  let entries = entriesOf.get(control);
  if (!entries) {
    entries = [];
    entriesOf.set(control, entries);
    map.on('moveend zoomend', () => update(map, control));
  }
  entries.push({ layer, name, box, fallback, shown: false });
  try {
    update(map, control);
  } catch {
    // The map has no view yet: the first move shows the entry.
  }
}
