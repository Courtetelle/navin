import type { Control, GridLayer, Map as LeafletMap } from 'leaflet';
import { PMTiles } from 'pmtiles';

import { state, toast } from '../../state/index.ts';

import { isMapLive } from './mapExtras.ts';
import type { OfflineMap } from './offlineMapStore.ts';
import { offlineMapSource, offlineMaps } from './offlineMapStore.ts';
import {
  LAND_COLOR,
  offlineLabelRules,
  offlinePaintRules,
} from './offlineMapStyle.ts';

/**
 * Whether a map file covers a position.
 * @param map - The map file.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The position is inside its limits.
 */
export function offlineMapCovers(
  map: Pick<OfflineMap, 'south' | 'west' | 'north' | 'east'>,
  lat: number,
  lon: number,
): boolean {
  return (
    lat >= map.south && lat <= map.north && lon >= map.west && lon <= map.east
  );
}

async function newLayer(stored: OfflineMap): Promise<GridLayer> {
  // It extends the global Leaflet when called: it must load after Leaflet.
  const library = await import('protomaps-leaflet');
  return library.leafletLayer({
    url: new PMTiles(offlineMapSource(stored)),
    maxDataZoom: stored.maxZoom,
    maxZoom: 19,
    bounds: [
      [stored.south, stored.west],
      [stored.north, stored.east],
    ],
    backgroundColor: LAND_COLOR,
    paintRules: offlinePaintRules(library),
    labelRules: offlineLabelRules(library),
    attribution: '© OpenStreetMap · OpenMapTiles',
  } as unknown as Parameters<
    typeof library.leafletLayer
  >[0]) as unknown as GridLayer;
}

/**
 * Offer the map files of this device as backgrounds. When the online map cannot
 * load, the map file that covers the place takes over.
 * @param map - Leaflet map.
 * @param control - Layer chooser.
 * @param online - The online background that shows by default.
 */
export async function addOfflineMaps(
  map: LeafletMap,
  control: Control.Layers,
  online: GridLayer,
): Promise<void> {
  const stored = await offlineMaps().catch(() => []);
  if (stored.length === 0 || !isMapLive(map)) return;
  const layers = await Promise.all(
    stored.map(async (item) => ({ item, layer: await newLayer(item) })),
  );
  if (!isMapLive(map)) return;
  for (const { item, layer } of layers) {
    control.addBaseLayer(layer, `Hors ligne · ${item.name}`);
  }
  const takeOver = () => {
    if (!isMapLive(map) || !map.hasLayer(online)) return;
    const { lat, lng } = map.getCenter();
    const found = layers.find(({ item }) => offlineMapCovers(item, lat, lng));
    if (!found) return;
    online.off('tileerror', takeOver);
    map.removeLayer(online);
    found.layer.addTo(map);
    map.fire('baselayerchange', { layer: found.layer, name: found.item.name });
    if (state.view.currentView.peek() === 'tracker') {
      toast(`Pas de réseau : carte hors ligne ${found.item.name}`);
    }
  };
  online.on('tileerror', takeOver);
  map.on('unload', () => online.off('tileerror', takeOver));
  if (!navigator.onLine) takeOver();
}
