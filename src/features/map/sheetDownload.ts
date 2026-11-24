import { signal } from '@preact/signals-react';

import type { MapSheet } from './mapSheets.ts';
import { sheetTiles, sheetTitle } from './mapSheets.ts';
import { OfflineMapFailure, failureText } from './offlineMapFailure.ts';
import type { OfflineMap } from './offlineMapStore.ts';
import { importOfflineMap } from './offlineMapStore.ts';
import type { TileToWrite } from './pmtilesWrite.ts';
import { writePmtiles } from './pmtilesWrite.ts';

/**
 * The vector tiles of OpenFreeMap: free, without key or account, the
 * OpenMapTiles layers that the map files of NavIn draw. Its address gives
 * the address of the tiles of the day.
 */
export const TILE_SOURCE = 'https://tiles.openfreemap.org/planet';
const ATTRIBUTION = '© OpenFreeMap © OpenMapTiles © OpenStreetMap';
const WORKERS = 6;
/** Tiles that may fail, in part of all, before the map is given up. */
const FAILURES_ALLOWED = 0.01;

/** The download going on, or the last one that failed. */
export interface SheetJob {
  sheet: MapSheet;
  done: number;
  total: number;
  /** Set when it failed. */
  error?: string;
}

/** The download of a sheet, one at a time, followed by the plan. */
export const sheetJob = signal<SheetJob | null>(null);

let stopping: AbortController | null = null;

/**
 * The address of the tiles, read from the source.
 * @param fetcher - Fetch.
 * @param signal - Stops it.
 * @returns The address, with `{z}`, `{x}`, `{y}`.
 */
export async function tileTemplate(
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetcher(TILE_SOURCE, { signal });
  if (!response.ok) throw new Error(`source ${response.status}`);
  const json = (await response.json()) as { tiles?: unknown };
  const first = Array.isArray(json.tiles) ? json.tiles[0] : null;
  if (typeof first !== 'string' || !first.includes('{z}')) {
    throw new Error('source without tiles');
  }
  return first;
}

/**
 * Unpack a tile still in gzip, as some servers send them.
 * @param data - The bytes received.
 * @returns The vector tile.
 */
export async function unpacked(
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  if (data.length < 2 || data[0] !== 0x1f || data[1] !== 0x8b) return data;
  const stream = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Fetch the tiles of a sheet and put them in one map file.
 * @param sheet - The sheet.
 * @param options - Fetch, progress, stop.
 * @param options.fetcher - Fetch.
 * @param options.onDone - Told after each tile.
 * @param options.signal - Stops the download.
 * @returns The file, named after the sheet.
 */
export async function sheetFile(
  sheet: MapSheet,
  {
    fetcher = fetch,
    onDone = () => undefined,
    signal,
  }: {
    fetcher?: typeof fetch;
    onDone?: (done: number, total: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<File> {
  const template = await tileTemplate(fetcher, signal);
  const places = sheetTiles(sheet);
  const tiles: TileToWrite[] = [];
  let next = 0;
  let done = 0;
  let failed = 0;
  const fetchOne = async (
    url: string,
  ): Promise<Uint8Array<ArrayBuffer> | null> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      signal?.throwIfAborted();
      try {
        // eslint-disable-next-line no-await-in-loop -- one try after the other
        const response = await fetcher(url, { signal });
        if (response.status === 204 || response.status === 404) {
          return new Uint8Array();
        }
        if (response.ok) {
          // eslint-disable-next-line no-await-in-loop -- one try after the other
          return await unpacked(new Uint8Array(await response.arrayBuffer()));
        }
      } catch (error) {
        if (signal?.aborted) throw error;
      }
    }
    return null;
  };
  const worker = async () => {
    /* eslint-disable no-await-in-loop -- a worker takes one tile at a time */
    while (next < places.length) {
      const place = places[next++] as { z: number; x: number; y: number };
      const url = template
        .replace('{z}', String(place.z))
        .replace('{x}', String(place.x))
        .replace('{y}', String(place.y));
      const data = await fetchOne(url);
      if (data === null) {
        failed++;
        if (failed > Math.max(2, places.length * FAILURES_ALLOWED)) {
          throw new Error('too many tiles missing');
        }
      } else if (data.length > 0) {
        tiles.push({ ...place, data });
      }
      done++;
      onDone(done, places.length);
    }
    /* eslint-enable no-await-in-loop */
  };
  await Promise.all(Array.from({ length: WORKERS }, worker));
  if (tiles.length === 0) throw new Error('no tile');
  const blob = writePmtiles(tiles, {
    south: sheet.box.s,
    west: sheet.box.w,
    north: sheet.box.n,
    east: sheet.box.e,
    minZoom: sheet.minZoom,
    maxZoom: sheet.maxZoom,
    name: sheetTitle(sheet),
    attribution: ATTRIBUTION,
  });
  return new File([blob], sheet.id, { type: 'application/octet-stream' });
}

/**
 * What went wrong, for the sailor.
 * @param error - The failure.
 * @returns A sentence.
 */
export function sheetFailureText(error: unknown): string {
  if (error instanceof OfflineMapFailure) return failureText(error);
  const text = error instanceof Error ? error.message : String(error);
  if (!navigator.onLine) return 'Pas de réseau : réessayez une fois connecté.';
  if (text.startsWith('source') || text.includes('fetch')) {
    return 'Le serveur des cartes (OpenFreeMap) ne répond pas : réessayez plus tard.';
  }
  if (text.includes('tiles missing') || text === 'no tile') {
    return 'Trop de morceaux de la carte manquent : réessayez, le réseau est peut-être faible.';
  }
  return text;
}

/**
 * Download a sheet onto this device, one sheet at a time; the plan follows
 * it in {@link sheetJob}.
 * @param sheet - The sheet.
 * @param keep - Keeps the file (the import of « Fonds de cartes »).
 * @returns The map kept, or `null` when stopped or failed.
 */
export async function downloadSheet(
  sheet: MapSheet,
  keep: (file: File) => Promise<OfflineMap> = (file) => importOfflineMap(file),
): Promise<OfflineMap | null> {
  if (stopping) return null;
  const controller = new AbortController();
  stopping = controller;
  sheetJob.value = { sheet, done: 0, total: sheetTiles(sheet).length };
  try {
    const file = await sheetFile(sheet, {
      signal: controller.signal,
      onDone: (done, total) => {
        sheetJob.value = { sheet, done, total };
      },
    });
    const kept = await keep(file);
    sheetJob.value = null;
    return kept;
  } catch (error) {
    sheetJob.value = controller.signal.aborted
      ? null
      : {
          ...(sheetJob.peek() ?? { sheet, done: 0, total: 0 }),
          error: sheetFailureText(error),
        };
    return null;
  } finally {
    if (stopping === controller) stopping = null;
  }
}

/** Stop the download going on. */
export function stopSheetDownload(): void {
  stopping?.abort();
}
