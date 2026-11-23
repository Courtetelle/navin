import type { Map as LeafletMap } from 'leaflet';

import type { ZoneBox } from '../../features/zones/meteoZones.ts';

/** At most this share of the height is kept clear at the top or bottom. */
const MOST_SHARE = 0.45;
/** Margin around the zones, px. */
const MARGIN = 12;

/**
 * The room the buttons and the chooser of the zones take at the top and the
 * bottom of the screen, so that the zones are shown in the part left free.
 * @param height - Height of the window, px.
 * @returns Pixels to keep clear at the top and the bottom.
 */
export function coveredEdges(height: number): { top: number; bottom: number } {
  let top = 0;
  let bottom = 0;
  for (const element of document.querySelectorAll(
    '.rail-btn, .zone-pick, .live-slot',
  )) {
    const box = element.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    if (box.bottom < 0 || box.top > height) continue;
    if ((box.top + box.bottom) / 2 < height / 2) {
      top = Math.max(top, box.bottom);
    } else {
      bottom = Math.max(bottom, height - box.top);
    }
  }
  const most = height * MOST_SHARE;
  return { top: Math.min(top, most), bottom: Math.min(bottom, most) };
}

/**
 * Zoom the map on the zones chosen, in the part of the screen the buttons
 * and the chooser leave free.
 * @param map - The map of NavIn.
 * @param box - The box of the zones.
 */
export function fitZones(map: LeafletMap, box: ZoneBox): void {
  const { top, bottom } = coveredEdges(globalThis.innerHeight);
  map.fitBounds(
    [
      [box.south, box.west],
      [box.north, box.east],
    ],
    {
      paddingTopLeft: [MARGIN, top + MARGIN],
      paddingBottomRight: [MARGIN, bottom + MARGIN],
    },
  );
}
