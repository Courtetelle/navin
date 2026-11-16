import { useSignals } from '@preact/signals-react/runtime';
import type { Coords, DoneCallback, TileLayer } from 'leaflet';
import { useEffect } from 'react';

import { leaflet } from '../../features/map/leaflet.ts';
import { tracker } from '../../features/map/trackerState.ts';
import type { LightningSettings } from '../../features/onwater/lightning.ts';
import {
  LIGHTNING_LAYER,
  LIGHTNING_WMS,
  lightningClearNoData,
  lightningOnMap,
  lightningTimes,
} from '../../features/onwater/lightning.ts';
import { state } from '../../state/index.ts';

/** The flashes are read again this often: a new image every 5 minutes. */
const REFRESH_MS = 5 * 60_000;
/** One image every 5 minutes. */
const STEP_MS = 5 * 60_000;
/** The map of NavIn is looked for this often until it is built. */
const WAIT_MS = 500;
/**
 * The images shown, as in Blitzortung: the newest bright, those of 10 and
 * 20 minutes before fainter, so a storm shows where it goes.
 */
const TRAIL = [
  { back: 4, opacity: 0.3 },
  { back: 2, opacity: 0.55 },
  { back: 0, opacity: 0.95 },
] as const;

function stamp(time: number): string {
  return new Date(time).toISOString().replace('.000Z', 'Z');
}

/**
 * An image of the flashes with the black of no data made clear: the server
 * lays black bands where the satellite stops seeing (the far north).
 * @param source - The image read.
 * @returns The image cleaned, as a data URL.
 */
function cleaned(source: HTMLImageElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth;
  canvas.height = source.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) return source.src;
  context.drawImage(source, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  if (lightningClearNoData(image.data) === 0) return source.src;
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * The WMS layer whose tiles come cleaned of the black of no data.
 * @returns Its class.
 */
function cleanWms() {
  const L = leaflet();
  return class CleanWms extends L.TileLayer.WMS {
    override createTile(coords: Coords, done: DoneCallback): HTMLElement {
      const tile = document.createElement('img');
      tile.alt = '';
      tile.setAttribute('role', 'presentation');
      const source = new Image();
      source.crossOrigin = 'anonymous';
      tile.addEventListener('load', () => done(undefined, tile));
      tile.addEventListener('error', () => done(new Error('tile'), tile));
      source.addEventListener('load', () => {
        try {
          tile.src = cleaned(source);
        } catch {
          tile.src = source.src;
        }
      });
      source.addEventListener('error', () => done(new Error('tile'), tile));
      source.src = this.getTileUrl(coords);
      return tile;
    }
  };
}

/**
 * The lightning seen by the satellite MTG on the NavIn map, always, with
 * nothing to ask: nothing shows where there is none. The last 20 minutes,
 * the newest brightest; yellow 1 flash in 5 minutes, dark red 20 and more.
 * @returns Nothing: it draws on the map.
 */
export function LightningOnMap() {
  useSignals();
  const on = lightningOnMap(
    state.preferences.settings.value.lightning as LightningSettings | undefined,
  );
  useEffect(() => {
    if (!on) return undefined;
    let closed = false;
    let wait: ReturnType<typeof setTimeout> | undefined;
    const layers: TileLayer.WMS[] = [];
    const times = () => {
      const now = Date.now();
      const newest = lightningTimes(now)[0] ?? now;
      return TRAIL.map(({ back }) => stamp(newest - back * STEP_MS));
    };
    const start = () => {
      if (closed) return;
      const map = tracker.current?.map;
      if (!map) {
        wait = setTimeout(start, WAIT_MS);
        return;
      }
      const Wms = cleanWms();
      const shown = times();
      for (const [index, { opacity }] of TRAIL.entries()) {
        layers.push(
          new Wms(LIGHTNING_WMS, {
            layers: LIGHTNING_LAYER,
            format: 'image/png',
            transparent: true,
            opacity,
            className: 'map-flashes',
            attribution: 'Éclairs : EUMETSAT MTG',
            time: shown[index],
          } as never).addTo(map),
        );
      }
    };
    start();
    const timer = setInterval(() => {
      const shown = times();
      for (const [index, layer] of layers.entries()) {
        layer.setParams({ time: shown[index] } as never);
      }
    }, REFRESH_MS);
    return () => {
      closed = true;
      clearTimeout(wait);
      clearInterval(timer);
      for (const layer of layers) layer.remove();
    };
  }, [on]);
  return null;
}
