import { expect, test } from 'vitest';

import { zoneEstimate, zoneTileXY, zoneUrl } from '../zoneStore.ts';

const LEMAN = { s: 46.18, n: 46.56, w: 6.1, e: 6.95 };

test('zoneTileXY lists the tiles from zoom 6', () => {
  const tiles = zoneTileXY(LEMAN, 7);
  expect(tiles).toStrictEqual([
    [6, 33, 22],
    [7, 66, 45],
  ]);
});

test('zoneUrl fills the template', () => {
  expect(zoneUrl('https://t/{z}/{x}/{y}.png', [7, 66, 45])).toBe(
    'https://t/7/66/45.png',
  );
});

test('zoneEstimate gives the size or refuses', () => {
  expect(zoneEstimate(100)).toBe(
    'Environ 200 tuiles (plan + balisage), ≈ 4 Mo.',
  );
  expect(zoneEstimate(8001)).toBe(
    'Zone trop grande pour ce détail (8001 tuiles par couche, maximum 8000) : rapprochez la carte ou baissez le détail.',
  );
});
