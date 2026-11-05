/// <reference lib="webworker" />
/* Service worker: everything works offline once the app was opened (legacy sw.js). */
import { APP_CACHE, TILE_CACHE, ZONE_CACHE } from './cacheNames.ts';
import { tileKey } from './tileKey.ts';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const MAX_TILES = 10_000;
const TILE_HOSTS =
  /tile\.openstreetmap\.org|tiles\.openseamap\.org|basemaps\.cartocdn\.com|wmts\.geo\.admin\.ch|ogc\.vd\.ch/;

// The build's file list replaces legacy's hand-written one; './' is the start URL.
const FILES = ['./', ...self.__WB_MANIFEST.map((entry) => entry.url)];
let puts = 0;

self.addEventListener('install', (event) => {
  event.waitUntil(
    self.caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== APP_CACHE && key !== TILE_CACHE && key !== ZONE_CACHE,
            )
            .map((key) => self.caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (TILE_HOSTS.test(url.hostname)) {
    event.respondWith(tileResponse(request, url));
    return;
  }
  // Weather and other services: network only, the app copes without them.
  if (url.origin !== self.location.origin) return;
  event.respondWith(appFileResponse(request));
});

/** Tiles: downloaded areas first, then tiles already seen, then the network (kept). */
async function tileResponse(request: Request, url: URL): Promise<Response> {
  const key = tileKey(url, request);
  const zones = await self.caches.open(ZONE_CACHE);
  const zoneHit = await zones.match(key, { ignoreVary: true });
  if (zoneHit) return zoneHit;
  const tiles = await self.caches.open(TILE_CACHE);
  const hit = await tiles.match(key);
  if (hit) return hit;
  const response = await fetch(request);
  // Vaud WMS images come without CORS (opaque response): kept anyway.
  if (
    response.ok ||
    (response.type === 'opaque' && url.hostname.includes('ogc.vd.ch'))
  ) {
    void tiles.put(key, response.clone());
    void trimTiles();
  }
  return response;
}

/** Keep at most 10 000 tiles; the cleanup runs every 100 new tiles. */
async function trimTiles(): Promise<void> {
  puts += 1;
  if (puts % 100) return;
  const cache = await self.caches.open(TILE_CACHE);
  const keys = await cache.keys();
  const extra = keys.slice(0, Math.max(0, keys.length - MAX_TILES));
  await Promise.all(extra.map((key) => cache.delete(key)));
}

/** App files: network first (updates in port), else the phone; 4 s at most at sea. */
async function appFileResponse(request: Request): Promise<Response> {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('timeout')), 4000);
      }),
    ]);
    if (response.ok) {
      const copy = response.clone();
      void self.caches
        .open(APP_CACHE)
        .then((cache) => cache.put(request, copy));
    }
    return response;
  } catch {
    const cached = await self.caches.match(request, { ignoreSearch: true });
    return (
      cached ?? (await self.caches.match('index.html')) ?? Response.error()
    );
  }
}
