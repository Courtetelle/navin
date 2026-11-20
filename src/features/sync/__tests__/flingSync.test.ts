import { expect, test } from 'vitest';

import { isFling } from '../flingSync.ts';

test('only a hard, long, upright swipe starts a synchronisation', () => {
  expect(isFling(10, -400, 150)).toBe(true);
  expect(isFling(-20, 300, 120)).toBe(true);
  // A slow reading scroll.
  expect(isFling(0, 300, 900)).toBe(false);
  // Too short.
  expect(isFling(0, 80, 20)).toBe(false);
  // Sideways (the swipe of a band).
  expect(isFling(300, 120, 100)).toBe(false);
});
