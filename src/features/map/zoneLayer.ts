import type { TileLayer } from 'leaflet';

import { leaflet } from './leaflet.ts';
import { ZONE_BASE } from './zoneStore.ts';

/**
 * Plan of the offline zones (legacy `zoneLayer`).
 * @returns The layer.
 */
export function zoneLayer(): TileLayer {
  return leaflet().tileLayer(ZONE_BASE, {
    maxZoom: 19,
    maxNativeZoom: 18,
    crossOrigin: true,
    attribution: '© OpenStreetMap © CARTO',
  });
}
