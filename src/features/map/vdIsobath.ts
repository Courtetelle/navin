import type { Control, Map as LeafletMap } from 'leaflet';

import { store } from '../../storage/store.ts';

import { leaflet } from './leaflet.ts';
import { isMapLive } from './mapExtras.ts';
import { LEMAN_BOX, addRegional } from './regionalLayers.ts';

/** A layer of the Vaud WMS. */
interface VdLayer {
  name: string;
  title: string;
}

interface StoredLayers {
  at: number;
  layers: VdLayer[];
}

/** WMS of the canton of Vaud. */
export const VD_WMS =
  'https://www.ogc.vd.ch/public/services/OGC/wmsVD/Mapserver/WMSServer';
const VD_BOUNDS: [[number, number], [number, number]] = [
  [46.18, 6.1],
  [46.56, 6.95],
];
const MONTH_MS = 30 * 864e5;

/**
 * Depth layers of the Vaud WMS, found in its capabilities and kept 30 days
 * (legacy `vdIsobathLayers`).
 * @returns The layers, empty when unknown.
 */
export async function vdIsobathLayers(): Promise<VdLayer[]> {
  const known = store.get<StoredLayers | null>('ldb.vdIsobath', null);
  if (known?.layers?.length && Date.now() - known.at < MONTH_MS) {
    return known.layers;
  }
  try {
    const response = await fetch(
      `${VD_WMS}?SERVICE=WMS&REQUEST=GetCapabilities&VERSION=1.3.0`,
    );
    if (!response.ok) return known?.layers ?? [];
    const found = depthLayers(await response.text());
    if (found.length > 0) {
      store.set('ldb.vdIsobath', { at: Date.now(), layers: found });
    }
    return found.length > 0 ? found : (known?.layers ?? []);
  } catch {
    return known?.layers ?? [];
  }
}

/**
 * Add the Vaud depth images to a map (legacy `addVdIsobath`).
 * @param map - Leaflet map.
 * @param layersControl - Its layer selector.
 */
export async function addVdIsobath(
  map: LeafletMap,
  layersControl: Control.Layers,
): Promise<void> {
  const layers = await vdIsobathLayers();
  if (layers.length === 0 || !isMapLive(map)) return;
  const wms = leaflet().tileLayer.wms(VD_WMS, {
    layers: layers.map((layer) => layer.name).join(','),
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
    bounds: VD_BOUNDS,
    maxZoom: 19,
    opacity: 0.85,
    attribution: '© État de Vaud',
  });
  addRegional(map, layersControl, wms, 'Isobathes (canton de Vaud)', LEMAN_BOX);
}

function depthLayers(xml: string): VdLayer[] {
  const capabilities = new DOMParser().parseFromString(xml, 'text/xml');
  const found: VdLayer[] = [];
  for (const layer of capabilities.querySelectorAll('Layer')) {
    const children = [...layer.children];
    const name = children.find((child) => child.localName === 'Name');
    const title = children.find((child) => child.localName === 'Title');
    const text = `${name?.textContent ?? ''} ${title?.textContent ?? ''}`;
    if (name && /bathy|isobath|profondeur/i.test(text)) {
      const nameText = (name.textContent ?? '').trim();
      found.push({
        name: nameText,
        title: title?.textContent?.trim() || nameText,
      });
    }
  }
  return found;
}
