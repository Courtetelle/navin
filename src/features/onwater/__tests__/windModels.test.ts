import { expect, test } from 'vitest';

import type { MarineReply, ModelReply } from '../windModels.ts';
import {
  marineState,
  modelReading,
  stationReading,
  windRegion,
} from '../windModels.ts';

const NOW = Date.UTC(2026, 6, 15, 8, 30);

// The recorded replies, read as the API sends them.
const MODEL_REPLY = JSON.parse(
  '{"current":{"time":"2026-07-15T08:30","wind_speed_10m":12.5,"wind_gusts_10m":20,"wind_direction_10m":310}}',
) as ModelReply;
const MODEL_REPLY_NO_GUST = JSON.parse(
  '{"current":{"wind_speed_10m":3,"wind_gusts_10m":null}}',
) as ModelReply;
const MARINE_REPLY = JSON.parse(
  '{"hourly":{"time":["2026-07-15T07:00","2026-07-15T08:00","2026-07-15T09:00"],"wave_height":[0.2,null,1.26]}}',
) as MarineReply;

test('stationReading takes the newest row with wind, turned into knots', () => {
  const rows = [
    { t: NOW - 1_200_000, fu3010z0: '18.5', fu3010z1: '37.0', dkl010z0: '45' },
    { t: NOW - 600_000, fu3010z0: null, fu3010z1: null, dkl010z0: null },
  ];
  expect(stationReading(rows, 'Bouveret', 3.2, NOW)).toStrictEqual({
    name: 'Bouveret',
    km: 3.2,
    t: NOW - 1_200_000,
    avg: 18.5 / 1.852,
    gust: 37 / 1.852,
    dir: 45,
  });
});

test('stationReading refuses a reading older than 40 minutes', () => {
  const rows = [{ t: NOW - 2_400_001, fu3010z0: '10' }];
  expect(stationReading(rows, 'X', 1, NOW)).toBeNull();
  expect(stationReading([], 'X', 1, NOW)).toBeNull();
});

test('modelReading reads the Open-Meteo reply', () => {
  expect(
    modelReading(MODEL_REPLY, ['icon_eu', 'DWD ICON-EU 7 km'], 0),
  ).toStrictEqual({
    name: 'DWD ICON-EU 7 km',
    model: 'icon_eu',
    t: NOW,
    avg: 12.5,
    gust: 20,
    dir: 310,
  });
});

test('modelReading without wind is no reading; without time it is now', () => {
  expect(modelReading({}, ['', 'x'], NOW)).toBeNull();
  const reading = modelReading(MODEL_REPLY_NO_GUST, ['', 'x'], NOW);
  expect(reading?.t).toBe(NOW);
  expect(reading?.gust).toBeNull();
  expect(reading?.dir).toBeNull();
});

test('marineState takes the wave height of the closest hour', () => {
  expect(marineState(MARINE_REPLY, NOW)).toStrictEqual({
    waveH: 1.3,
    douglas: 4,
  });
  expect(marineState({}, NOW)).toBeNull();
});

test('windRegion picks the first box containing the position', () => {
  expect(windRegion({ lat: 43, lon: 6 })?.name).toBe('France');
  expect(windRegion({ lat: 43.5, lon: 16.4 })?.name).toBe(
    'Italie, Adriatique, Ionienne',
  );
  const aegean = windRegion({ lat: 37, lon: 25 });
  expect(aegean?.bias).toBe(5);
  expect(aegean?.max).toBe(true);
  expect(windRegion({ lat: 10, lon: 10 })).toBeNull();
});
