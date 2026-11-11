import { expect, test } from 'vitest';

import {
  kmText,
  readNumber,
  reverseCourse,
  validCourse,
} from '../rulerEditor.ts';

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

test('the distance typed also reads in kilometres', () => {
  expect(kmText(18)).toBe('= 33,3 km');
  expect(kmText(1.68)).toBe('= 3,11 km');
  expect(kmText(null)).toBe('');
  expect(kmText(0)).toBe('');
});

test('the arrow turned about reads the reciprocal course', () => {
  expect(reverseCourse(63)).toBe(243);
  expect(reverseCourse(300)).toBe(120);
  expect(reverseCourse(180)).toBe(0);
});
