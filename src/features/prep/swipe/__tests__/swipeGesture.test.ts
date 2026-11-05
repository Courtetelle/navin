import { expect, test } from 'vitest';

import { swipeConfirms, swipeDecision } from '../swipeGesture.ts';

test('a clear movement to the left starts a swipe', () => {
  expect(swipeDecision(-13, 2)).toBe('swipe');
});

test('a small movement decides nothing', () => {
  expect(swipeDecision(-12, 0)).toBe('wait');
  expect(swipeDecision(0, 12)).toBe('wait');
});

test('a vertical movement gives the gesture back to the scroll', () => {
  expect(swipeDecision(-5, 13)).toBe('scroll');
  expect(swipeDecision(5, -20)).toBe('scroll');
});

test('a movement to the right never starts a swipe', () => {
  expect(swipeDecision(40, 2)).toBe('wait');
});

test('the confirmation opens from 70 px', () => {
  expect(swipeConfirms(-69)).toBe(false);
  expect(swipeConfirms(-70)).toBe(true);
  expect(swipeConfirms(-140)).toBe(true);
});
