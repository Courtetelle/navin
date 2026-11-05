import { afterEach, expect, test, vi } from 'vitest';

import { TILE_CACHE } from '../../../serviceWorker/cacheNames.ts';
import { offlineState } from '../offline.ts';

interface FakeCaches {
  /** The start page is cached. */
  page: boolean;
  /** Tiles kept. */
  tiles?: number;
}

function stubBrowser({ page, tiles }: FakeCaches, controller = {}): void {
  vi.stubGlobal('caches', {
    match: (url: string) => Promise.resolve(url === 'index.html' && page),
    keys: () => Promise.resolve(tiles === undefined ? [] : [TILE_CACHE]),
    open: () =>
      Promise.resolve({
        keys: () => Promise.resolve(Array.from({ length: tiles ?? 0 })),
      }),
  });
  vi.stubGlobal('navigator', {
    serviceWorker: { controller },
    storage: { persisted: () => Promise.resolve(true) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('ready with the start page in the cache', async () => {
  stubBrowser({ page: true, tiles: 12 });

  await expect(offlineState()).resolves.toStrictEqual({
    kind: 'ready',
    persisted: true,
    tiles: 12,
  });
});

test('no tile cache means no tile', async () => {
  stubBrowser({ page: true });

  await expect(offlineState()).resolves.toStrictEqual({
    kind: 'ready',
    persisted: true,
    tiles: 0,
  });
});

test('not ready before the page is cached', async () => {
  stubBrowser({ page: false });

  await expect(offlineState()).resolves.toStrictEqual({ kind: 'not-ready' });
});

test('not ready without a controlling service worker', async () => {
  vi.stubGlobal('caches', { keys: () => Promise.resolve([]) });
  vi.stubGlobal('navigator', { serviceWorker: { controller: null } });

  await expect(offlineState()).resolves.toStrictEqual({ kind: 'not-ready' });
});

test('unknown when the browser has no cache storage', async () => {
  vi.stubGlobal('caches', undefined);
  vi.stubGlobal('navigator', { serviceWorker: { controller: {} } });

  await expect(offlineState()).resolves.toStrictEqual({ kind: 'unknown' });
});
