import { expect, test } from 'vitest';

import { readNumber, validCourse } from '../rulerEditor.ts';

test('a number reads with a comma or a point', () => {
  expect(readNumber('2,5')).toBe(2.5);
  expect(readNumber(' 047 ')).toBe(47);
  expect(readNumber('')).toBeNull();
  expect(readNumber('abc')).toBeNull();
});

test('a course and a distance must make sense', () => {
  expect(validCourse(247, 3.5)).toBe(true);
  expect(validCourse(361, 3.5)).toBe(false);
  expect(validCourse(90, 0)).toBe(false);
  expect(validCourse(null, 2)).toBe(false);
});
