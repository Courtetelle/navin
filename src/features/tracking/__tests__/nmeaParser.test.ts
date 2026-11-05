import { expect, test } from 'vitest';

import { nmeaTrueWind, parseNmeaSentence } from '../nmeaParser.ts';

test('RMC gives position, speed, course and date', () => {
  const sentence = parseNmeaSentence(
    '$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A',
  );
  expect(sentence).toStrictEqual({
    hms: '123519',
    lat: 48 + 7.038 / 60,
    lon: 11 + 31 / 60,
    sog: 22.4,
    cog: 84.4,
    dmy: '230394',
    fix: true,
  });
});

test('RMC in the southern and western hemispheres gives negative coordinates', () => {
  const sentence = parseNmeaSentence(
    '$GPRMC,123519,A,4807.038,S,01131.000,W,,,230394,,',
  );
  expect(sentence?.lat).toBe(-(48 + 7.038 / 60));
  expect(sentence?.lon).toBe(-(11 + 31 / 60));
  expect(sentence?.sog).toBeNull();
  expect(sentence?.cog).toBeNull();
});

test('an invalid RMC only keeps the time', () => {
  expect(
    parseNmeaSentence(
      '$GPRMC,123519,V,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W',
    ),
  ).toStrictEqual({ hms: '123519' });
});

test('GGA gives the position, unless the fix quality is 0', () => {
  expect(
    parseNmeaSentence(
      '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47',
    ),
  ).toStrictEqual({
    hms: '123519',
    lat: 48 + 7.038 / 60,
    lon: 11 + 31 / 60,
    fix: true,
  });
  expect(
    parseNmeaSentence(
      '$GPGGA,123519,4807.038,N,01131.000,E,0,08,0.9,545.4,M,46.9,M,,',
    ),
  ).toStrictEqual({ hms: '123519' });
});

test('GLL accepts a missing status and rejects a void one', () => {
  expect(
    parseNmeaSentence('$GPGLL,4916.45,N,12311.12,W,225444,A'),
  ).toStrictEqual({
    lat: 49 + 16.45 / 60,
    lon: -(123 + 11.12 / 60),
    hms: '225444',
    fix: true,
  });
  expect(
    parseNmeaSentence('$GPGLL,4916.45,N,12311.12,W,225444,V'),
  ).toStrictEqual({});
});

test('VTG gives the course and the speed in knots', () => {
  expect(
    parseNmeaSentence('$GPVTG,054.7,T,034.4,M,005.5,N,010.2,K*48'),
  ).toStrictEqual({ cog: 54.7, sog: 5.5 });
});

test('HDT, HDM and HDG give the heading, HDG corrected by the variation', () => {
  expect(parseNmeaSentence('$HEHDT,274.07,T*19')).toStrictEqual({
    hdg: 274.07,
  });
  expect(parseNmeaSentence('$HCHDM,238.5,M')).toStrictEqual({ hdg: 238.5 });
  expect(parseNmeaSentence('$HCHDG,98.5,0.0,E,12.5,W')).toStrictEqual({
    hdg: 86,
  });
  expect(parseNmeaSentence('$HCHDG,358.5,,,5,E')).toStrictEqual({ hdg: 3.5 });
});

test('VHW gives the speed through water and the heading when present', () => {
  expect(parseNmeaSentence('$VWVHW,120.0,T,,M,6.3,N,11.7,K')).toStrictEqual({
    stw: 6.3,
    hdg: 120,
  });
  expect(parseNmeaSentence('$VWVHW,,T,,M,6.3,N,11.7,K')).toStrictEqual({
    stw: 6.3,
  });
});

test('MWV gives the apparent or true wind, signed, in knots', () => {
  expect(parseNmeaSentence('$WIMWV,45.0,R,12.0,N,A')).toStrictEqual({
    aws: 12,
    awa: 45,
  });
  expect(parseNmeaSentence('$WIMWV,300.0,T,5.0,M,A')).toStrictEqual({
    tws: 5 * 1.943_844,
    twa: -60,
  });
  expect(parseNmeaSentence('$WIMWV,10.0,R,18.52,K,A')).toStrictEqual({
    aws: 10,
    awa: 10,
  });
  expect(parseNmeaSentence('$WIMWV,300.0,T,5.0,M,V')).toStrictEqual({});
  expect(parseNmeaSentence('$WIMWV,,T,5.0,M,A')).toStrictEqual({});
});

test('MWD gives the true wind direction and the speed in m/s field', () => {
  expect(parseNmeaSentence('$WIMWD,180.0,T,,M,12.0,N,5.5,M')).toStrictEqual({
    twd: 180,
    tws: 12,
  });
});

test('DPT adds a positive transducer offset; DBT and DBS read the metres', () => {
  expect(parseNmeaSentence('$SDDPT,12.5,0.5')).toStrictEqual({ depth: 13 });
  expect(parseNmeaSentence('$SDDPT,12.5,-0.5')).toStrictEqual({ depth: 12.5 });
  expect(parseNmeaSentence('$SDDPT,,0.5')).toStrictEqual({});
  expect(parseNmeaSentence('$SDDBT,40.1,f,12.2,M,6.7,F')).toStrictEqual({
    depth: 12.2,
  });
  expect(parseNmeaSentence('$SDDBS,40.1,f,11.8,M,6.7,F')).toStrictEqual({
    depth: 11.8,
  });
  expect(parseNmeaSentence('$SDDBT,40.1,f,,M,6.7,F')).toStrictEqual({});
});

test('MTW gives the water temperature', () => {
  expect(parseNmeaSentence('$YXMTW,18.5,C')).toStrictEqual({ wtemp: 18.5 });
});

test('a wrong checksum is rejected, an unreadable one is ignored', () => {
  expect(parseNmeaSentence('$HEHDT,274.07,T*1A')).toBeNull();
  expect(parseNmeaSentence('$HEHDT,274.07,T*ZZ')).toStrictEqual({
    hdg: 274.07,
  });
});

test('text before the sentence is skipped; unknown sentences give null', () => {
  expect(parseNmeaSentence('12:00:01 $HEHDT,274.07,T*19')).toStrictEqual({
    hdg: 274.07,
  });
  expect(parseNmeaSentence('$GPXXX,1,2')).toBeNull();
  expect(parseNmeaSentence('nothing')).toBeNull();
  expect(parseNmeaSentence('')).toBeNull();
});

test('short time and coordinates are ignored', () => {
  expect(parseNmeaSentence('$GPRMC,1235,A,48,N,,E,5,6,23039')).toStrictEqual({
    lat: null,
    lon: null,
    sog: 5,
    cog: 6,
    fix: true,
  });
});

test('the true wind comes from the apparent wind and the boat speed', () => {
  const wind = nmeaTrueWind(10, 90, 10, 0);
  expect(wind?.tws).toBeCloseTo(14.142_136, 6);
  expect(wind?.twa).toBeCloseTo(135, 9);
  expect(wind?.twd).toBeCloseTo(135, 9);
  expect(nmeaTrueWind(10, -90, 0, 350)?.twd).toBeCloseTo(260, 9);
  expect(nmeaTrueWind(10, 45, 5, null)?.twd).toBeNull();
  expect(nmeaTrueWind(null, 45, 5, 0)).toBeNull();
  expect(nmeaTrueWind(10, null, 5, 0)).toBeNull();
});
