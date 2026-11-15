import { expect, test } from 'vitest';

import type { HubStation } from '../euStations.ts';
import {
  ITALIA_METEO,
  PUERTOS,
  SOCIB,
  hubReading,
  nearItaly,
  opendapValues,
  portusReading,
  portusStations,
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
