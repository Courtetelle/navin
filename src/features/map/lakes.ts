import { signal } from '@preact/signals-react';

import { toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import type { GeoBox } from './constants.ts';
import { LEMAN_BBOX, SEAMARK_TILES, SWISS_TILES } from './constants.ts';
import { VD_WMS, vdIsobathLayers } from './vdIsobath.ts';
import type { DownloadResult, TileJob } from './zoneDownload.ts';
import { ZONE_CACHE, fetchTiles } from './zoneDownload.ts';
import { zoneTileXY, zoneUrl } from './zoneStore.ts';

/** A lake whose maps are always kept in the app. */
export interface BaseLake {
  id: string;
  name: string;
  b: GeoBox;
}

interface LakeState {
  at: string;
  ok: number;
  n: number;
  done: boolean;
}

type LakesBase = Record<string, LakeState | undefined> & { toldDone?: boolean };

/** Highest zoom kept. */
const LEMAN_ZMAX = 14;
/** Waters of the Vaud WMS images: possibly the whole lake. */
const VD_WATERS: GeoBox = { s: 46.18, n: 46.53, w: 6.1, e: 6.95 };
const WEB_MERCATOR_EDGE = 20_037_508.342_789_244;

/** Lakes downloaded by themselves as soon as there is network. */
export const BASE_LAKES: readonly BaseLake[] = [
  { id: 'leman', name: 'Léman', b: LEMAN_BBOX },
  {
    id: 'neuch',
    name: 'lac de Neuchâtel',
    b: { s: 46.74, n: 47.03, w: 6.6, e: 7.12 },
  },
];

/** Increases when `lakesNote` changed at the end of a download. */
export const lakesNoteVersion = signal(0);

const download = { busy: false };

/**
 * Tiles of a lake: Swiss map from zoom 8, buoyage from zoom 9 (legacy `lakeTileUrls`).
 * @param lake - The lake.
 * @returns The jobs.
 */
export function lakeTileUrls(lake: BaseLake): TileJob[] {
  const jobs: TileJob[] = [];
  for (const tile of zoneTileXY(lake.b, LEMAN_ZMAX)) {
    if (tile[0] < 8) continue;
    jobs.push({ url: zoneUrl(SWISS_TILES, tile), mode: 'cors' });
    if (tile[0] >= 9) {
      jobs.push({ url: zoneUrl(SEAMARK_TILES, tile), mode: 'no-cors' });
    }
  }
  return jobs;
}

/**
 * Cache key of a WMS image, the same as in the service worker: sorted
 * parameters, box rounded to the metre (legacy `wmsKey`).
 * @param address - Image address.
 * @returns The key.
 */
export function wmsKey(address: string): string {
  const url = new URL(address);
  const parameters = [...url.searchParams].map(
    ([name, value]): [string, string] => {
      const key = name.toLowerCase();
      if (key !== 'bbox') return [key, value];
      const rounded = value.split(',').map((part) => Math.round(Number(part)));
      return [key, rounded.join(',')];
    },
  );
  const sorted = parameters.toSorted((first, second) =>
    first[0] < second[0] ? -1 : 1,
  );
  const query = sorted
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&');
  return `${url.origin}${url.pathname}?${query}`;
}

/**
 * Addresses of the Vaud depth images, zoom 10 to 15 (legacy `vdWmsTiles`).
 * @param layers - WMS layer names.
 * @returns The image addresses.
 */
export function vdWmsTiles(layers: string): string[] {
  const addresses: string[] = [];
  const edge = WEB_MERCATOR_EDGE;
  for (let zoom = 10; zoom <= 15; zoom++) {
    const size = (2 * edge) / 2 ** zoom;
    const xEnd = wmsTileX(VD_WATERS.e, zoom);
    const yEnd = wmsTileY(VD_WATERS.s, zoom);
    for (let x = wmsTileX(VD_WATERS.w, zoom); x <= xEnd; x++) {
      for (let y = wmsTileY(VD_WATERS.n, zoom); y <= yEnd; y++) {
        const left = -edge + x * size;
        const top = edge - y * size;
        addresses.push(
          `${VD_WMS}?service=WMS&request=GetMap&layers=${encodeURIComponent(layers)}&styles=&format=image%2Fpng&transparent=true&version=1.3.0&width=256&height=256&crs=EPSG%3A3857&bbox=${left},${top - size},${left + size},${top}`,
        );
      }
    }
  }
  return addresses;
}

/**
 * State of the built-in lake maps (legacy `lakesNote`).
 * @returns One clause per lake.
 */
export function lakesNote(): string {
  const stored = store.get<LakesBase>('ldb.lakesBase', {});
  const pending = download.busy ? 'en cours…' : 'au prochain réseau';
  return BASE_LAKES.map((lake) =>
    stored[lake.id]?.done
      ? `${lake.name} : intégrée`
      : `${lake.name} : ${pending}`,
  ).join(' · ');
}

/**
 * Download the built-in lake maps as soon as there is network, resuming an
 * interrupted download (legacy `autoLakes`).
 */
export async function autoLakes(): Promise<void> {
  if (download.busy || !navigator.onLine || !('caches' in globalThis)) return;
  const { connection } = navigator as Navigator & {
    connection?: { saveData?: boolean };
  };
  if (connection?.saveData) return;
  const stored = store.get<LakesBase>('ldb.lakesBase', {});
  const todo = BASE_LAKES.filter((lake) => !stored[lake.id]?.done);
  const depthLayers = stored.vd2?.done
    ? []
    : await vdIsobathLayers().catch(() => []);
  if (todo.length === 0 && depthLayers.length === 0) return;
  download.busy = true;
  const cache = await globalThis.caches.open(ZONE_CACHE);
  /* eslint-disable no-await-in-loop -- one lake at a time: the network is shared */
  for (const lake of todo) {
    const result = await fetchTiles(cache, lakeTileUrls(lake), 3);
    noteResult(lake.id, result);
  }
  /* eslint-enable no-await-in-loop */
  if (depthLayers.length > 0) {
    const names = depthLayers.map((layer) => layer.name).join(',');
    const jobs = vdWmsTiles(names).map((url): TileJob => ({
      url,
      mode: 'no-cors',
      key: wmsKey(url),
    }));
    noteResult('vd2', await fetchTiles(cache, jobs, 3));
  }
  download.busy = false;
  const finished = store.get<LakesBase>('ldb.lakesBase', {});
  const allDone = BASE_LAKES.every((lake) => finished[lake.id]?.done);
  if (allDone && !finished.toldDone) {
    finished.toldDone = true;
    store.set('ldb.lakesBase', finished);
    toast(
      'Cartes du Léman et du lac de Neuchâtel intégrées : elles marchent sans réseau',
    );
  }
  lakesNoteVersion.value += 1;
}

function noteResult(id: string, { ok, ko, n }: DownloadResult): void {
  const stored = store.get<LakesBase>('ldb.lakesBase', {});
  stored[id] = { at: new Date().toISOString(), ok, n, done: ko <= n * 0.02 };
  store.set('ldb.lakesBase', stored);
}

function wmsTileX(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * 2 ** zoom);
}

function wmsTileY(lat: number, zoom: number): number {
  const radians = (lat * Math.PI) / 180;
  const mercator = Math.log(Math.tan(radians) + 1 / Math.cos(radians));
  return Math.floor(((1 - mercator / Math.PI) / 2) * 2 ** zoom);
}
