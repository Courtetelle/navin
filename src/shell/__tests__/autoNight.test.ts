import { afterEach, beforeEach, expect, test } from 'vitest';

import { initState, state, updateSettings } from '../../state/index.ts';
import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { store } from '../../storage/store.ts';
import { autoNightTick, sunPhase } from '../autoNight.ts';

/**
 * A moment of 9 November 2026 in Geneva, where the GPS is on (sunrise about
 * 06:26 UTC, sunset about 16:08 UTC).
 * @param time - `HH:MM` UTC.
 * @returns The moment, ms.
 */
function at(time: string): number {
  const now = Date.parse(`2026-11-09T${time}Z`);
  state.view.myPos.value = {
    lat: 46.2,
    lon: 6.15,
    sog: null,
    cog: null,
    t: now,
  };
  return now;
}

function setTheme(theme: string): void {
  updateSettings((settings) => {
    settings.theme = theme;
  });
}

function tick(time: string): string {
  autoNightTick(at(time));
  return state.preferences.settings.value.theme;
}

beforeEach(() => {
  initState(createMemoryStorage({}));
  setTheme('day');
});

afterEach(() => {
  state.view.myPos.value = null;
});

test('night runs from 2 h after sunset to 1 h before sunrise', () => {
  expect(sunPhase(at('17:00'))).toBe('day');
  expect(sunPhase(at('18:30'))).toBe('night');
  expect(sunPhase(at('05:00'))).toBe('night');
  expect(sunPhase(at('05:45'))).toBe('day');
});

test('the theme follows the phase, a switch by hand holds until the next one', () => {
  expect(tick('12:00')).toBe('day');
  setTheme('night');
  expect(tick('13:00')).toBe('night');
  expect(tick('18:30')).toBe('night');
  setTheme('day');
  expect(tick('19:00')).toBe('day');
});

test('crossing into day switches back', () => {
  store.set('ldb.themeAuto', 'night');
  setTheme('night');
  expect(tick('12:00')).toBe('day');
});

test('a first start by day keeps the theme chosen', () => {
  setTheme('night');
  expect(tick('12:00')).toBe('night');
});

test('a first start by night switches to night', () => {
  expect(tick('20:00')).toBe('night');
});
