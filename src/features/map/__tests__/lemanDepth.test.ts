import { beforeEach, expect, test, vi } from 'vitest';

import { lv95ToWgs, wgsToLv95 } from '../bathyGeometry.ts';
import { forgetDepthTiles, lemanDepthAt } from '../lemanDepth.ts';
import { DEPTH_DEEP, DEPTH_TILE_CELLS } from '../lemanDepthFormat.ts';
import { inLemanPort } from '../lemanPorts.ts';

beforeEach(() => {
  forgetDepthTiles();
});

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

/**
 * A position, and a loader giving one shallow cell a distance north of it.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param metresNorth - Distance to the shallow cell.
 * @returns The loader.
 */
function shallowCellNorth(lat: number, lon: number, metresNorth: number) {
  const [east, north] = wgsToLv95(lat, lon);
  const column = Math.floor(east / 2);
  const row = Math.floor(north / 2) + metresNorth / 2;
  const key = `${Math.floor(column / 500)}_${Math.floor(row / 500)}`;
  const cell: [number, number, number] = [
    DEPTH_TILE_CELLS - 1 - (row % DEPTH_TILE_CELLS),
    column % DEPTH_TILE_CELLS,
    42,
  ];
  return vi.fn((asked: string) =>
    Promise.resolve(tile(DEPTH_DEEP, asked === key ? [cell] : [])),
  );
}

// Off Morges, in a tile with shallow water, out of any port.
const OPEN = { lat: 46.4985, lon: 6.5 };
// In the port of Ouchy.
const PORT = { lat: 46.505, lon: 6.6265 };

test('positions used by these tests', () => {
  expect(inLemanPort(OPEN.lat, OPEN.lon)).toBe(false);
  expect(inLemanPort(PORT.lat, PORT.lon)).toBe(true);
});

test('off a port the least water within 10 m counts', async () => {
  const { lat, lon } = OPEN;
  await expect(
    lemanDepthAt(lat, lon, shallowCellNorth(lat, lon, 8)),
  ).resolves.toBe(4.2);
  forgetDepthTiles();
  await expect(
    lemanDepthAt(lat, lon, shallowCellNorth(lat, lon, 14)),
  ).resolves.toBeNull();
});

test('in a port only the cells around the position count', async () => {
  const { lat, lon } = PORT;
  await expect(
    lemanDepthAt(lat, lon, shallowCellNorth(lat, lon, 2)),
  ).resolves.toBe(4.2);
  forgetDepthTiles();
  await expect(
    lemanDepthAt(lat, lon, shallowCellNorth(lat, lon, 8)),
  ).resolves.toBeNull();
});
