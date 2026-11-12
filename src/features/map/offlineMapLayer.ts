import type { Control, GridLayer, Map as LeafletMap } from 'leaflet';
import { PMTiles } from 'pmtiles';

import { state, toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

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

async function newLayer(
  stored: OfflineMap,
  reader: PMTiles,
  zIndex: number,
): Promise<GridLayer> {
  // It extends the global Leaflet when called: it must load after Leaflet.
  const library = await import('protomaps-leaflet');
  return library.leafletLayer({
    url: reader,
    zIndex,
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

const entryName = (item: OfflineMap) => `Hors ligne · ${item.name}`;

/** The backgrounds (OpenStreetMap, Swiss map) lie under the map files. */
export const BACKGROUND_Z = -1;
/** The map files lie on the background, under the overlays (OpenSeaMap). */
const OFFLINE_Z = 0;
/** The map files the sailor unticked in the layer menu. */
const HIDDEN_KEY = 'ldb.offlineHidden';

/**
 * Show every map file of this device at once, each over its own area, on top
 * of the background and under the overlays: with or without network, what
 * was loaded is what is seen. Each one has its tick in the layer menu; one
 * unticked stays hidden the next times.
 * @param map - Leaflet map.
 * @param control - Layer chooser.
 */
export async function addOfflineMaps(
  map: LeafletMap,
  control: Control.Layers,
): Promise<void> {
  const stored = await offlineMaps().catch(() => []);
  if (stored.length === 0 || !isMapLive(map)) return;
  const layers = await Promise.all(
    stored.map(async (item) => ({
      item,
      layer: await newLayer(
        item,
        new PMTiles(offlineMapSource(item)),
        OFFLINE_Z,
      ),
    })),
  );
  if (!isMapLive(map)) return;
  const hidden = new Set(store.get<string[]>(HIDDEN_KEY, []));
  for (const { item, layer } of layers) {
    control.addOverlay(layer, entryName(item));
    if (!hidden.has(item.id)) layer.addTo(map);
  }
  const remember = (name: string, shown: boolean) => {
    const found = layers.find(({ item }) => entryName(item) === name);
    if (!found) return;
    if (shown) hidden.delete(found.item.id);
    else hidden.add(found.item.id);
    store.set(HIDDEN_KEY, [...hidden]);
  };
  map.on('overlayadd', (event) => remember(event.name, true));
  map.on('overlayremove', (event) => remember(event.name, false));
  if (navigator.onLine || state.view.currentView.peek() !== 'tracker') return;
  const { lat, lng } = map.getCenter();
  const shown = layers.find(
    ({ item }) => !hidden.has(item.id) && offlineMapCovers(item, lat, lng),
  );
  if (shown) toast(`Pas de réseau : carte hors ligne ${shown.item.name}`);
}
