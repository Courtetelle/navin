import { store } from '../../storage/store.ts';

/**
 * One measurement kept: time, mean wind and gusts in knots, direction in
 * degrees, air in °C, sea-level pressure in hPa.
 */
export type KeptReading = [
  t: number,
  avg: number,
  gust: number | null,
  dir?: number | null,
  air?: number | null,
  baro?: number | null,
];

/** Measurements of each station, by `network:id`. */
export type KeptStations = Record<string, KeptReading[]>;

const DATABASE = 'ldb-live';
const STORE = 's';
/** Where the measurements were kept before (localStorage, too small for 60 km). */
const OLD_KEY = 'ldb.live.seen';

let database: Promise<IDBDatabase | null> | null = null;
/** Without IndexedDB (tests, a blocked browser): kept in memory only. */
const memory = new Map<string, KeptReading[]>();

function open(): Promise<IDBDatabase | null> {
  database ??= new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DATABASE, 1);
      request.addEventListener('upgradeneeded', () =>
        request.result.createObjectStore(STORE),
      );
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
  return database;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB')),
    );
  });
}

/**
 * Every station kept, with its measurements. The ones of the former
 * localStorage key are moved in once.
 * @returns The stations.
 */
export async function readKept(): Promise<KeptStations> {
  const opened = await open();
  const old = store.get<KeptStations | null>(OLD_KEY, null);
  if (!opened) {
    if (old) {
      for (const [key, list] of Object.entries(old)) memory.set(key, list);
      store.del(OLD_KEY);
    }
    return Object.fromEntries(memory);
  }
  const objects = opened.transaction(STORE, 'readonly').objectStore(STORE);
  const [keys, values] = await Promise.all([
    done(objects.getAllKeys()),
    done(objects.getAll()),
  ]);
  const kept: KeptStations = {};
  for (const [index, key] of keys.entries()) {
    if (typeof key === 'string') kept[key] = values[index] as KeptReading[];
  }
  if (old) {
    for (const [key, list] of Object.entries(old)) kept[key] ??= list;
    await writeKept(kept, []);
    store.del(OLD_KEY);
  }
  return kept;
}

/**
 * The measurements of one station.
 * @param key - `network:id`.
 * @returns They, oldest first.
 */
export async function readStation(key: string): Promise<KeptReading[]> {
  const opened = await open();
  if (!opened) return memory.get(key) ?? [];
  try {
    const objects = opened.transaction(STORE, 'readonly').objectStore(STORE);
    const list = await done(objects.get(key));
    return Array.isArray(list) ? (list as KeptReading[]) : [];
  } catch {
    return [];
  }
}

/**
 * Write stations and forget others.
 * @param stations - Stations to write.
 * @param gone - Keys of the stations to forget.
 */
export async function writeKept(
  stations: KeptStations,
  gone: readonly string[],
): Promise<void> {
  const opened = await open();
  if (!opened) {
    for (const [key, list] of Object.entries(stations)) memory.set(key, list);
    for (const key of gone) memory.delete(key);
    return;
  }
  const transaction = opened.transaction(STORE, 'readwrite');
  const objects = transaction.objectStore(STORE);
  for (const [key, list] of Object.entries(stations)) objects.put(list, key);
  for (const key of gone) objects.delete(key);
  await new Promise<void>((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('error', () =>
      reject(transaction.error ?? new Error('IndexedDB')),
    );
  });
}

/** Forget everything kept (tests). */
export function resetKept(): void {
  memory.clear();
}
