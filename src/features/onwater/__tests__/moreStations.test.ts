import { expect, test } from 'vitest';

import {
  DHMZ,
  IPMA,
  SMHI,
  dhmzReadingsOf,
  ipmaReading,
  smhiReadingsOf,
  touches,
  zagrebTime,
} from '../moreStations.ts';

const NOW = Date.UTC(2026, 10, 15, 13, 30);
const KN = 3600 / 1852;

test('a network is read only when the circle touches its country', () => {
  expect(touches({ lat: 38.7, lon: -9.2 }, 60, [30, -32, 42.3, -6])).toBe(true);
  expect(touches({ lat: 48.6, lon: -2 }, 60, [30, -32, 42.3, -6])).toBe(false);
});

test('an IPMA station: its latest hour with wind, its eight points', () => {
  const reading = ipmaReading(
    {
      '2026-11-15T11:00': { 1: { intensidadeVento: 3, idDireccVento: 5 } },
      '2026-11-15T12:00': {
        1: { intensidadeVento: 4.2, idDireccVento: 6, pressao: 1019.4 },
      },
      '2026-11-15T13:00': { 1: { intensidadeVento: -99 } },
    },
    { id: '1', name: 'Lisboa', lat: 38.7, lon: -9.2 },
    3,
    NOW,
  );
  expect(reading?.net).toBe(IPMA);
  expect(reading?.t).toBe(Date.UTC(2026, 10, 15, 12));
  expect(reading?.avg).toBeCloseTo(4.2 * KN);
  expect(reading?.dir).toBe(225);
  expect(reading?.baro).toBe(1019.4);
});

test('the SMHI stations: speed, direction and gusts joined by station', () => {
  const at = NOW - 30 * 60_000;
  const [reading] = smhiReadingsOf(
    {
      station: [
        {
          key: '98230',
          name: 'Stockholm',
          latitude: 59.34,
          longitude: 18.06,
          value: [{ date: at, value: '6.2' }],
        },
      ],
    },
    { station: [{ key: '98230', value: [{ date: at, value: '190' }] }] },
    { station: [{ key: '98230', value: [{ date: at, value: '11.5' }] }] },
    { lat: 59.33, lon: 18.07 },
    60,
    10,
    NOW,
  );
  expect(reading?.net).toBe(SMHI);
  expect(reading?.avg).toBeCloseTo(6.2 * KN);
  expect(reading?.gust).toBeCloseTo(11.5 * KN);
  expect(reading?.dir).toBe(190);
});

test('the DHMZ stations of Croatia, their hour of Zagreb', () => {
  expect(new Date(zagrebTime('15.11.2026', 17)).toISOString()).toBe(
    '2026-11-15T16:00:00.000Z',
  );
  const xml =
    '<Hrvatska><DatumTermin><Datum>15.11.2026</Datum><Termin>17</Termin></DatumTermin><Grad autom="0"><GradIme>Split-aerodrom</GradIme><Lat>43.539</Lat><Lon>16.298 </Lon><Podatci><Temp> 14.1</Temp><Tlak>1012.3</Tlak><VjetarSmjer>NE</VjetarSmjer><VjetarBrzina> 5.8</VjetarBrzina></Podatci></Grad></Hrvatska>';
  const [reading] = dhmzReadingsOf(
    xml,
    { lat: 43.51, lon: 16.44 },
    60,
    5,
    Date.UTC(2026, 10, 15, 16, 40),
  );
  expect(reading?.net).toBe(DHMZ);
  expect(reading?.avg).toBeCloseTo(5.8 * KN);
  expect(reading?.dir).toBe(45);
  expect(reading?.baro).toBe(1012.3);
});
