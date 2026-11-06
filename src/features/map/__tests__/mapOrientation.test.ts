import { expect, test } from 'vitest';

import { bearingFor } from '../mapOrientation.ts';

test('north up brings the map back to north', () => {
  expect(bearingFor('north', 300, 60, 5)).toBe(0);
  expect(bearingFor('north', 0, 60, 5)).toBeNull();
});

test('course up puts the course at the top of the screen', () => {
  expect(bearingFor('course', 0, 60, 5)).toBe(300);
  expect(bearingFor('course', 300, 0, 5)).toBe(0);
});

test('course up holds still without a usable course', () => {
  expect(bearingFor('course', 300, null, 5)).toBeNull();
  expect(bearingFor('course', 300, Number.NaN, 5)).toBeNull();
  expect(bearingFor('course', 300, 90, 0.5)).toBeNull();
});

test('a course without a known speed still counts', () => {
  expect(bearingFor('course', 0, 90, null)).toBe(270);
});

test('a small change of course does not turn the map, even across north', () => {
  expect(bearingFor('course', 300, 62, 5)).toBeNull();
  expect(bearingFor('course', 359, 2, 5)).toBeNull();
  expect(bearingFor('course', 300, 70, 5)).toBe(290);
});
