import type { Control, Layer, Map as LeafletMap } from 'leaflet';

import type { GeoBox } from './constants.ts';
import { LEMAN_BBOX, SWISS_BOUNDS } from './constants.ts';
import { isMapLive } from './mapExtras.ts';

/** An entry of the layer menu that only makes sense over one area. */
interface Entry {
  layer: Layer;
  name: string;
  box: GeoBox;
  base: boolean;
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
    if (!inView) control.removeLayer(entry.layer);
    else if (entry.base) control.addBaseLayer(entry.layer, entry.name);
    else control.addOverlay(entry.layer, entry.name);
  }
}

/**
 * Put a layer in the layer menu only while its area is on screen: the Lake
 * Geneva layers when a part of the lake shows, the Swiss ones over
 * Switzerland. A layer turned on stays on; it only leaves the menu.
 * @param map - The map.
 * @param control - Its layer menu.
 * @param layer - The layer.
 * @param name - Its name in the menu.
 * @param box - Its area.
 * @param base - A background map rather than an overlay.
 */
export function addRegional(
  map: LeafletMap,
  control: Control.Layers,
  layer: Layer,
  name: string,
  box: GeoBox,
  base = false,
): void {
  let entries = entriesOf.get(control);
  if (!entries) {
    entries = [];
    entriesOf.set(control, entries);
    map.on('moveend zoomend', () => update(map, control));
  }
  entries.push({ layer, name, box, base, shown: false });
  try {
    update(map, control);
  } catch {
    // The map has no view yet: the first move shows the entry.
  }
}
