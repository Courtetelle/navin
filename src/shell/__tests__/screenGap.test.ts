import { expect, test } from 'vitest';

import { cameraSide, screenGap } from '../screenGap.ts';

const iphone = { screenWidth: 393, screenHeight: 852 };

test('from the home screen, upright, the status bar is added back', () => {
  expect(
    screenGap({ standalone: true, ...iphone, width: 393, height: 793 }),
  ).toBe(59);
});

test('sideways or in Safari, nothing is added', () => {
  expect(
    screenGap({ standalone: true, ...iphone, width: 852, height: 393 }),
  ).toBe(0);
  expect(
    screenGap({ standalone: false, ...iphone, width: 393, height: 793 }),
  ).toBe(0);
});

test('a keyboard is not a status bar', () => {
  expect(
    screenGap({ standalone: true, ...iphone, width: 393, height: 500 }),
  ).toBe(0);
});

test('the camera side of a phone turned sideways', () => {
  expect(cameraSide(90, true)).toBe('left');
  expect(cameraSide(-90, true)).toBe('right');
  expect(cameraSide(270, true)).toBe('right');
  expect(cameraSide(0, false)).toBeNull();
  expect(cameraSide(180, false)).toBe('bottom');
});
