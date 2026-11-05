import { expect, test } from 'vitest';

import { cutSegment } from '../deleteTrace.ts';

test('cutting a middle segment shifts the next starts', () => {
  expect(cutSegment(['a', 'b', 'c', 'd', 'e'], [0, 2, 4], 1)).toStrictEqual({
    kept: ['a', 'b', 'e'],
    starts: [2],
  });
});

test('cutting the first segment drops the start that became 0', () => {
  expect(cutSegment(['a', 'b', 'c'], [0, 2], 0)).toStrictEqual({
    kept: ['c'],
    starts: [],
  });
});

test('cutting the last segment runs to the end of the track', () => {
  expect(cutSegment(['a', 'b', 'c', 'd'], [0, 3], 1)).toStrictEqual({
    kept: ['a', 'b', 'c'],
    starts: [],
  });
});
