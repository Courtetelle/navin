import { expect, test } from 'vitest';

import { stepValue } from '../stepValue.ts';

test('a step rounds to the decimals of the field', () => {
  const field = { decimals: 1, min: 0, max: 50 };
  expect(stepValue(field, 5, 0.1)).toBe(5.1);
  expect(stepValue(field, 0.2, 0.1)).toBe(0.3);
});

test('a step stays within the limits', () => {
  const field = { decimals: 0, min: 900, max: 1080 };
  expect(stepValue(field, 1078, 5)).toBe(1080);
  expect(stepValue(field, 902, -5)).toBe(900);
});

test('a direction wraps around', () => {
  const field = { decimals: 0, min: 0, max: 359, wrap: true };
  expect(stepValue(field, 355, 10)).toBe(5);
  expect(stepValue(field, 5, -10)).toBe(355);
  expect(stepValue(field, 359, 1)).toBe(0);
});
