import { expect, test } from 'vitest';

import { allureFromTwa, douglasFromHeight } from '../seaState.ts';

test('the point of sail follows the true wind angle', () => {
  const angles = [
    0, 44.9, 45, 59, 60, 79, 80, 104, 105, 134, 135, 164, 165, 180,
  ];
  expect(angles.map(allureFromTwa)).toStrictEqual([
    'Près serré',
    'Près serré',
    'Près',
    'Près',
    'Bon plein',
    'Bon plein',
    'Travers',
    'Travers',
    'Largue',
    'Largue',
    'Grand largue',
    'Grand largue',
    'Vent arrière',
    'Vent arrière',
  ]);
});

test('the Douglas degree follows the wave height', () => {
  const heights = [
    0, 0.05, 0.1, 0.11, 0.5, 1, 1.25, 2, 2.5, 3, 4, 5, 6, 8, 9, 14, 20,
  ];
  expect(heights.map(douglasFromHeight)).toStrictEqual([
    '0',
    '1',
    '1',
    '2',
    '2',
    '3',
    '3',
    '4',
    '4',
    '5',
    '5',
    '6',
    '6',
    '7',
    '7',
    '8',
    '9',
  ]);
});
