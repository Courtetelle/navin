import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import {
  parseMeasures,
  parseStations,
  smnMeasure,
  smnNow,
  smnStations,
} from '../smn.ts';

const NOW = Date.UTC(2026, 6, 15, 8, 30);
const STATIONS = [
  'station_abbr;station_name;station_coordinates_wgs84_lat;station_coordinates_wgs84_lon;station_height_masl',
  'PUY;Pully;46.512;6.667;456',
  'XXX;Sans position;n/a;;',
  'CGI;Nyon / Changins;46.401;6.228;',
].join('\r\n');
const MEASURES = [
  'station_abbr;reference_timestamp;fu3010z0;fu3010z1;dkl010z0;pp0qffs0;tre200s0;rre150z0',
  'PUY;15.07.2026 08:00;;;;;;',
  'PUY;15.07.2026 08:10;18.52;27.78;210;1013.2;22.5;0.1',
  'PUY;15.07.2026 08:20;9.26;;;;;',
  'PUY;bad date;1;2;3;4;5;6',
].join('\n');

function encoded(text: string): Response {
  return new Response(text);
}

beforeEach(() => {
  initState(createMemoryStorage());
  vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('the stations CSV gives abbreviation, name, position and altitude', () => {
  expect(parseStations(STATIONS)).toStrictEqual([
    ['PUY', 'Pully', 46.512, 6.667, 456],
    ['CGI', 'Nyon / Changins', 46.401, 6.228, 0],
  ]);
});

test('the measurements CSV keeps rows with a date, empty cells are null', () => {
  const rows = parseMeasures(MEASURES);
  expect(rows).toHaveLength(3);
  expect(rows[1]).toStrictEqual(
    Object.fromEntries([
      ['t', Date.UTC(2026, 6, 15, 8, 10)],
      ['station_abbr', 'PUY'],
      ['reference_timestamp', '15.07.2026 08:10'],
      ['fu3010z0', '18.52'],
      ['fu3010z1', '27.78'],
      ['dkl010z0', '210'],
      ['pp0qffs0', '1013.2'],
      ['tre200s0', '22.5'],
      ['rre150z0', '0.1'],
    ]),
  );
  expect(rows[0]?.fu3010z0).toBeNull();
});

test('without network the built-in shore stations are used', async () => {
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
  const stations = await smnStations();
  expect(stations.map(([abbreviation]) => abbreviation)).toStrictEqual([
    'CGI',
    'GVE',
    'BOU',
  ]);
});

test('the station list is kept 30 days in ldb.smn.stations2', async () => {
  const fetchMock = vi.fn(() => Promise.resolve(encoded(STATIONS)));
  vi.stubGlobal('fetch', fetchMock);
  await smnStations();
  expect(store.get('ldb.smn.stations2', null)).toStrictEqual({
    at: NOW,
    list: parseStations(STATIONS),
  });
  await smnStations();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('a station older than 30 days is fetched again, kept when offline', async () => {
  const list = [['OLD', 'Ancienne', 46.5, 6.6, 400]];
  store.set('ldb.smn.stations2', { at: NOW - 31 * 86_400_000, list });
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
  expect(await smnStations()).toStrictEqual(list);
});

test('the rows of a station are cached 5 minutes', async () => {
  const fetchMock = vi.fn(() => Promise.resolve(encoded(MEASURES)));
  vi.stubGlobal('fetch', fetchMock);
  const abbreviation = 'CACHE';
  await smnNow(abbreviation);
  await smnNow(abbreviation);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(
    'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/cache/ogd-smn_cache_t_now.csv',
  );
  vi.setSystemTime(NOW + 5 * 60_000);
  await smnNow(abbreviation);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('the measure is the closest in time of the closest station, in knots', async () => {
  store.set('ldb.smn.stations2', {
    at: NOW,
    list: [
      ['FAR', 'Loin', 47.5, 6.6, 400],
      ['NEAR', 'Proche', 46.5, 6.6, 400],
    ],
  });
  vi.stubGlobal('fetch', () => Promise.resolve(encoded(MEASURES)));
  const measure = await smnMeasure(
    46.5,
    6.61,
    new Date(Date.UTC(2026, 6, 15, 8, 12)),
  );
  expect(measure).toStrictEqual({
    tws: 10,
    gust: 15,
    twd: 210,
    baro: 1013.2,
    air: 22.5,
    rain: 0.1,
    at: Date.UTC(2026, 6, 15, 8, 10),
    station: 'Proche',
    km: expect.closeTo(0.765, 2) as number,
    src: 'Mesure MeteoSwiss, station Proche (1 km), 10:10',
  });
});

test('no measure beyond 25 km or 30 minutes', async () => {
  store.set('ldb.smn.stations2', {
    at: NOW,
    list: [['GAP', 'Proche', 46.5, 6.6, 400]],
  });
  vi.stubGlobal('fetch', () => Promise.resolve(encoded(MEASURES)));
  expect(await smnMeasure(47, 6.6, new Date(NOW))).toBeNull();
  expect(
    await smnMeasure(46.5, 6.6, new Date(Date.UTC(2026, 6, 15, 8, 51))),
  ).toBeNull();
  expect(
    await smnMeasure(46.5, 6.6, new Date(Date.UTC(2026, 6, 15, 8, 50))),
  ).not.toBeNull();
});
