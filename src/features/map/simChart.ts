import type {
  Control,
  Coords,
  GridLayer,
  LayersControlEvent,
  Map as LeafletMap,
} from 'leaflet';

import { state } from '../../state/index.ts';

import { leaflet } from './leaflet.ts';
import { extrasOf, isMapLive, whileMapLive } from './mapExtras.ts';
import { drawSimTile } from './simTile.ts';

const SIMULATED_NAME = 'Carte maritime simulée';
const SIMULATED_NOTE = 'Carte maritime simulée (aperçu)';

/**
 * Whether the zone simulation is at sea (legacy `simSeaMode`).
 * @returns `true` on a simulated sea.
 */
export function simSeaMode(): boolean {
  return state.view.zoneSimV.value === 'mer';
}

/**
 * Add the simulated chart to the layer selector, and use it when the real
 * background gives no tile (legacy `simChartWire`).
 * @param map - Leaflet map.
 * @param layersControl - Its layer selector.
 * @param bases - Real background layers.
 * @returns The simulated layer.
 */
export function simChartWire(
  map: LeafletMap,
  layersControl: Control.Layers,
  bases: readonly GridLayer[],
): GridLayer {
  const simulated = simChartLayer(map);
  layersControl.addBaseLayer(simulated, SIMULATED_NAME);
  const hide = () => {
    const extras = extrasOf(map);
    extras.simRose?.remove();
    extras.simRose = null;
    extras.simNote?.remove();
    extras.simNote = null;
  };
  map.on('baselayerchange', (event: LayersControlEvent) => {
    if (event.name !== SIMULATED_NAME) hide();
  });
  let loaded = 0;
  let errors = 0;
  let done = false;
  const swap = () => {
    if (done || loaded) return;
    done = true;
    for (const base of bases) {
      if (map.hasLayer(base)) map.removeLayer(base);
    }
    simulated.addTo(map);
  };
  const onLoad = () => {
    loaded++;
  };
  const onError = () => {
    errors++;
    if (errors >= 4) swap();
  };
  for (const base of bases) {
    base.on('tileload', onLoad);
    base.on('tileerror', onError);
  }
  // Tiles blocked without any error: swap all the same.
  whileMapLive(map, swap, 4000);
  return simulated;
}

function simChartLayer(map: LeafletMap): GridLayer {
  const L = leaflet();
  class SimulatedChart extends L.GridLayer {
    override createTile(coords: Coords): HTMLElement {
      return drawSimTile(map, coords);
    }
  }
  const layer = new SimulatedChart({
    maxZoom: 19,
    className: 'sim-tiles',
    attribution: 'Carte simulée (aperçu, pas pour naviguer)',
  });
  // Day / night: the tiles are drawn again with the right palette.
  const observer = new MutationObserver(() => {
    if (map.hasLayer(layer) && isMapLive(map)) layer.redraw();
    else observer.disconnect();
  });
  layer.on('add', () => {
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    addRose(map);
  });
  layer.on('remove', () => observer.disconnect());
  return layer;
}

function roseTicks(): string {
  let ticks = '';
  for (let index = 0; index < 36; index++) {
    const angle = (index * 10 * Math.PI) / 180;
    const inner = index % 9 ? 40 : 36;
    ticks += `<line x1="${Math.sin(angle) * inner}" y1="${-Math.cos(angle) * inner}" x2="${Math.sin(angle) * 44}" y2="${-Math.cos(angle) * 44}" stroke="#7a5c8a" stroke-width=".7"/>`;
  }
  return ticks;
}

function addRose(map: LeafletMap): void {
  const extras = extrasOf(map);
  if (extras.simRose) return;
  const rose = document.createElement('div');
  rose.className = 'sim-rose no-print';
  rose.innerHTML = `<svg viewBox="-50 -50 100 100" width="84" height="84"><circle r="44" fill="rgba(255,255,255,.55)" stroke="#7a5c8a" stroke-width="1.2"/><circle r="36" fill="none" stroke="#7a5c8a" stroke-width=".6"/>${roseTicks()}<path d="M0-34 6-6 34 0 6 6 0 34-6 6-34 0-6-6Z" fill="#7a5c8a" opacity=".85"/><path d="M0-34 6-6 0 0Z M34 0 6 6 0 0Z M0 34-6 6 0 0Z M-34 0-6-6 0 0Z" fill="#fff"/><text y="-46" text-anchor="middle" font-size="10" font-weight="700" fill="#7a5c8a" dy="-1">N</text></svg>`;
  map.getContainer().append(rose);
  extras.simRose = rose;
  const note = document.createElement('div');
  note.className = 'sim-note no-print';
  note.textContent = SIMULATED_NOTE;
  map.getContainer().append(note);
  extras.simNote = note;
}
