import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { initState, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend, store } from '../../../storage/store.ts';
import {
  hideStartChoice,
  startChoice,
  trackerOverlay,
  trkChooseStart,
} from '../trackerButtons.ts';

vi.mock('../../../lib/useWide.ts', () => ({ railsScreen: () => true }));

beforeEach(() => {
  vi.useFakeTimers();
  const storage = createMemoryStorage({});
  setStorageBackend(storage);
  initState(storage);
  hideStartChoice();
});

afterEach(() => {
  vi.useRealTimers();
});

test('around the map, Prolonger and Nouvelle trace stand beside START for 3 s', () => {
  state.data.cruise.value = { id: 'c1' } as never;
  store.set('ldb.lastTrip.c1', { end: Date.now(), det: { dist: 1 } });
  state.view.currentView.value = 'tracker';
  trkChooseStart();
  expect(startChoice.value).toBe(true);
  expect(trackerOverlay.value.kind).toBe('idle');
  vi.advanceTimersByTime(2900);
  expect(startChoice.value).toBe(true);
  vi.advanceTimersByTime(200);
  expect(startChoice.value).toBe(false);
});

test('no previous track, no choice', () => {
  state.data.cruise.value = { id: 'c1' } as never;
  state.view.currentView.value = 'tracker';
  trkChooseStart();
  expect(startChoice.value).toBe(false);
});
