import { expect, test } from 'vitest';

import type { LatLngPair } from '../constants.ts';
import { smoothLine } from '../smoothLine.ts';

test('a line too short to have a corner stays as it is', () => {
  const line: LatLngPair[] = [
    [46.5, 6.6],
    [46.501, 6.6],
  ];
  expect(smoothLine(line)).toStrictEqual(line);
  expect(smoothLine([])).toStrictEqual([]);
});

test('a corner is rounded, the two ends stay', () => {
  const line: LatLngPair[] = [
    [46.5, 6.6],
    [46.5005, 6.6],
    [46.5005, 6.6007],
  ];
  const drawn = smoothLine(line);
  expect(drawn[0]).toStrictEqual(line[0]);
  expect(drawn.at(-1)).toStrictEqual(line[2]);
  expect(drawn.length).toBeGreaterThan(line.length);
  expect(drawn).not.toContainEqual(line[1]);
});

test('a gap in the recording is not rounded away', () => {
  const line: LatLngPair[] = [
    [46.5, 6.6],
    [46.45, 6.6],
    [46.45, 6.7],
  ];
  expect(smoothLine(line)).toContainEqual(line[1]);
});
