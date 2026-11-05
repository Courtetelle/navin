import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Cruise, EntryValues } from '../../../model/types.ts';
import {
  blankCruise,
  setCruise,
  setZoneSim,
  state,
  updateCruise,
} from '../../../state/index.ts';
import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import {
  applyWeather,
  enrichEntry,
  fetchWeather,
  fillPendingWeather,
} from '../weather.ts';
import { wxNext } from '../weatherSources.ts';

const NOW = Date.UTC(2026, 6, 15, 8, 30);
const HOURS = 24;

function series(value: number): number[] {
  return Array.from({ length: HOURS }, (_, hour) => value + hour);
}

const HOURLY = Object.fromEntries([
  ['time', ['2026-07-15T08:00', '2026-07-15T09:00']],
  ['wind_speed_10m', series(10)],
  ['wind_direction_10m', series(200)],
  ['wind_gusts_10m', series(20)],
  ['pressure_msl', series(1000)],
  ['temperature_2m', series(15)],
  ['precipitation', series(0)],
  ['cape', series(100)],
]);
const MARINE = Object.fromEntries([
  ['wave_height', series(1)],
  ['wave_direction', series(90)],
]);

function answer(hourly: unknown): Response {
  return Response.json({ hourly });
}

function stubFetch(handler: (url: string) => Response | null) {
  const urls: string[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    urls.push(url);
    const response = handler(url);
    return response
      ? Promise.resolve(response)
      : Promise.reject(new Error('offline'));
  });
  return urls;
}

function values(
  initial: EntryValues,
  weather: Parameters<typeof applyWeather>[1],
) {
  const result = structuredClone(initial);
  applyWeather(result, weather);
  return result;
}

function openCruise(lake: boolean): Cruise {
  const cruise = blankCruise('Essai');
  setCruise(cruise);
  setZoneSim(lake ? 'lac' : 'mer');
  return cruise;
}

beforeEach(() => {
  initState(createMemoryStorage());
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

test('in Switzerland the MeteoSwiss model comes first, with the hour rounded', async () => {
  openCruise(false);
  const urls = stubFetch((url) => {
    if (url.includes('marine-api')) return answer(MARINE);
    return url.includes('meteoswiss_icon_ch1') ? answer(HOURLY) : null;
  });
  const weather = await fetchWeather(
    46.5,
    6.6,
    new Date(Date.UTC(2026, 6, 15, 8, 30)),
  );
  expect(weather).toStrictEqual({
    twd: 209,
    tws: 19,
    gust: 29,
    baro: 1009,
    air: 24,
    cape: 109,
    waveDir: 99,
    waveH: 10,
    src: 'Prévision MeteoSwiss ICON-CH1 (via Open-Meteo)',
  });
  expect(urls[0]).toContain('latitude=46.500&longitude=6.600');
  expect(urls[0]).toContain('start_date=2026-07-15&end_date=2026-07-15');
  expect(urls).toHaveLength(2);
});

test('the CH2 model follows, then the European model', async () => {
  openCruise(false);
  const urls = stubFetch((url) => {
    if (url.includes('marine-api')) return null;
    if (url.includes('meteoswiss_icon_ch1')) {
      return answer(Object.fromEntries([['wind_speed_10m', [null]]]));
    }
    return url.includes('meteoswiss_icon_ch2') ? null : answer(HOURLY);
  });
  const weather = await fetchWeather(
    46.51,
    6.61,
    new Date(Date.UTC(2026, 6, 15, 23, 50)),
  );
  expect(weather.src).toBe('Prévision modèle européen (Open-Meteo)');
  expect(weather.tws).toBe(33);
  expect(weather.waveH).toBeNull();
  expect(urls).toHaveLength(4);
});

test('outside Switzerland only the European model is asked', async () => {
  openCruise(false);
  const urls = stubFetch((url) =>
    url.includes('marine-api') ? null : answer(HOURLY),
  );
  await fetchWeather(43.17, 16.44, new Date(NOW));
  expect(urls[0]).not.toContain('models=');
});

test('an old date uses the archive', async () => {
  openCruise(false);
  const urls = stubFetch((url) =>
    url.includes('marine-api') ? null : answer(HOURLY),
  );
  await fetchWeather(43.17, 16.45, new Date(Date.UTC(2026, 2, 1, 12)));
  expect(urls[0]).toContain('archive-api.open-meteo.com');
});

test('on a lake the recent measure of a station wins over the model', async () => {
  openCruise(true);
  store.set('ldb.smn.stations2', {
    at: NOW,
    list: [['LAK', 'Lac', 46.5, 6.6, 400]],
  });
  const csv = [
    'reference_timestamp;fu3010z0;fu3010z1;dkl010z0;pp0qffs0;tre200s0;rre150z0',
    '15.07.2026 08:30;18.52;;210;1013;;',
  ].join('\n');
  stubFetch(() => new Response(csv));
  const weather = await fetchWeather(46.5, 6.6, new Date(NOW));
  expect(weather.tws).toBe(10);
  expect(weather.waveDir).toBeNull();
  expect(weather.waveH).toBeNull();
  expect(weather.src).toBe('Mesure MeteoSwiss, station Lac (0 km), 10:30');
});

test('on a lake an entry older than 30 hours uses the model, without marine request', async () => {
  openCruise(true);
  const urls = stubFetch(() => answer(HOURLY));
  const weather = await fetchWeather(
    46.52,
    6.62,
    new Date(NOW - 31 * 3_600_000),
  );
  expect(weather.src).toBe('Prévision MeteoSwiss ICON-CH1 (via Open-Meteo)');
  expect(urls).toHaveLength(1);
});

test('the weather rejects without any source', async () => {
  openCruise(false);
  stubFetch(() => null);
  await expect(fetchWeather(43.3, 16.3, new Date(NOW))).rejects.toThrow(
    'offline',
  );
});

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

test('the forecast tries the Swiss models, then the European one', async () => {
  const urls = stubFetch((url) =>
    url.includes('models=') ? null : answer(HOURLY),
  );
  const forecast = await wxNext(46.5, 6.6, 2);
  expect(forecast?.src).toBe('Prévision modèle européen (Open-Meteo)');
  expect(forecast?.rows[1]).toStrictEqual({
    t: Date.UTC(2026, 6, 15, 9),
    tws: 11,
    twd: 201,
    gust: 21,
    air: 16,
    rain: 1,
    cape: 101,
  });
  expect(urls).toHaveLength(3);
  expect(urls[0]).toContain('forecast_hours=2');
});

test('without forecast the answer is null', async () => {
  stubFetch(() => null);
  expect(await wxNext(43, 16, 1)).toBeNull();
});
