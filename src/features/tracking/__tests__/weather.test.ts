import { afterEach, beforeEach, expect, test } from 'vitest';

import { store } from '../../../storage/store.ts';
import { fetchWeather } from '../weather.ts';
import { wxNext } from '../weatherSources.ts';

import {
  HOURLY,
  MARINE,
  NOW,
  answer,
  openCruise,
  setUpWeather,
  stubFetch,
  tearDownWeather,
} from './weatherSetup.ts';

beforeEach(setUpWeather);
afterEach(tearDownWeather);

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
