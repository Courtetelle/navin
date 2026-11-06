import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { state, updateCruise } from '../../../state/index.ts';
import { enrichEntry, fillPendingWeather } from '../weather.ts';

import {
  HOURLY,
  NOW,
  answer,
  openCruise,
  setUpWeather,
  stubFetch,
  tearDownWeather,
} from './weatherSetup.ts';

beforeEach(setUpWeather);
afterEach(tearDownWeather);

test('an entry is completed in memory and no longer pending', async () => {
  openCruise(false);
  updateCruise((cruise) => {
    cruise.entries.push({
      id: 'e1',
      t: new Date(NOW).toISOString(),
      v: { pos: { lat: 43.4, lon: 16.4 } },
      auto: true,
      needWx: true,
    });
  });
  stubFetch((url) => (url.includes('marine-api') ? null : answer(HOURLY)));
  expect(await enrichEntry('e1')).toBe(true);
  expect(state.data.cruise.value?.entries[0]).toStrictEqual({
    id: 'e1',
    t: new Date(NOW).toISOString(),
    v: {
      pos: { lat: 43.4, lon: 16.4 },
      twd: 209,
      tws: 19,
      baro: 1009,
      wxSrc: 'Prévision modèle européen (Open-Meteo)',
    },
    auto: true,
    wx: true,
  });
});

test('an entry without coordinates cannot be completed', async () => {
  openCruise(false);
  updateCruise((cruise) => {
    cruise.entries.push(
      { id: 'none', t: new Date(NOW).toISOString(), v: {} },
      {
        id: 'typed',
        t: new Date(NOW).toISOString(),
        v: { pos: { lat: 0, lon: 0, text: 'Hvar' } },
      },
    );
  });
  expect(await enrichEntry('none')).toBe(false);
  expect(await enrichEntry('typed')).toBe(false);
  expect(await enrichEntry('missing')).toBe(false);
});

test('the pending weather is filled entry by entry, failures counted out', async () => {
  openCruise(false);
  updateCruise((cruise) => {
    for (const id of ['a', 'b', 'c']) {
      cruise.entries.push({
        id,
        t: new Date(NOW).toISOString(),
        v:
          id === 'c'
            ? {}
            : { pos: { lat: id === 'a' ? 43.5 : 43.6, lon: 16.5 } },
        needWx: true,
      });
    }
    cruise.entries.push({ id: 'done', t: new Date(NOW).toISOString(), v: {} });
  });
  stubFetch((url) => (url.includes('43.600') ? null : answer(HOURLY)));
  const labels: string[] = [];
  await fillPendingWeather((label) => labels.push(label));
  expect(labels).toStrictEqual([
    '⏳ Météo 1 / 3…',
    '⏳ Météo 2 / 3…',
    '⏳ Météo 3 / 3…',
  ]);
  expect(state.view.toast.value?.message).toBe('Météo ajoutée à 1 entrée');
  const pending = state.data.cruise.value?.entries
    .filter((entry) => entry.needWx)
    .map((entry) => entry.id);
  expect(pending).toStrictEqual(['b', 'c']);
});

test('without network nothing is asked', async () => {
  openCruise(false);
  vi.stubGlobal('navigator', { onLine: false });
  const urls = stubFetch(() => null);
  await fillPendingWeather();
  expect(urls).toStrictEqual([]);
  expect(state.view.toast.value?.message).toBe('Pas de réseau pour le moment');
});
