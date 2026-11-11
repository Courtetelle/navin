import { gzipSync } from 'node:zlib';

import { afterEach, expect, test, vi } from 'vitest';

import {
  farFromShore,
  forgetShoreGrid,
  nearWater,
  parseShoreGrid,
} from '../shoreFar.ts';

afterEach(() => {
  vi.unstubAllGlobals();
  forgetShoreGrid();
});

const PER = 10;

function varint(value: number, out: number[]): void {
  let rest = value;
  for (;;) {
    const byte = rest & 0x7f;
    rest = Math.floor(rest / 128);
    if (!rest) {
      out.push(byte);
      return;
    }
    out.push(byte | 0x80);
  }
}

/** A grid of 2 × 1 tiles from (lon 6, lat 46): west all far, east mixed. */
function sample(): Uint8Array {
  const head = [...new TextEncoder().encode('NVSH')];
  const view = new DataView(new ArrayBuffer(10));
  view.setUint8(0, 1);
  view.setUint8(1, PER);
  view.setInt16(2, 6, true);
  view.setInt16(4, 46, true);
  view.setUint16(6, 2, true);
  view.setUint16(8, 1, true);
  // East tile: the southern half kept (water), the northern half far land.
  const runs: number[] = [];
  varint(50, runs);
  varint(50, runs);
  return new Uint8Array([
    ...head,
    ...new Uint8Array(view.buffer),
    1,
    2,
    runs.length,
    0,
    ...runs,
  ]);
}

test('a tile of far land leaves out every place in it', () => {
  const grid = parseShoreGrid(sample());
  expect(grid).not.toBeNull();
  if (!grid) return;
  expect(farFromShore(grid, 46.5, 6.5)).toBe(true);
});

test('a mixed tile tells the cells apart', () => {
  const grid = parseShoreGrid(sample());
  if (!grid) throw new Error('no grid');
  expect(farFromShore(grid, 46.2, 7.5)).toBe(false);
  expect(farFromShore(grid, 46.8, 7.5)).toBe(true);
  expect(farFromShore(grid, 46.999, 7.999)).toBe(true);
});

test('outside the grid nothing is left out', () => {
  const grid = parseShoreGrid(sample());
  if (!grid) throw new Error('no grid');
  expect(farFromShore(grid, 45.5, 6.5)).toBe(false);
  expect(farFromShore(grid, 46.5, 8.5)).toBe(false);
});

test('a file that is not a grid is refused', () => {
  expect(parseShoreGrid(new Uint8Array([1, 2, 3]))).toBeNull();
  expect(parseShoreGrid(new TextEncoder().encode('NOPE0000000000'))).toBeNull();
});

test('the alerts keep the stations near the water and those without a place', async () => {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(new Response(gzipSync(sample()))),
  );
  const kept = await nearWater([
    { name: 'far', lat: 46.5, lon: 6.5 },
    { name: 'shore', lat: 46.2, lon: 7.5 },
    { name: 'outside', lat: 40, lon: 6.5 },
    { name: 'no place' },
  ]);
  expect(kept.map(({ name }) => name)).toStrictEqual([
    'shore',
    'outside',
    'no place',
  ]);
});

test('without the grid every station stays', async () => {
  vi.stubGlobal('fetch', () =>
    Promise.resolve(new Response('', { status: 404 })),
  );
  const kept = await nearWater([{ lat: 46.5, lon: 6.5 }]);
  expect(kept).toHaveLength(1);
});
