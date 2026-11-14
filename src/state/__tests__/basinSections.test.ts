import { afterEach, expect, test } from 'vitest';

import type { Cruise } from '../../model/types.ts';
import { state } from '../index.ts';
import { cruiseBasin, daySections } from '../mode.ts';

const BLANK: Cruise = {
  id: 'c1',
  name: 'Essai',
  created: '2026-11-14',
  info: {},
  crew: [],
  entries: [],
  days: {},
  type: 'mer',
} as unknown as Cruise;

function titles(): string[] {
  return daySections().map((section) => section.title);
}

afterEach(() => {
  state.data.cruise.value = null;
  state.view.zoneSimV.value = '';
});

test('the tides are in the logbook in the Atlantic only', () => {
  state.view.zoneSimV.value = 'mer';
  state.preferences.settings.value = {
    ...state.preferences.settings.value,
    seaBasin: 'atl',
  };
  state.data.cruise.value = BLANK;
  expect(cruiseBasin()).toBe('atl');
  expect(titles()).toContain('Marées');
  state.preferences.settings.value = {
    ...state.preferences.settings.value,
    seaBasin: 'med',
  };
  expect(cruiseBasin()).toBe('med');
  expect(titles()).not.toContain('Marées');
});

test('in the Mediterranean, tides already written stay shown', () => {
  state.view.zoneSimV.value = 'mer';
  state.preferences.settings.value = {
    ...state.preferences.settings.value,
    seaBasin: 'med',
  };
  state.data.cruise.value = {
    ...BLANK,
    days: { '2026-07-14': { marCoeff: 80 } },
  };
  expect(titles()).toContain('Marées');
});

test('on the GPS, the sea of the first position of the cruise', () => {
  state.data.cruise.value = {
    ...BLANK,
    entries: [
      { id: 'e', t: '2026-07-14T08:00', v: { pos: { lat: 43.5, lon: 16.4 } } },
    ],
  };
  expect(cruiseBasin()).toBe('med');
  expect(titles()).not.toContain('Marées');
});
