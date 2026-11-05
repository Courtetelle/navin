import { expect, test } from 'vitest';

import { parseNmeaFile } from '../nmeaFile.ts';

const LAT = 48 + 7.038 / 60;
const LON = 11 + 31 / 60;

test('a dated position gives one point, with the speed and course of the sentence', () => {
  const { pts, name } = parseNmeaFile(
    '$GPRMC,120000,A,4807.038,N,01131.000,E,5.14,84.6,150726,,\r\n',
  );
  expect(name).toBe('');
  expect(pts).toStrictEqual([
    {
      lat: LAT,
      lon: LON,
      sog: 5.1,
      cog: 85,
      twd: null,
      tws: null,
      t: Date.UTC(2026, 6, 15, 12),
    },
  ]);
});

test('positions before the first date wait for it; undated files give nothing', () => {
  const gga = '$GPGGA,115959,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,';
  expect(parseNmeaFile(gga).pts).toStrictEqual([]);
  const { pts } = parseNmeaFile(
    `${gga}\n$GPRMC,120000,A,4807.038,N,01131.000,E,5,84,150726,,`,
  );
  expect(pts.map((point) => point.t)).toStrictEqual([
    Date.UTC(2026, 6, 15, 11, 59, 59),
    Date.UTC(2026, 6, 15, 12),
  ]);
});

test('two positions of the same second give one point', () => {
  const rmc = '$GPRMC,120000,A,4807.038,N,01131.000,E,5,84,150726,,';
  expect(parseNmeaFile(`${rmc}\n${rmc}`).pts).toHaveLength(1);
});

test('the time going back at midnight adds a day', () => {
  const { pts } = parseNmeaFile(
    [
      '$GPRMC,235959,A,4807.038,N,01131.000,E,5,84,150726,,',
      '$GPGGA,000001,4807.138,N,01131.100,E,1,08,0.9,545.4,M,46.9,M,,',
    ].join('\n'),
  );
  expect(pts[1]?.t).toBe(Date.UTC(2026, 6, 16, 0, 0, 1));
});

test('the true wind of the instruments is carried on the points', () => {
  const { pts } = parseNmeaFile(
    [
      '$WIMWD,180.4,T,,M,12.26,N,,',
      '$GPRMC,120000,A,4807.038,N,01131.000,E,5,84,150726,,',
    ].join('\n'),
  );
  expect(pts[0]?.twd).toBe(180);
  expect(pts[0]?.tws).toBe(12.3);
});

test('a true wind angle gives the direction from the heading', () => {
  const { pts } = parseNmeaFile(
    [
      '$HEHDT,350,T',
      '$WIMWV,30,T,10,N,A',
      '$GPRMC,120000,A,4807.038,N,01131.000,E,5,84,150726,,',
    ].join('\n'),
  );
  expect(pts[0]?.twd).toBe(20);
  expect(pts[0]?.tws).toBe(10);
});

test('the apparent wind gives the true wind with the boat speed', () => {
  const { pts } = parseNmeaFile(
    [
      '$HEHDT,0,T',
      '$VWVHW,,T,,M,10,N,,K',
      '$WIMWV,90,R,10,N,A',
      '$GPRMC,120000,A,4807.038,N,01131.000,E,5,84,150726,,',
    ].join('\n'),
  );
  expect(pts[0]?.twd).toBe(135);
  expect(pts[0]?.tws).toBe(14.1);
});

test('a position without the fix flag gives no point', () => {
  expect(
    parseNmeaFile('$GPRMC,120000,V,4807.038,N,01131.000,E,5,84,150726,,').pts,
  ).toStrictEqual([]);
});
