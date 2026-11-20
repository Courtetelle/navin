import { expect, test } from 'vitest';

import { OPEN_FETCH_KM, fetchOf, fetchSea, pointAlong } from '../fetchWaves.ts';

test('a point along a bearing', () => {
  const north = pointAlong(46, 6, 0, 111.195);
  expect(north.lat).toBeCloseTo(47, 3);
  expect(north.lon).toBeCloseTo(6, 6);
  const east = pointAlong(0, 0, 90, 111.195);
  expect(east.lon).toBeCloseTo(1, 3);
});

// Land 0.1° north of the point (about 11 km), water everywhere else.
const isLand = (lat: number) => lat > 46.1;

test('the fetch stops on land, 1 km inside the mask taken off', () => {
  const north = fetchOf(isLand, 46, 6, 0);
  expect(north?.straightKm).toBeGreaterThan(9.5);
  expect(north?.straightKm).toBeLessThan(10.5);
  expect(north?.open).toBe(false);
  // The side rays are longer: the effective fetch is a little more.
  expect(north?.km).toBeGreaterThan(north?.straightKm ?? 0);
  const south = fetchOf(isLand, 46, 6, 180);
  expect(south).toStrictEqual({
    km: OPEN_FETCH_KM,
    straightKm: OPEN_FETCH_KM,
    open: true,
  });
  expect(fetchOf(isLand, 46.2, 6, 0)).toBeNull();
});

test('the sea of the fetch grows with it, up to the developed sea', () => {
  const short = fetchSea(20, 17);
  const long = fetchSea(20, 500);
  expect(short?.hs).toBeCloseTo(0.66, 1);
  expect(short?.period).toBeCloseTo(3.4, 1);
  expect(long?.hs).toBeGreaterThan(2);
  expect(long?.period).toBeGreaterThan(7);
  // Fully developed: about 0.24 U²/g.
  const developed = fetchSea(30, 100_000);
  expect(developed?.hs).toBeCloseTo((0.2413 * (30 * 0.5144) ** 2) / 9.81, 0);
  expect(fetchSea(0, 10)).toBeNull();
});
