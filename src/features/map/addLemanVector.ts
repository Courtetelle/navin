import type { Control, Layer, Map as LeafletMap } from 'leaflet';

import { bathLayer } from './bathLayer.ts';
import { SWISS_BOUNDS } from './constants.ts';
import { isobathLoad } from './isobath.ts';
import { newIsobathLayer } from './isobathLayer.ts';
import { leaflet } from './leaflet.ts';
import { lemanVecLoad } from './lemanVector.ts';
import { isMapLive } from './mapExtras.ts';
import { newShoreBands } from './shoreBands.ts';
import { addVdIsobath } from './vdIsobath.ts';
import { lemanVecLayer } from './vectorLayers.ts';

const BATHY_TILES =
  'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissbathy3d-reliefschattierung/default/current/3857/{z}/{x}/{y}.png';

/**
 * Add the vector layers of Lake Geneva to a map and to its layer selector
 * (legacy `addLemanVector`); the vector buoyage replaces the OpenSeaMap tiles.
 * @param map - Leaflet map.
 * @param layersControl - Its layer selector.
 * @param seamark - OpenSeaMap layer.
 */
export async function addLemanVector(
  map: LeafletMap,
  layersControl: Control.Layers,
  seamark: Layer,
): Promise<void> {
  const L = leaflet();
  const bathy = L.tileLayer(BATHY_TILES, {
    maxZoom: 19,
    maxNativeZoom: 18,
    crossOrigin: true,
    bounds: SWISS_BOUNDS,
    opacity: 0.6,
    attribution: '© swisstopo swissBATHY3D',
  });
  layersControl.addOverlay(bathy, 'Relief du fond (swissBATHY3D)');
  const vector = await lemanVecLoad();
  if (!isMapLive(map)) return;
  const lines = await isobathLoad();
  if (lines.length > 0 && isMapLive(map)) {
    const layer = newIsobathLayer(lines);
    layersControl.addOverlay(layer, 'Courbes 1 à 5 m (swissBATHY3D)');
    layer.addTo(map);
  }
  void addVdIsobath(map, layersControl);
  const buoyage = lemanVecLayer(vector);
  if (vector?.shore?.length) {
    const bands = newShoreBands(vector.shore);
    layersControl.addOverlay(bands, 'Zones 150 m et 300 m des rives');
    bands.addTo(map);
  }
  const bath = bathLayer(vector);
  if (bath) {
    layersControl.addOverlay(
      bath,
      'Baignade interdite (100 m des ports et débarcadères)',
    );
    bath.addTo(map);
  }
  if (!buoyage) return;
  layersControl.addOverlay(buoyage, 'Balises et ports (vectoriel, hors ligne)');
  buoyage.addTo(map);
  if (map.hasLayer(seamark)) map.removeLayer(seamark);
}
