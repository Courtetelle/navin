import { expect, test } from 'vitest';

import { estimateDepth, nearDepths, toLine } from '../isobath.ts';

const lines = [
  toLine([2, 46.5, 6.5, 46.5, 6.51]),
  toLine([4, 46.502, 6.5, 46.502, 6.51]),
];

test('toLine reads the stored format and computes the box', () => {
  expect(lines[0]).toStrictEqual({
    d: 2,
    pts: [
      [46.5, 6.5],
      [46.5, 6.51],
    ],
    bb: [46.5, 6.5, 46.5, 6.51],
    b3d: true,
  });
});

test('nearDepths sorts the lines by distance', () => {
  const near = nearDepths(lines, 46.5005, 6.505);
  expect(near.map((item) => item[1])).toStrictEqual([2, 4]);
  expect(near[0]?.[0]).toBeCloseTo(55.66, 1);
  expect(near[1]?.[0]).toBeCloseTo(166.98, 1);
});

test('estimateDepth interpolates between two lines', () => {
  const estimate = estimateDepth(nearDepths(lines, 46.5005, 6.505));
  expect(estimate?.depth).toBeCloseTo(2.5, 3);
});

test('estimateDepth keeps one line when the other is out of reach', () => {
  const estimate = estimateDepth([
    [100, 2],
    [500, 4],
  ]);
  expect(estimate).toStrictEqual({
    first: [100, 2],
    second: null,
    depth: null,
  });
});

test('estimateDepth gives up beyond 400 m', () => {
  expect(estimateDepth([[401, 2]])).toBeNull();
  expect(estimateDepth([])).toBeNull();
});
