import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createTimerGroup } from '../timers.ts';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

test('timers run after their delay, each one once', () => {
  const timers = createTimerGroup();
  const calls: string[] = [];
  timers.after(10, () => calls.push('first'));
  timers.after(20, () => calls.push('second'));
  vi.advanceTimersByTime(10);
  expect(calls).toStrictEqual(['first']);
  vi.advanceTimersByTime(30);
  expect(calls).toStrictEqual(['first', 'second']);
});

test('clear stops every pending timer, also those started by a timer', () => {
  const timers = createTimerGroup();
  const calls: string[] = [];
  timers.after(10, () => {
    calls.push('first');
    timers.after(10, () => calls.push('chained'));
  });
  timers.after(30, () => calls.push('late'));
  vi.advanceTimersByTime(10);
  timers.clear();
  vi.advanceTimersByTime(50);
  expect(calls).toStrictEqual(['first']);
});
