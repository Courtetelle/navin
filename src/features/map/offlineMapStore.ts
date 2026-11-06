import type { Source } from 'pmtiles';
import { PMTiles, TileType } from 'pmtiles';

/** A map file kept on this device. */
export interface OfflineMap {
  id: string;
  name: string;
  /** Size in bytes. */
  size: number;
  /** When it was imported (ms). */
  at: number;
  south: number;
  west: number;
  north: number;
  east: number;
  maxZoom: number;
}

interface Chunk {
  map: string;
  index: number;
  data: ArrayBuffer;
}

const DB_NAME = 'ldb-maps';
const MAPS = 'maps';
const CHUNKS = 'chunks';
const CHUNK_BYTES = 1_000_000;
/** Pieces kept in memory while the map draws. */
const CACHED_CHUNKS = 16;

let database: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.addEventListener('upgradeneeded', () => {
      request.result.createObjectStore(MAPS, { keyPath: 'id' });
      request.result.createObjectStore(CHUNKS, {
        keyPath: ['map', 'index'],
      });
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB unavailable')),
    );
  });
  return database;
}

async function run<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (opened: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const opened = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = opened.transaction(store, mode);
    const request = action(transaction.objectStore(store));
    transaction.addEventListener('complete', () => resolve(request.result));
    transaction.addEventListener('error', () =>
      reject(transaction.error ?? new Error('IndexedDB error')),
    );
    transaction.addEventListener('abort', () =>
      reject(transaction.error ?? new Error('IndexedDB aborted')),
    );
  });
}

/**
 * The pieces that hold a range of a file.
 * @param offset - First byte.
 * @param length - Number of bytes.
 * @param chunkBytes - Size of a piece.
 * @returns The numbers of the pieces.
 */
export function chunksFor(
  offset: number,
  length: number,
  chunkBytes = CHUNK_BYTES,
): number[] {
  if (length <= 0) return [];
  const first = Math.floor(offset / chunkBytes);
  const last = Math.floor((offset + length - 1) / chunkBytes);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

/**
 * Read a chosen file for a check, before it is copied.
 * @param name - Name of the file.
 * @param file - The file.
 * @returns The source of a reader.
 */
function fileSource(name: string, file: Blob): Source {
  return {
    getKey: () => name,
    getBytes: async (offset, length) => ({
      data: await file.slice(offset, offset + length).arrayBuffer(),
    }),
  };
}

/**
 * Read a kept map piece by piece: the file never has to fit in memory.
 * @param map - The map.
 * @returns The source of a reader.
 */
export function offlineMapSource(map: Pick<OfflineMap, 'id' | 'size'>): Source {
  const cache = new Map<number, Promise<ArrayBuffer>>();
  const chunk = (index: number): Promise<ArrayBuffer> => {
    const known = cache.get(index);
    if (known) {
      cache.delete(index);
      cache.set(index, known);
      return known;
    }
    const loading = run<Chunk | undefined>(CHUNKS, 'readonly', (store) =>
      store.get([map.id, index]),
    ).then((found) => {
      if (!found) throw new Error('missing part of the map');
      return found.data;
    });
    cache.set(index, loading);
    loading.catch(() => cache.delete(index));
    for (const old of cache.keys()) {
      if (cache.size <= CACHED_CHUNKS) break;
      cache.delete(old);
    }
    return loading;
  };
  return {
    getKey: () => map.id,
    getBytes: async (offset, length) => {
      const end = Math.min(offset + length, map.size);
      const indexes = chunksFor(offset, end - offset);
      const parts = await Promise.all(indexes.map(chunk));
      const data = new Uint8Array(Math.max(0, end - offset));
      for (const [position, part] of parts.entries()) {
        const start = (indexes[position] as number) * CHUNK_BYTES;
        const from = Math.max(offset, start);
        const to = Math.min(end, start + part.byteLength);
        data.set(new Uint8Array(part, from - start, to - from), from - offset);
      }
      return { data: data.buffer };
    },
  };
}

/**
 * The name shown for a map file.
 * @param fileName - Name of the file.
 * @returns It without its extension and separators.
 */
export function offlineMapName(fileName: string): string {
  const name = fileName
    .replace(/\.pmtiles$/iu, '')
    .replaceAll(/[-_]+/gu, ' ')
    .trim();
  return name ? `${name[0]?.toUpperCase()}${name.slice(1)}` : 'Carte';
}

/**
 * Copy a map file onto this device: a browser keeping the chosen file itself
 * only keeps a link, and the file may go when kDrive or Drive clean up. A file
 * of the same name is replaced.
 * @param file - The file chosen.
 * @param onProgress - Told the part copied, from 0 to 1.
 * @returns The map kept.
 * @throws When the file is not a vector map, or the device has no room.
 */
export async function importOfflineMap(
  file: File,
  onProgress: (part: number) => void = () => undefined,
): Promise<OfflineMap> {
  const reader = new PMTiles(fileSource(file.name, file));
  const header = await reader.getHeader();
  if (header.tileType !== TileType.Mvt) throw new Error('not a vector map');
  const map: OfflineMap = {
    id: file.name,
    name: offlineMapName(file.name),
    size: file.size,
    at: Date.now(),
    south: header.minLat,
    west: header.minLon,
    north: header.maxLat,
    east: header.maxLon,
    maxZoom: header.maxZoom,
  };
  // Without this the browser may free the space when the phone runs short.
  await navigator.storage?.persist?.();
  await deleteOfflineMap(map.id);
  try {
    /* eslint-disable no-await-in-loop -- one piece at a time, to spare memory */
    for (let offset = 0; offset < file.size; offset += CHUNK_BYTES) {
      const data = await file.slice(offset, offset + CHUNK_BYTES).arrayBuffer();
      const chunk: Chunk = {
        map: map.id,
        index: offset / CHUNK_BYTES,
        data,
      };
      await run(CHUNKS, 'readwrite', (store) => store.put(chunk));
      onProgress(Math.min(1, (offset + CHUNK_BYTES) / file.size));
    }
    /* eslint-enable no-await-in-loop */
    await run(MAPS, 'readwrite', (store) => store.put(map));
  } catch (error) {
    await deleteOfflineMap(map.id).catch(() => undefined);
    throw error;
  }
  return map;
}

/**
 * The maps kept on this device.
 * @returns The maps, by name.
 */
export async function offlineMaps(): Promise<OfflineMap[]> {
  const maps = await run<OfflineMap[]>(MAPS, 'readonly', (store) =>
    store.getAll(),
  );
  return maps.toSorted((first, second) =>
    first.name.localeCompare(second.name),
  );
}

/**
 * Remove a map from this device.
 * @param id - Its id.
 */
export async function deleteOfflineMap(id: string): Promise<void> {
  await run(MAPS, 'readwrite', (store) => store.delete(id));
  await run(CHUNKS, 'readwrite', (store) =>
    store.delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER])),
  );
}
