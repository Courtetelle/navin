import { effect, signal } from '@preact/signals-react';
import type { Control, Layer, Map as LeafletMap } from 'leaflet';

import { store } from '../../storage/store.ts';

import { isMapLive } from './mapExtras.ts';

/** A background or a layer of the maps, as « Mes cartes » lists it. */
export interface MapLayerName {
  name: string;
  kind: 'base' | 'overlay';
  /** Shown on the map the last time the map was open. */
  on: boolean;
}

/** The choices of « Mes cartes »: the background, and each layer on or off. */
interface LayerPrefs {
  base: string | null;
  on: Record<string, boolean>;
}

const PREFS_KEY = 'ldb.mapLayers';
const NAMES_KEY = 'ldb.mapLayerNames';

/** What the sailor chose in « Mes cartes ». */
export const layerPrefs = signal<LayerPrefs>(
  store.get<LayerPrefs>(PREFS_KEY, { base: null, on: {} }),
);

/** The backgrounds and layers the map offered where it was last shown. */
export const mapLayerNames = signal<MapLayerName[]>(
  store.get<MapLayerName[]>(NAMES_KEY, []),
);

function savePrefs(prefs: LayerPrefs): void {
  layerPrefs.value = prefs;
  store.set(PREFS_KEY, prefs);
}

/**
 * Choose the background of the maps.
 * @param name - Its name.
 */
export function chooseBase(name: string): void {
  savePrefs({ ...layerPrefs.peek(), base: name });
  mapLayerNames.value = mapLayerNames
    .peek()
    .map((item) =>
      item.kind === 'base' ? { ...item, on: item.name === name } : item,
    );
}

/**
 * Turn a layer of the maps on or off.
 * @param name - Its name.
 * @param on - Shown.
 */
export function chooseOverlay(name: string, on: boolean): void {
  const prefs = layerPrefs.peek();
  savePrefs({ ...prefs, on: { ...prefs.on, [name]: on } });
  mapLayerNames.value = mapLayerNames
    .peek()
    .map((item) => (item.name === name ? { ...item, on } : item));
}

/**
 * The layer menu of a map, out of sight: its entries follow the choices of
 * « Mes cartes », and what the map offers is written there for the page.
 * Wrap the control before any layer is added to it.
 * @param map - The map.
 * @param control - Its layer menu.
 */
export function followLayerPrefs(
  map: LeafletMap,
  control: Control.Layers,
): void {
  const named = new Map<string, { layer: Layer; kind: 'base' | 'overlay' }>();
  let applying = false;
  // Written a moment later, and only while the map is shown: a map being
  // closed takes its layers off one by one, which is no choice.
  let pending: ReturnType<typeof setTimeout> | undefined;
  const record = () => {
    clearTimeout(pending);
    pending = setTimeout(write, 0);
  };
  const write = () => {
    if (!isMapLive(map) || !map.getContainer().isConnected) return;
    const names = [...named].map(([name, { layer, kind }]) => ({
      name,
      kind,
      on: map.hasLayer(layer),
    }));
    mapLayerNames.value = names;
    store.set(NAMES_KEY, names);
  };
  const apply = (name: string) => {
    // A layer is only added to a map that has its view.
    map.whenReady(() => applyNow(name));
  };
  const applyNow = (name: string) => {
    const entry = named.get(name);
    if (!entry || !isMapLive(map)) return;
    const prefs = layerPrefs.peek();
    applying = true;
    try {
      if (entry.kind === 'base' && prefs.base === name) {
        if (!map.hasLayer(entry.layer)) {
          // The new background first: the map never stays without one.
          map.addLayer(entry.layer);
          for (const other of named.values()) {
            if (other.kind === 'base' && other !== entry) {
              map.removeLayer(other.layer);
            }
          }
        }
      } else if (entry.kind === 'overlay' && name in prefs.on) {
        if (prefs.on[name] && !map.hasLayer(entry.layer)) {
          map.addLayer(entry.layer);
        }
        if (!prefs.on[name] && map.hasLayer(entry.layer)) {
          map.removeLayer(entry.layer);
        }
      }
    } finally {
      applying = false;
    }
  };
  const addBase = control.addBaseLayer.bind(control);
  const addOverlay = control.addOverlay.bind(control);
  const remove = control.removeLayer.bind(control);
  control.addBaseLayer = (layer, name) => {
    addBase(layer, name);
    named.set(name, { layer, kind: 'base' });
    apply(name);
    record();
    return control;
  };
  control.addOverlay = (layer, name) => {
    addOverlay(layer, name);
    named.set(name, { layer, kind: 'overlay' });
    apply(name);
    record();
    return control;
  };
  control.removeLayer = (layer) => {
    remove(layer);
    for (const [name, entry] of named) {
      if (entry.layer === layer) named.delete(name);
    }
    record();
    return control;
  };
  // A layer changed on the map itself (a background giving way out of its
  // area) is written down, not taken as the sailor's choice.
  map.on('layeradd layerremove', () => {
    if (!applying) record();
  });
  // Read here so that a choice made in « Mes cartes » reaches a live map.
  const stop = effect(() => {
    if (!layerPrefs.value.on || !isMapLive(map)) return;
    for (const name of named.keys()) apply(name);
    record();
  });
  map.on('unload', stop);
}
