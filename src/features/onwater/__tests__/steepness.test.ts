import { expect, test } from 'vitest';

import {
  currentAgainst,
  deepWavelength,
  periodRule,
  steepnessOf,
} from '../steepness.ts';

test('the length of a wave in deep water', () => {
  expect(Math.round(deepWavelength(14))).toBe(306);
  expect(Math.round(deepWavelength(6))).toBe(56);
});

test('3 m of waves: the period makes the danger', () => {
  expect(steepnessOf(3, 14)?.steep.level).toBe(0);
  expect(steepnessOf(3, 9)?.steep.level).toBe(1);
  expect(steepnessOf(3, 6)?.oneIn).toBe(19);
  expect(steepnessOf(3, 6)?.steep.level).toBe(2);
  expect(steepnessOf(3, 4.5)?.steep.level).toBe(3);
  expect(steepnessOf(3, 3.5)?.steep.level).toBe(4);
});

test('no steepness without a height or a period', () => {
  expect(steepnessOf(2, null)).toBeNull();
  expect(steepnessOf(0, 6)).toBeNull();
});

test('the rule of the period against the height', () => {
  expect(periodRule(2, 6)).toMatch(/maniable/u);
  expect(periodRule(2, 4)).toMatch(/agitée/u);
  expect(periodRule(4, 4)).toMatch(/carrée/u);
});

test('a current against the waves', () => {
  // Waves from the west go east; a current going west is against them.
  expect(currentAgainst(270, 270)).toBe(true);
  expect(currentAgainst(270, 300)).toBe(true);
  expect(currentAgainst(270, 90)).toBe(false);
  expect(currentAgainst(270, 0)).toBe(false);
  expect(currentAgainst(null, 90)).toBe(false);
});

test('small waves are a discomfort, not a danger', () => {
  expect(steepnessOf(0.4, 2)?.small).toBe(true);
  expect(steepnessOf(3, 6)?.small).toBe(false);
});
