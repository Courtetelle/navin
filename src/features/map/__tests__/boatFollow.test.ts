import { expect, test } from 'vitest';

import { angleBetween, glideDuration } from '../boatFollow.ts';

test('a glide lasts about the time between two GPS points', () => {
  expect(glideDuration(50)).toBe(300);
  expect(glideDuration(800)).toBe(800);
  expect(glideDuration(60_000)).toBe(1200);
});

test('the map turns by the short way, even across north', () => {
  expect(angleBetween(350, 10, 0.5)).toBe(0);
  expect(angleBetween(10, 350, 0.5)).toBe(0);
  expect(angleBetween(90, 180, 0)).toBe(90);
  expect(angleBetween(90, 180, 1)).toBe(180);
});
