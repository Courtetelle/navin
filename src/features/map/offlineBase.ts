import type { GridLayer, Map as LeafletMap } from 'leaflet';

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
