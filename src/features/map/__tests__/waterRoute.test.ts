import { expect, test } from 'vitest';

import type { WaterGrid } from '../waterRoute.ts';
import {
  bendLegs,
  blockCircle,
  cellOf,
  cellPosition,
  clearLine,
  keepOffShore,
  nearestWater,
  pixelPosition,
  straightLegs,
  waterPath,
  worldPixel,
} from '../waterRoute.ts';

/**
 * A grid drawn with text: `.` water, `#` land.
 * @param rows - The rows, north first.
 * @returns The grid.
 */
function drawn(rows: readonly string[]): WaterGrid {
  const w = rows[0]?.length ?? 0;
  const water = new Uint8Array(w * rows.length);
  for (const [y, row] of rows.entries()) {
    for (const [x, character] of Array.from(row).entries()) {
      water[y * w + x] = character === '.' ? 1 : 0;
    }
  }
  return { w, h: rows.length, water, x0: 0, y0: 0, zoom: 14 };
}

// A cape between two bays: the way round goes by its point, at the bottom.
const CAPE = drawn([
  '..........',
  '..........',
  '....#.....',
  '....#.....',
  '....#.....',
  '....#.....',
  '..........',
]);

test('positions and world pixels go both ways', () => {
  const [x, y] = worldPixel(48.652, -2.83, 14);
  const back = pixelPosition(x, y, 14);
  expect(back.lat).toBeCloseTo(48.652, 9);
  expect(back.lon).toBeCloseTo(-2.83, 9);
  const grid = { ...CAPE, x0: Math.floor(x) - 3, y0: Math.floor(y) - 2 };
  expect(cellOf(grid, 48.652, -2.83)).toStrictEqual([3, 2]);
  const middle = cellPosition(grid, [3, 2]);
  expect(cellOf(grid, middle.lat, middle.lon)).toStrictEqual([3, 2]);
});

test('the way through the water goes round the land', () => {
  const path = waterPath(CAPE, [2, 3], [7, 3]);
  expect(path?.[0]).toStrictEqual([2, 3]);
  expect(path?.at(-1)).toStrictEqual([7, 3]);
  for (const cell of path ?? []) {
    expect(cell[0] === 4 && cell[1] >= 2 && cell[1] <= 5).toBe(false);
  }
  // Straight legs: start, round the cape, end.
  const legs = straightLegs(CAPE, path ?? []);
  expect(legs.length).toBeGreaterThanOrEqual(3);
  expect(legs.length).toBeLessThanOrEqual(4);
  for (let index = 1; index < legs.length; index++) {
    expect(
      clearLine(CAPE, legs[index - 1] as never, legs[index] as never),
    ).toBe(true);
  }
  expect(clearLine(CAPE, [2, 3], [7, 3])).toBe(false);
});

test('no way when the water is closed, nor from the land', () => {
  const closed = drawn(['..#..', '..#..', '..#..']);
  expect(waterPath(closed, [0, 1], [4, 1])).toBeNull();
  expect(waterPath(closed, [2, 1], [4, 1])).toBeNull();
  expect(waterPath(closed, [0, 0], [0, 0])).toStrictEqual([[0, 0]]);
});

test('a diagonal never cuts the corner of the land', () => {
  const corner = drawn(['.#', '#.']);
  expect(waterPath(corner, [0, 0], [1, 1])).toBeNull();
});

test('the margin keeps the boat off the shore', () => {
  const kept = keepOffShore(CAPE, 1.5);
  // Right beside the cape: too near.
  expect(kept.water[3 * CAPE.w + 3]).toBe(0);
  expect(kept.water[3 * CAPE.w + 5]).toBe(0);
  // Two cells away: still water.
  expect(kept.water[3 * CAPE.w + 1]).toBe(1);
  expect(keepOffShore(CAPE, 0)).toBe(CAPE);
});

test('a point laid on the land goes to the nearest water', () => {
  expect(nearestWater(CAPE, [4, 3], 3)).not.toBeNull();
  expect(nearestWater(CAPE, [1, 1], 3)).toStrictEqual([1, 1]);
  const land = drawn(['###', '###', '###']);
  expect(nearestWater(land, [1, 1], 2)).toBeNull();
});

test('a zone to avoid is taken out of the water', () => {
  // On the equator, where the world pixels of zoom 14 start at 2 097 152.
  const grid = {
    ...drawn(Array.from({ length: 9 }, () => '.........')),
    x0: 2_097_152,
    y0: 2_097_152,
  };
  const middle = cellPosition(grid, [4, 4]);
  // Cells of about 9,5 m at zoom 14 on the equator: 20 m takes the middle.
  blockCircle(grid, middle.lat, middle.lon, 20);
  expect(grid.water[4 * 9 + 6]).toBe(0);
  expect(grid.water[4 * 9 + 7]).toBe(1);
  expect(grid.water[4 * 9 + 4]).toBe(0);
  expect(grid.water[0]).toBe(1);
});

test('a leg across the cape bends round it, a clear leg stays straight', () => {
  const grid = { ...CAPE, x0: 2_097_152, y0: 2_097_152 };
  const west = cellPosition(grid, [2, 3]);
  const east = cellPosition(grid, [7, 3]);
  const north = cellPosition(grid, [7, 0]);
  const bent = bendLegs(grid, [west, east, north], 2);
  expect(bent.bent).toBe(1);
  expect(bent.failed).toStrictEqual([]);
  expect(bent.points[0]).toBe(west);
  expect(bent.points.at(-2)).toBe(east);
  expect(bent.points.at(-1)).toBe(north);
  expect(bent.points.length).toBeGreaterThan(3);
  const closed = { ...drawn(['..#..', '..#..']), x0: 2_097_152, y0: 2_097_152 };
  const across = bendLegs(
    closed,
    [cellPosition(closed, [0, 0]), cellPosition(closed, [4, 1])],
    1,
  );
  expect(across.failed).toStrictEqual([0]);
  expect(across.points).toHaveLength(2);
});
