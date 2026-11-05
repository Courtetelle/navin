import { expect, test } from 'vitest';

import type { LatLngPair } from '../constants.ts';
import {
  dpSimplify,
  inShore,
  shoreDist,
  shoreRings,
  zonePopupHtml,
} from '../shore.ts';

const square: LatLngPair[] = [
  [46, 6],
  [46, 6.1],
  [46.1, 6.1],
  [46.1, 6],
  [46, 6],
];
const island: LatLngPair[] = [
  [46.04, 6.04],
  [46.04, 6.06],
  [46.06, 6.06],
  [46.06, 6.04],
  [46.04, 6.04],
];

function node(lat: number, lon: number) {
  return { lat, lon };
}

test('inShore treats islands as holes', () => {
  expect(inShore([square, island], 46.02, 6.02)).toBe(true);
  expect(inShore([square, island], 46.05, 6.05)).toBe(false);
  expect(inShore([square, island], 46.2, 6.05)).toBe(false);
});

test('shoreDist measures to the nearest side in metres', () => {
  expect(shoreDist([square], 46.001, 6.05)).toBeCloseTo(111.32, 1);
});

test('dpSimplify drops the points on a straight line', () => {
  expect(
    dpSimplify(
      [
        [0, 0],
        [1, 1.000_001],
        [2, 2],
        [3, 0],
      ],
      0.01,
    ),
  ).toStrictEqual([
    [0, 0],
    [2, 2],
    [3, 0],
  ]);
});

test('shoreRings joins the pieces and reverses them when needed', () => {
  const rings = shoreRings([
    {
      members: [
        { geometry: [node(46, 6), node(46, 6.1)] },
        { geometry: [node(46.1, 6), node(46.1, 6.1), node(46, 6.1)] },
        { geometry: [node(46.1, 6), node(46, 6)] },
      ],
    },
  ]);
  expect(rings).toStrictEqual([
    [
      [46, 6],
      [46, 6.1],
      [46.1, 6.1],
      [46.1, 6],
      [46, 6],
    ],
  ]);
});

test('zonePopupHtml picks the rules of the band', () => {
  expect(zonePopupHtml(120)).toContain(
    'Zone riveraine intérieure · moins de 150 m',
  );
  expect(zonePopupHtml(120)).toContain('≈ 120 m de la rive');
  expect(zonePopupHtml(200)).toContain(
    'Zone riveraine extérieure · 150 à 300 m',
  );
});
