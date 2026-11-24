import { PMTiles } from 'pmtiles';
import { expect, test } from 'vitest';

import { squareHasShore } from '../../onwater/shoreFar.ts';
import {
  planSheets,
  sheetArea,
  sheetAt,
  sheetEstimate,
  sheetTiles,
  sheetTitle,
  tileX,
  tileY,
} from '../mapSheets.ts';
import { writePmtiles } from '../pmtilesWrite.ts';
import { sheetFile, unpacked } from '../sheetDownload.ts';

function blobSource(name: string, blob: Blob) {
  return {
    getKey: () => name,
    getBytes: async (offset: number, length: number) => ({
      data: await blob.slice(offset, offset + length).arrayBuffer(),
    }),
  };
}

function must<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('missing');
  return value;
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

const info = {
  south: 48,
  west: -3,
  north: 49,
  east: -2,
  minZoom: 6,
  maxZoom: 14,
  name: 'Essai',
  attribution: '© essai',
};

test('the sheet under Saint-Quay-Portrieux', () => {
  const detail = sheetAt('detail', 48.652, -2.831);
  expect(detail?.id).toBe('Carte détaillée 48N 3W.pmtiles');
  expect(detail?.box).toStrictEqual({ s: 48, w: -3, n: 49, e: -2 });
  expect(sheetTitle(must(detail))).toBe('Carte détaillée 48N 3W');
  expect(sheetArea(must(detail))).toBe('48° N à 49° N · 3° W à 2° W');
  const large = sheetAt('large', 48.652, -2.831);
  expect(large?.box).toStrictEqual({ s: 46, w: -4, n: 49, e: 0 });
  expect(large?.maxZoom).toBe(10);
  expect(sheetTitle(must(large))).toBe('Grande carte 46N 4W');
  expect(sheetAt('detail', 70, 0)).toBeNull();
  expect(sheetAt('detail', 46.46, 6.338)?.id).toBe(
    'Carte détaillée 46N 6E.pmtiles',
  );
});

test('the tiles of a sheet stay inside it', () => {
  expect(tileX(-180, 3)).toBe(0);
  expect(tileX(179.99, 3)).toBe(7);
  expect(tileY(0, 1)).toBe(1);
  expect(tileY(60, 1)).toBe(0);
  const sheet = must(sheetAt('detail', 48.5, -2.5));
  const tiles = sheetTiles(sheet);
  const top = tiles.filter((tile) => tile.z === 14);
  // About 46 columns and 69 rows of zoom 14 over one degree at 48° N.
  expect(top.length).toBeGreaterThan(2900);
  expect(top.length).toBeLessThan(3400);
  expect(Math.min(...tiles.map((tile) => tile.z))).toBe(6);
  expect(sheetEstimate(sheet)).toBeGreaterThan(20e6);
  expect(sheetEstimate(sheet)).toBeLessThan(80e6);
  const next = must(sheetAt('detail', 48.5, -1.5));
  const ours = new Set(top.map((tile) => `${tile.x}/${tile.y}`));
  const shared = sheetTiles(next)
    .filter((tile) => tile.z === 14)
    .filter((tile) => ours.has(`${tile.x}/${tile.y}`));
  expect(shared.length).toBeLessThan(80);
});

test('the plan leaves out land far from water and the open sea', () => {
  // 3 × 3 squares from 0° E, 40° N: one shore in the middle row.
  const grid = {
    lon0: 0,
    lat0: 40,
    tilesLon: 4,
    tilesLat: 3,
    kinds: Uint8Array.from([1, 1, 1, 0, 1, 2, 0, 0, 0, 0, 0, 0]),
  };
  const keep = squareHasShore(grid);
  expect(keep(40, 0)).toBe(false);
  expect(keep(41, 1)).toBe(true);
  expect(keep(42, 2)).toBe(true);
  expect(keep(42, 3)).toBe(false);
  expect(keep(10, 10)).toBe(true);
  const all = planSheets('detail');
  expect(all.length).toBe(28 * 44);
  expect(planSheets('detail', () => false)).toStrictEqual([]);
  expect(planSheets('large').length).toBe(10 * 11);
});

test('a written map file reads back, root directory only', async () => {
  const data = new Uint8Array([1, 2, 3, 4]);
  const blob = writePmtiles(
    [
      { z: 6, x: 31, y: 22, data },
      { z: 7, x: 62, y: 44, data: new Uint8Array([9, 9]) },
      { z: 7, x: 63, y: 44, data: new Uint8Array() },
    ],
    info,
  );
  const reader = new PMTiles(blobSource('a', blob));
  const header = await reader.getHeader();
  expect(header.minZoom).toBe(6);
  expect(header.maxZoom).toBe(14);
  expect(header.minLat).toBeCloseTo(48);
  expect(header.maxLon).toBeCloseTo(-2);
  expect(header.tileType).toBe(1);
  expect(header.numTileEntries).toBe(2);
  const tile = await reader.getZxy(6, 31, 22);
  expect([...new Uint8Array(must(tile).data)]).toStrictEqual([1, 2, 3, 4]);
  expect([
    ...new Uint8Array(must(await reader.getZxy(7, 62, 44)).data),
  ]).toStrictEqual([9, 9]);
  expect(await reader.getZxy(7, 63, 44)).toBeUndefined();
  expect((await reader.getMetadata()) as object).toMatchObject({
    name: 'Essai',
  });
});

test('a big map file reads back through its leaf directories', async () => {
  const sheet = must(sheetAt('detail', 48.5, -2.5));
  const places = sheetTiles(sheet);
  const blob = writePmtiles(
    places.map((place) => ({
      ...place,
      data: Uint8Array.from([place.z, place.x % 256, place.y % 256]),
    })),
    info,
  );
  const reader = new PMTiles(blobSource('b', blob));
  const header = await reader.getHeader();
  expect(header.leafDirectoryLength).toBeGreaterThan(0);
  expect(header.rootDirectoryOffset + header.rootDirectoryLength).toBeLessThan(
    16_384,
  );
  for (const place of [
    must(places[0]),
    must(places[1500]),
    must(places.at(-1)),
  ]) {
    // eslint-disable-next-line no-await-in-loop -- a few reads in turn
    const tile = await reader.getZxy(place.z, place.x, place.y);
    expect([...new Uint8Array(must(tile).data)]).toStrictEqual([
      place.z,
      place.x % 256,
      place.y % 256,
    ]);
  }
});

test('a gzipped tile is unpacked, a plain one kept', async () => {
  const plain = new Uint8Array([5, 6, 7]);
  expect(await unpacked(plain)).toBe(plain);
  const packed = new Uint8Array(
    await new Response(
      new Blob([plain]).stream().pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer(),
  );
  expect([...(await unpacked(packed))]).toStrictEqual([5, 6, 7]);
});

test('a sheet is downloaded into one map file', async () => {
  const sheet = { ...must(sheetAt('large', 47, -3)), minZoom: 5, maxZoom: 7 };
  const asked: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = urlOf(input);
    asked.push(url);
    if (url.endsWith('/planet')) {
      return Response.json({
        tiles: ['https://tiles.example/planet/v1/{z}/{x}/{y}.pbf'],
      });
    }
    if (url.includes('/7/')) return new Response(null, { status: 204 });
    return new Response(new Uint8Array([1, 2]));
  }) as typeof fetch;
  let last = 0;
  const file = await sheetFile(sheet, {
    fetcher,
    onDone: (done) => {
      last = done;
    },
  });
  expect(file.name).toBe('Grande carte 46N 4W.pmtiles');
  expect(last).toBe(sheetTiles(sheet).length);
  expect(asked).toContain('https://tiles.example/planet/v1/5/15/11.pbf');
  const reader = new PMTiles(blobSource('c', file));
  const header = await reader.getHeader();
  expect(header.numTileEntries).toBe(
    sheetTiles(sheet).filter((tile) => tile.z < 7).length,
  );
});

test('a sheet download gives up when the tiles do not come', async () => {
  const sheet = { ...must(sheetAt('large', 47, -3)), minZoom: 5, maxZoom: 8 };
  const fetcher = (async (input: RequestInfo | URL) =>
    urlOf(input).endsWith('/planet')
      ? Response.json({ tiles: ['https://t/{z}/{x}/{y}'] })
      : new Response(null, { status: 500 })) as typeof fetch;
  await expect(sheetFile(sheet, { fetcher })).rejects.toThrow('tiles missing');
});
