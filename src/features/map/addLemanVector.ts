import type { Control, GridLayer, Map as LeafletMap } from 'leaflet';

import { bathLayer } from './bathLayer.ts';
import { BATHY_TILES, SWISS_BOUNDS } from './constants.ts';
import { isobathLoad } from './isobath.ts';
import { newIsobathLayer } from './isobathLayer.ts';
import { leaflet } from './leaflet.ts';
import { newLemanAxesLayer } from './lemanAxes.ts';
import { lemanFullIsobaths, lemanIsobaths } from './lemanIsobaths.ts';
import type { LemanVector } from './lemanVector.ts';
import { lemanVecLoad } from './lemanVector.ts';
import { isMapLive } from './mapExtras.ts';
import { newShoreBands } from './shoreBands.ts';
import { addVdIsobath } from './vdIsobath.ts';
import { lemanVecLayer } from './vectorLayers.ts';

/**
 * Add the vector layers of Lake Geneva to a map and to its layer selector
 * (legacy `addLemanVector`). The OpenSeaMap tiles stay on: the buoyage kept in
 * the app, which holds the same marks, takes over when the map has no network.
 * @param map - Leaflet map.
 * @param layersControl - Its layer selector.
 * @param online - The online background: when it fails, the network is gone.
 */
export async function addLemanVector(
  map: LeafletMap,
  layersControl: Control.Layers,
  online: GridLayer,
): Promise<void> {
  const L = leaflet();
  let noNetwork = !navigator.onLine;
  let showBuoyage = () => {
    noNetwork = true;
  };
  online.once('tileerror', () => showBuoyage());
  const bathy = L.tileLayer(BATHY_TILES, {
    maxZoom: 19,
    maxNativeZoom: 18,
    crossOrigin: true,
    bounds: SWISS_BOUNDS,
    opacity: 0.6,
    attribution: '© swisstopo swissBATHY3D',
  });
  layersControl.addOverlay(bathy, 'Relief du fond (swissBATHY3D)');
  layersControl.addOverlay(newLemanAxesLayer(), 'Axes de position du Léman');
  const vector = await lemanVecLoad();
  if (!isMapLive(map)) return;
  const device = await isobathLoad();
  const lines = await lemanIsobaths(device);
  if (lines.length > 0 && isMapLive(map)) {
    const layer = newIsobathLayer(lines);
    layersControl.addOverlay(
      layer,
      'Isobathes du Léman, jusqu’à 20 m (swissBATHY3D)',
    );
    layer.addTo(map);
    const full = await lemanFullIsobaths(device);
    if (isMapLive(map)) {
      layersControl.addOverlay(
        newIsobathLayer(full),
        'Isobathes complètes, 1 à 300 m (swissBATHY3D)',
      );
    }
  }
  void addVdIsobath(map, layersControl);
  const { default: seamarks } = await import('./lemanSeamarks.json');
  if (!isMapLive(map)) return;
  const buoyage = lemanVecLayer(
    seamarks as unknown as Pick<LemanVector, 'feats'>,
  );
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
  layersControl.addOverlay(buoyage, 'Balises et ports (hors ligne)');
  showBuoyage = () => {
    if (isMapLive(map)) buoyage.addTo(map);
  };
  if (noNetwork) showBuoyage();
}
