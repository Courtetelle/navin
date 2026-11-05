import { expect, test } from 'vitest';

import type { Day } from '../../../model/types.ts';
import type { WeatherNow } from '../weatherLogic.ts';
import {
  applyWeather,
  capeRisk,
  forecastRows,
  wxSummary,
} from '../weatherLogic.ts';

const MEASURE = {
  tws: 12.4,
  gust: 18.9,
  twd: 45.2,
  baro: 1013.4,
  air: 21.34,
  rain: 0,
  at: 1_784_000_000_000,
  station: 'Bouveret',
  km: 3.2,
  src: 'Mesure MeteoSwiss, station Bouveret (3 km), 10:20',
};

const FORECAST = {
  src: 'Modèle MeteoSwiss ICON-CH1',
  rows: [
    {
      t: 1_784_000_000_000,
      tws: 10,
      twd: 200,
      gust: 15,
      air: 20.5,
      rain: 0.2,
      cape: 900,
    },
  ],
};

test('capeRisk grades the thunderstorm risk', () => {
  expect(capeRisk(null)).toBe('');
  expect(capeRisk(299)).toBe('');
  expect(capeRisk(300)).toBe('orage ?');
  expect(capeRisk(800)).toBe('⚡ orage');
  expect(capeRisk(1500)).toBe('⚡⚡ orage fort');
});

test('wxSummary prefers the measure, then the forecast', () => {
  expect(wxSummary(null)).toBe('');
  expect(wxSummary({ at: 0, meas: MEASURE, fc: FORECAST })).toBe(
    'vent 12 nd · 4 Bf (23 km/h) du 045°, rafales 19 nd · 5 Bf (35 km/h), 21,3 °C (Mesure MeteoSwiss, station Bouveret (3 km), 10:20)',
  );
  expect(wxSummary({ at: 0, meas: null, fc: FORECAST })).toBe(
    'vent 10 nd · 3 Bf (19 km/h) du 200°, rafales 15 nd · 4 Bf (28 km/h) (Modèle MeteoSwiss ICON-CH1)',
  );
  expect(wxSummary({ at: 0, meas: null, fc: null })).toBe('');
});

test('applyWeather fills the empty wind fields without replacing typed ones', () => {
  const day: Day = { fVentVit: '8', fRafales: '' };
  const weather: WeatherNow = { at: 5, meas: MEASURE, fc: null };
  applyWeather(day, weather);
  expect(day).toStrictEqual({
    fVentVit: '8',
    fRafales: '19',
    wxNow: weather,
    fVentDir: '45',
    fAir: '21,3',
    wxSource: MEASURE.src,
  });
});

test('applyWeather falls back on the forecast', () => {
  const day: Day = {};
  applyWeather(day, { at: 5, meas: null, fc: FORECAST });
  expect(day.fVentVit).toBe('10');
  expect(day.fAir).toBe('20,5');
  expect(day.wxSource).toBe(FORECAST.src);
});

test('forecastRows keeps eight rows from half an hour before the update', () => {
  const rows = Array.from({ length: 12 }, (_, hour) => ({
    t: hour * 3_600_000,
    tws: 1,
    twd: 1,
    gust: 1,
    air: 1,
    rain: 0,
    cape: 0,
  }));
  const shown = forecastRows({
    at: 2 * 3_600_000,
    meas: null,
    fc: { src: 'x', rows },
  });
  expect(shown.map((row) => row.t / 3_600_000)).toStrictEqual([
    2, 3, 4, 5, 6, 7, 8, 9,
  ]);
});
