import { expect, test, vi } from 'vitest';

import { lv95ToWgs, wgsToLv95 } from '../bathyGeometry.ts';
import { lemanDepthAt } from '../lemanDepth.ts';
import { DEPTH_DEEP, DEPTH_TILE_CELLS } from '../lemanDepthFormat.ts';

function position(east: number, north: number) {
  const [lat, lon] = lv95ToWgs(east, north);
  return { lat, lon };
}

function tile(fill: number, cells: Array<[number, number, number]> = []) {
  const data = new Uint8Array(DEPTH_TILE_CELLS * DEPTH_TILE_CELLS).fill(fill);
  for (const [row, column, value] of cells) {
    data[row * DEPTH_TILE_CELLS + column] = value;
  }
  return data;
}

test('wgsToLv95 undoes lv95ToWgs within a metre', () => {
  const [lat, lon] = lv95ToWgs(2_530_000, 1_150_000);
  const [east, north] = wgsToLv95(lat, lon);
  expect(Math.abs(east - 2_530_000)).toBeLessThan(1);
  expect(Math.abs(north - 1_150_000)).toBeLessThan(1);
});

test('out of the lake area the cells say nothing', async () => {
  const load = vi.fn();
  await expect(lemanDepthAt(43.3, 5.4, load)).resolves.toBeUndefined();
  expect(load).not.toHaveBeenCalled();
});

test('a tile without shallow water is deep, and is not read', async () => {
  const load = vi.fn();
  const { lat, lon } = position(2_530_500, 1_140_500);
  await expect(lemanDepthAt(lat, lon, load)).resolves.toBeNull();
  expect(load).not.toHaveBeenCalled();
});

test('it gives the least water of the nine cells around the position', async () => {
  // In the first shipped tile holding shallow water, cell by cell.
  const { default: shallow } = await import('../lemanDepthTiles.json');
  const key = shallow[0] as string;
  const [tileEast, tileNorth] = key.split('_').map(Number) as [number, number];
  const east = tileEast * 1000 + 501;
  const north = tileNorth * 1000 + 501;
  const { lat, lon } = position(east, north);
  const [gotEast, gotNorth] = wgsToLv95(lat, lon);
  const row = DEPTH_TILE_CELLS - 1 - Math.floor((gotNorth % 1000) / 2);
  const column = Math.floor((gotEast % 1000) / 2);
  const deep = vi.fn(() =>
    Promise.resolve(tile(DEPTH_DEEP, [[row, column, 42]])),
  );
  await expect(lemanDepthAt(lat, lon, deep)).resolves.toBe(4.2);
});
