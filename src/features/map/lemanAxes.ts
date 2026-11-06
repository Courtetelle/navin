import type { Layer } from 'leaflet';

import { LEMAN_LINES, LEMAN_MARKS } from '../safety/sosPlaceMarks.ts';

import { leaflet } from './leaflet.ts';

/**
 * Layer of the axes used to say a position on Lake Geneva, drawn in red.
 * @returns The layer.
 */
export function newLemanAxesLayer(): Layer {
  const L = leaflet();
  const axes = L.layerGroup();
  for (const [first, second] of LEMAN_LINES) {
    const start = LEMAN_MARKS[first];
    const end = LEMAN_MARKS[second];
    if (!start || !end) continue;
    L.polyline([[...start], [...end]], { color: '#d00000', weight: 2 })
      .bindTooltip(`${first} – ${second}`, { sticky: true })
      .addTo(axes);
  }
  return axes;
}
