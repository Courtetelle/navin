import type { GridLayer, Map as LeafletMap } from 'leaflet';

import { inSwissArea } from './constants.ts';
import { whileMapLive } from './mapExtras.ts';
import { simSeaMode } from './trackerRecenter.ts';

/** Without any tile after this long, the Swiss map is tried. */
const NO_TILE_DELAY_MS = 4000;
/** Errors before the Swiss map is tried, without waiting. */
const MAX_ERRORS = 4;

/**
 * Use the Swiss map, kept on the device, when OpenStreetMap cannot load for lack
 * of network: its tiles cannot be downloaded in advance.
 * @param map - Leaflet map.
 * @param online - OpenStreetMap layer.
 * @param offline - Swiss map layer.
 */
export function swissWhenOffline(
  map: LeafletMap,
  online: GridLayer,
  offline: GridLayer,
): void {
  online.on('tileerror', () => {
    if (navigator.onLine || !map.hasLayer(online)) return;
    map.removeLayer(online);
    offline.addTo(map);
  });
}

/**
 * In Switzerland, use the Swiss map when the background chosen gives no tile,
 * even with a network. Without it either, the map stays empty under its layers:
 * never a made-up chart.
 * @param map - Leaflet map.
 * @param bases - Background layers.
 * @param swiss - The Swiss map, one of them.
 */
export function swissWhenNoTiles(
  map: LeafletMap,
  bases: readonly GridLayer[],
  swiss: GridLayer,
): void {
  let loaded = 0;
  let errors = 0;
  let done = false;
  const swap = () => {
    if (done || loaded) return;
    done = true;
    const { lat, lng } = map.getCenter();
    if (simSeaMode() || !inSwissArea({ lat, lon: lng })) return;
    if (map.hasLayer(swiss)) return;
    for (const base of bases) {
      if (map.hasLayer(base)) map.removeLayer(base);
    }
    swiss.addTo(map);
  };
  const onLoad = () => {
    loaded++;
  };
  const onError = () => {
    errors++;
    if (errors >= MAX_ERRORS) swap();
  };
  for (const base of bases) {
    base.on('tileload', onLoad);
    base.on('tileerror', onError);
  }
  // Tiles blocked without any error: swap all the same.
  whileMapLive(map, swap, NO_TILE_DELAY_MS);
}
