import { expect, test } from 'vitest';

import { bearing, destination, distNM } from '../geo.ts';

test('a point set by course and distance reads back the same', () => {
  const from = { lat: 46.15, lon: -1.2 };
  const to = destination(from, 247, 3.5);
  expect(distNM(from, to)).toBeCloseTo(3.5, 6);
  expect(bearing(from, to)).toBeCloseTo(247, 4);
});

test('due north by 60 NM is one degree of latitude', () => {
  const to = destination({ lat: 43, lon: 5 }, 0, 60);
  expect(to.lat).toBeCloseTo(44, 2);
  expect(to.lon).toBeCloseTo(5, 6);
});
