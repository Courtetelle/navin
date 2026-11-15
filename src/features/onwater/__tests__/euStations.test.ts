import { expect, test } from 'vitest';

import type { HubStation, MetOfficeObservation } from '../euStations.ts';
import {
  AEMET,
  ITALIA_METEO,
  METAR,
  MET_OFFICE,
  NDBC,
  PUERTOS,
  SOCIB,
  aemetDegrees,
  aemetReading,
  hubReading,
  metOfficeReading,
  metarReading,
  ndbcReading,
  ndbcStations,
  nearBritain,
  nearItaly,
  nearSpain,
  opendapValues,
  portusReading,
  portusStations,
  relayed,
  socibReading,
} from '../euStations.ts';

const NOW = Date.UTC(2026, 10, 14, 23, 50);
const KN = 3600 / 1852;

test('an ItaliaMeteo station: its latest wind, gusts and name, UTC', () => {
  const station: HubStation = {
    stat: {
      lat: 44.45,
      lon: 8.9,
      net: 'dpcn-liguria',
      details: [{ var: 'B01019', val: 'T0065 - Castellaccio' }],
    },
    prod: [
      {
        var: 'B11002',
        val: [
          { val: 4, ref: '2026-11-14T23:00:00' },
          { val: 6, ref: '2026-11-14T23:30:00' },
        ],
      },
      { var: 'B11041', val: [{ val: 11, ref: '2026-11-14T23:30:00' }] },
      { var: 'B11001', val: [{ val: 20, ref: '2026-11-14T23:30:00' }] },
    ],
  };
  const reading = hubReading(station, 4, NOW);
  expect(reading?.name).toBe('Castellaccio');
  expect(reading?.net).toBe(ITALIA_METEO);
  expect(reading?.t).toBe(Date.UTC(2026, 10, 14, 23, 30));
  expect(reading?.avg).toBeCloseTo(6 * KN);
  expect(reading?.gust).toBeCloseTo(11 * KN);
  expect(reading?.dir).toBe(20);
  expect(reading?.amateur).toBeUndefined();
  const amateur = hubReading(
    { ...station, stat: { ...station.stat, net: 'mnw' } },
    4,
    NOW,
  );
  expect(amateur?.amateur).toBe(true);
  expect(hubReading(station, 4, NOW + 3 * 3_600_000)).toBeNull();
});

test('Italy is read only around Italy and its islands', () => {
  expect(nearItaly({ lat: 44.4, lon: 8.9 }, 30)).toBe(true);
  expect(nearItaly({ lat: 39.2, lon: 9.1 }, 30)).toBe(true);
  expect(nearItaly({ lat: 48.65, lon: -2.03 }, 30)).toBe(false);
});

test('a Puertos del Estado station: value over factor, UTC', () => {
  const [station] = portusStations([
    { id: 3851, nombre: 'Mareografo de Palma', latitud: 39.55, longitud: 2.64 },
  ]);
  if (!station) throw new Error('no station');
  const reading = portusReading(
    {
      fecha: '2026-11-14 23:48:00.0',
      datos: [
        { nombreColumna: 'vv_md', valor: '33', factor: 10 },
        { nombreColumna: 'dv_md', valor: '281', factor: 1 },
        { nombreColumna: 'vv_mx', valor: '61', factor: 10 },
      ],
    },
    station,
    3,
    NOW,
  );
  expect(reading?.net).toBe(PUERTOS);
  expect(reading?.t).toBe(Date.UTC(2026, 10, 14, 23, 48));
  expect(reading?.avg).toBeCloseTo(3.3 * KN);
  expect(reading?.gust).toBeCloseTo(6.1 * KN);
  expect(reading?.dir).toBe(281);
});

const SOCIB_REPLY = `Dataset {
    Float64 time[time = 1];
    Float64 WIN_SPE[time = 1];
} x;
---------------------------------------------
time[1]
1.7946972E9

WIN_SPE[1]
4.6

WIN_SPE_GUS[1]
6.6

WIN_DIR[1]
251.0

LAT, 39.870965
`;

test('a SOCIB station: the OPeNDAP values read, seconds since 1970', () => {
  const values = opendapValues(SOCIB_REPLY);
  expect(values.LAT).toStrictEqual([39.870965]);
  const reading = socibReading(
    values,
    { id: 'lamola', name: 'La Mola (Minorque)', lat: 39.87, lon: 4.31 },
    100,
    1_794_697_200_000 + 600_000,
  );
  expect(reading?.net).toBe(SOCIB);
  expect(reading?.avg).toBeCloseTo(4.6 * KN);
  expect(reading?.gust).toBeCloseTo(6.6 * KN);
  expect(reading?.dir).toBe(251);
});

test('AEMET: degrees, minutes, seconds; its latest hourly row, UTC', () => {
  expect(aemetDegrees('394337N')).toBeCloseTo(39.726_94, 4);
  expect(aemetDegrees('023654W')).toBeCloseTo(-2.615, 3);
  expect(Number.isNaN(aemetDegrees('x'))).toBe(true);
  const reading = aemetReading(
    [
      { fint: '2026-11-14T22:00:00', vv: 5, vmax: 9, dv: 250 },
      { fint: '2026-11-14T23:00:00+0000', vv: 6, vmax: 10, dv: 260 },
    ],
    { id: 'B278', name: 'PALMA', lat: 39.55, lon: 2.62 },
    3,
    NOW,
  );
  expect(reading?.net).toBe(AEMET);
  expect(reading?.t).toBe(Date.UTC(2026, 10, 14, 23));
  expect(reading?.avg).toBeCloseTo(6 * KN);
  expect(reading?.gust).toBeCloseTo(10 * KN);
});

test('Met Office: the latest observation of a land station', () => {
  const reading = metOfficeReading(
    JSON.parse(
      '[{"datetime":"2026-11-14T22:00Z","wind_speed":7,"wind_direction":230},{"datetime":"2026-11-14T23:00Z","wind_speed":8,"wind_gust":13,"wind_direction":240,"mslp":1012}]',
    ) as MetOfficeObservation[],
    { id: 'gcp', name: 'Solent', lat: 50.8, lon: -1.3 },
    5,
    NOW,
  );
  expect(reading?.net).toBe(MET_OFFICE);
  expect(reading?.avg).toBeCloseTo(8 * KN);
  expect(reading?.gust).toBeCloseTo(13 * KN);
  expect(reading?.baro).toBe(1012);
});

test('Spain and Britain are read only around them', () => {
  expect(nearSpain({ lat: 39.55, lon: 2.64 }, 30)).toBe(true);
  expect(nearSpain({ lat: 28.1, lon: -15.4 }, 30)).toBe(true);
  expect(nearSpain({ lat: 46.4, lon: 6.5 }, 30)).toBe(false);
  expect(nearBritain({ lat: 50.8, lon: -1.3 }, 30)).toBe(true);
  expect(nearBritain({ lat: 46.4, lon: 6.5 }, 30)).toBe(false);
});

test('through the relay: its address, the METAR of an airport', () => {
  expect(relayed('https://relay.example.dev/', 'https://a.b/c?d=1')).toBe(
    'https://relay.example.dev/?url=https%3A%2F%2Fa.b%2Fc%3Fd%3D1',
  );
  const reading = metarReading(
    {
      icaoId: 'LEPA',
      name: 'Palma De Mallorca Arpr, IB, ES',
      lat: 39.561,
      lon: 2.737,
      obsTime: NOW / 1000 - 1200,
      wdir: 260,
      wspd: 8,
      altim: 1017,
    },
    5,
    NOW,
  );
  expect(reading?.net).toBe(METAR);
  expect(reading?.name).toBe('Palma De Mallorca Arpr');
  expect(reading?.avg).toBe(8);
  expect(
    metarReading({ wspd: 5, lat: 1, lon: 1, obsTime: 0 }, 1, NOW),
  ).toBeNull();
});

test('the NOAA buoys: their list, the latest line of their text', () => {
  const [station] = ndbcStations(
    '<station id="62103" lat="49.9" lon="-2.9" name="Channel Lightship" met="y"/><station id="1" lat="1" lon="1" name="x" met="n"/>',
  );
  expect(station).toStrictEqual({
    id: '62103',
    name: 'Channel Lightship',
    lat: 49.9,
    lon: -2.9,
  });
  if (!station) throw new Error('no station');
  const text = `#YY  MM DD hh mm WDIR WSPD GST  WVHT   DPD   APD MWD   PRES  ATMP
#yr  mo dy hr mn degT m/s  m/s     m   sec   sec degT   hPa  degC
2026 11 14 23 00 210  8.8   MM    MM    MM    MM  MM 1006.3  11.1
2026 11 14 22 00 170  7.2   MM    MM    MM    MM  MM 1006.9  11.3`;
  const reading = ndbcReading(text, station, 20, NOW);
  expect(reading?.net).toBe(NDBC);
  expect(reading?.t).toBe(Date.UTC(2026, 10, 14, 23));
  expect(reading?.avg).toBeCloseTo(8.8 * KN);
  expect(reading?.gust).toBeNull();
  expect(reading?.dir).toBe(210);
  expect(reading?.baro).toBe(1006.3);
});
