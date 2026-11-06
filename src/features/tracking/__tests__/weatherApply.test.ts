import { afterEach, beforeEach, expect, test } from 'vitest';

import type { EntryValues } from '../../../model/types.ts';
import { applyWeather } from '../weather.ts';

import { openCruise, setUpWeather, tearDownWeather } from './weatherSetup.ts';

function values(
  initial: EntryValues,
  weather: Parameters<typeof applyWeather>[1],
) {
  const result = structuredClone(initial);
  applyWeather(result, weather);
  return result;
}

beforeEach(setUpWeather);
afterEach(tearDownWeather);

test('the weather fills what is empty, rounded, and notes its source', () => {
  openCruise(false);
  expect(
    values(
      { cog: 90, sog: 5 },
      {
        twd: 359.6,
        tws: 12.4,
        baro: 1013.4,
        waveDir: 200.2,
        waveH: 1.3,
        src: 'Modèle',
      },
    ),
  ).toStrictEqual({
    cog: 90,
    sog: 5,
    twd: 0,
    tws: 12,
    baro: 1013,
    vagues: 200,
    mer: '4',
    wxSrc: 'Modèle',
    allure: 'Travers',
  });
});

test('a value typed by hand is never replaced', () => {
  openCruise(false);
  const typed = {
    twd: 5,
    tws: 3,
    baro: 1000,
    vagues: 10,
    mer: '2',
    allure: 'Près',
  };
  expect(
    values(typed, {
      twd: 100,
      tws: 12,
      baro: 1020,
      waveDir: 1,
      waveH: 2,
      src: 'Modèle',
    }),
  ).toStrictEqual({ ...typed, wxSrc: 'Modèle' });
});

test('on a lake the waves are ignored', () => {
  openCruise(true);
  expect(
    values(
      {},
      { twd: 10, tws: 5, baro: null, waveDir: 200, waveH: 1, src: 'S' },
    ),
  ).toStrictEqual({ twd: 10, tws: 5, wxSrc: 'S' });
});

test('no source note without wind nor pressure', () => {
  openCruise(false);
  expect(
    values({}, { twd: null, tws: null, baro: null, waveH: 1, src: 'S' }),
  ).toStrictEqual({ mer: '3' });
});

test('the point of sail needs a boat moving above 1 kn', () => {
  openCruise(false);
  const weather = { twd: 10, tws: 12, baro: null };
  expect(values({ cog: 10, sog: 0.5 }, weather).allure).toBeUndefined();
  expect(values({ cog: 10, sog: 2 }, weather).allure).toBe('Près serré');
  expect(values({ cog: 190 }, weather).allure).toBe('Vent arrière');
});
