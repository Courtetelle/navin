import type { CircleMarker, LayerGroup, Map as LeafletMap } from 'leaflet';

import { fr } from '../../lib/format.ts';

import landmarks from './landmarks.json' with { type: 'json' };
import { leaflet } from './leaflet.ts';

/** Further out than this, the marks would only clutter the map. */
const MIN_ZOOM = 10;

const escapeText = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');

/**
 * Text of a landmark.
 * @param name - Its name.
 * @param kind - Its kind.
 * @param height - Its height in metres, when known.
 * @returns The HTML of its bubble.
 */
export function landmarkHtml(
  name: string,
  kind: string,
  height?: number,
): string {
  const tall = height ? ` · ${fr(height)} m` : '';
  const title = name === kind ? '' : `<b>${escapeText(name)}</b><br>`;
  return `${title}${escapeText(kind)}${tall}`;
}

/**
 * Optional layer of the landmarks around Lake Geneva, from OpenStreetMap: a tap
 * gives the name. There are thousands: only those on the screen are drawn.
 * @param map - Leaflet map.
 * @returns The layer.
 */
export function newLandmarkLayer(map: LeafletMap): LayerGroup {
  const L = leaflet();
  const layer = L.layerGroup();
  const shown = new Map<number, CircleMarker>();
  const refresh = () => {
    if (!map.hasLayer(layer)) return;
    const zoom = map.getZoom();
    const view = map.getBounds().pad(0.2);
    for (const [
      index,
      { geometry, properties },
    ] of landmarks.features.entries()) {
      const [lon, lat] = geometry.coordinates as [number, number];
      const { name, kind, height } = properties;
      const wanted = zoom >= MIN_ZOOM && view.contains([lat, lon]);
      const marker = shown.get(index);
      if (wanted && !marker) {
        shown.set(
          index,
          L.circleMarker([lat, lon], {
            radius: 7,
            color: '#fff',
            weight: 2,
            fillColor: '#d00000',
            fillOpacity: 1,
            // A tap names the landmark, not the depth of the water under it.
            bubblingMouseEvents: false,
          })
            .bindPopup(landmarkHtml(name, kind, height))
            .addTo(layer),
        );
      } else if (!wanted && marker) {
        marker.remove();
        shown.delete(index);
      }
    }
  };
  layer.on('add', () => {
    map.on('moveend', refresh);
    refresh();
  });
  layer.on('remove', () => {
    map.off('moveend', refresh);
    layer.clearLayers();
    shown.clear();
  });
  return layer;
}
