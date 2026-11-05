import { TILE_CACHE } from '../../serviceWorker/cacheNames.ts';

/** Result of the offline check of the settings page. */
export type OfflineStatus =
  | { kind: 'ready'; persisted: boolean; tiles: number }
  | { kind: 'not-ready' }
  | { kind: 'unknown' };

/**
 * Is the app entirely on this device? (legacy `offlineState`): a controlling
 * service worker and the start page in the cache.
 * @returns The state to show, `unknown` when the browser cannot tell.
 */
export async function offlineState(): Promise<OfflineStatus> {
  try {
    const { caches } = globalThis;
    const ready =
      'serviceWorker' in navigator &&
      Boolean(navigator.serviceWorker.controller) &&
      Boolean(await caches.match('index.html'));
    const persisted = (await navigator.storage?.persisted?.()) ?? false;
    const tiles = await seenTiles(caches);
    return ready ? { kind: 'ready', persisted, tiles } : { kind: 'not-ready' };
  } catch {
    return { kind: 'unknown' };
  }
}

async function seenTiles(caches: CacheStorage): Promise<number> {
  const names = await caches.keys();
  if (!names.includes(TILE_CACHE)) return 0;
  const tiles = await caches.open(TILE_CACHE);
  const requests = await tiles.keys();
  return requests.length;
}
