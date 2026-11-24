import { expect, test } from 'vitest';

import { railWindow } from '../railPages.ts';

test('the window of the buttons: shown, before it, after it', () => {
  const { start, places } = railWindow(10, 5, 2);
  expect(start).toBe(2);
  expect(places[0]).toEqual({ index: 3, away: -1 });
  expect(places[2]).toEqual({ index: 0, away: 0 });
  expect(places[6]).toEqual({ index: 4, away: 0 });
  expect(places[7]).toEqual({ index: 0, away: 1 });
});

test('the window stays inside the buttons', () => {
  expect(railWindow(10, 5, 9).start).toBe(5);
  expect(railWindow(10, 5, -3).start).toBe(0);
  expect(railWindow(4, 6, 2).start).toBe(0);
});
