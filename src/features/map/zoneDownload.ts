import { SEAMARK_TILES } from './constants.ts';
import { BASE_LAKES, lakeTileUrls } from './lakes.ts';
import type { Zone } from './zoneStore.ts';
import {
  ZONE_BASE,
  zoneList,
  zoneSave,
  zoneTileXY,
  zoneUrl,
} from './zoneStore.ts';

/** Cache of the zones, never emptied automatically. */
export const ZONE_CACHE = 'livre-de-bord-zones';

/** A download is running: only one at a time, zones and maps alike. */
export const zoneBusy = { current: false };

/** Result of a download. */
export interface DownloadResult {
  ok: number;
  ko: number;
  n: number;
}

/** Fetches the tiles of a list with several workers. */
export interface TileJob {
  url: string;
  /** `no-cors` allows a second try for sites without CORS. */
  mode: 'cors' | 'no-cors';
  /** Cache key, when different from the URL. */
  key?: string;
}

/**
 * Fetch tiles into the zone cache: tiles already there count as done, CORS
 * first because an opaque answer counts for several MB of the browser quota.
 * @param cache - Zone cache.
 * @param jobs - Tiles to fetch.
 * @param workers - Parallel requests.
 * @param onDone - Told after each tile.
 * @returns How many succeeded and failed.
 */
export async function fetchTiles(
  cache: Cache,
  jobs: readonly TileJob[],
  workers: number,
  onDone?: (done: number, total: number) => void,
): Promise<DownloadResult> {
  let next = 0;
  let ok = 0;
  let ko = 0;
  const worker = async () => {
    /* eslint-disable no-await-in-loop -- a worker takes one tile at a time */
    while (next < jobs.length) {
      const { url, mode, key } = jobs[next] as TileJob;
      next++;
      try {
        if (await cache.match(key ?? url, { ignoreVary: true })) {
          ok++;
          continue;
        }
        const response = await fetchTile(url, mode);
        if (response && (response.ok || response.type === 'opaque')) {
          await cache.put(key ?? url, response);
          ok++;
        } else {
          ko++;
        }
      } catch {
        ko++;
      }
      if ((ok + ko) % 20 === 0) onDone?.(ok + ko, jobs.length);
    }
    /* eslint-enable no-await-in-loop */
  };
  const running: Array<Promise<void>> = [];
  for (let index = 0; index < workers; index++) running.push(worker());
  await Promise.all(running);
  return { ok, ko, n: jobs.length };
}

/**
 * Download a zone: plan, and buoyage from zoom 9 (legacy `zoneDownload`).
 * @param zone - The zone.
 * @param onProgress - Told every 20 tiles and at the end.
 * @returns How many tiles succeeded and failed.
 */
export async function zoneDownload(
  zone: Pick<Zone, 'b' | 'zmax'>,
  onProgress: (done: number, total: number) => void,
): Promise<DownloadResult> {
  const jobs: TileJob[] = [];
  for (const tile of zoneTileXY(zone.b, zone.zmax)) {
    jobs.push({ url: zoneUrl(ZONE_BASE, tile), mode: 'cors' });
    if (tile[0] >= 9) {
      jobs.push({ url: zoneUrl(SEAMARK_TILES, tile), mode: 'no-cors' });
    }
  }
  const cache = await globalThis.caches.open(ZONE_CACHE);
  const result = await fetchTiles(cache, jobs, 4, onProgress);
  onProgress(jobs.length, jobs.length);
  return result;
}

/**
 * Delete a zone, keeping the tiles shared with the lakes and the other zones
 * (legacy `zoneDelete`).
 * @param id - Zone id.
 */
export async function zoneDelete(id: string): Promise<void> {
  const all = zoneList();
  const zone = all.find((item) => item.id === id);
  if (!zone) return;
  const rest = all.filter((item) => item.id !== id);
  const keep = new Set<string>();
  for (const lake of BASE_LAKES) {
    for (const { url } of lakeTileUrls(lake)) keep.add(url);
  }
  for (const other of rest) {
    for (const tile of zoneTileXY(other.b, other.zmax)) {
      keep.add(zoneUrl(ZONE_BASE, tile));
      keep.add(zoneUrl(SEAMARK_TILES, tile));
    }
  }
  const cache = await globalThis.caches.open(ZONE_CACHE);
  /* eslint-disable no-await-in-loop -- thousands of deletions, one at a time */
  for (const tile of zoneTileXY(zone.b, zone.zmax)) {
    for (const template of [ZONE_BASE, SEAMARK_TILES]) {
      const url = zoneUrl(template, tile);
      if (!keep.has(url)) await cache.delete(url);
    }
  }
  /* eslint-enable no-await-in-loop */
  zoneSave(rest);
}

async function fetchTile(
  url: string,
  mode: TileJob['mode'],
): Promise<Response | null> {
  try {
    return await fetch(url, { mode: 'cors' });
  } catch {
    return mode === 'no-cors' ? fetch(url, { mode: 'no-cors' }) : null;
  }
}
