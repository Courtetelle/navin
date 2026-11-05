import { expect, test } from 'vitest';

import {
  dayKey,
  fmtDate,
  fmtDur,
  fmtShortDate,
  fmtTime2,
  fmtTime,
  fr,
  keyToDate,
  num,
  pad,
  stringOf,
  textOf,
} from '../format.ts';
import { angDiff, bearing, distKm, distNM, fmtCoord, fmtPos } from '../geo.ts';
import { bft, kmh, knOk, windConv, windParts, windTxt } from '../wind.ts';

test('number parsing and French formatting', () => {
  expect([
    num('1,5'),
    num(' '),
    num('abc'),
    num(0),
    num(null),
    num(''),
  ]).toStrictEqual([1.5, 0, null, 0, null, null]);
  expect([fr(1.25), fr(null), fr(3, 0), pad(7), pad(7, 3)]).toStrictEqual([
    '1,3',
    '–',
    '3',
    '07',
    '007',
  ]);
  expect([
    textOf(0),
    textOf('a'),
    textOf(12),
    stringOf(['a', null, 2]),
    stringOf({}),
    stringOf(true),
  ]).toStrictEqual(['', 'a', '12', 'a,,2', '[object Object]', 'true']);
});

test('dates and durations', () => {
  const date = new Date(2026, 6, 15, 9, 5);
  expect([
    fmtTime(date),
    fmtShortDate(date),
    dayKey(date),
    fmtDur(5 * 3600e3 + 7 * 60e3),
    fmtDur(-5),
  ]).toStrictEqual(['09:05', '15/07/2026', '2026-07-15', '5 h 07', '0 h 00']);
  expect(fmtDate(date)).toBe('mercredi 15 juillet 2026');
  expect(keyToDate('2026-07-15').getHours()).toBe(12);
  expect(fmtTime2(new Date('2026-07-15T08:30:00Z'))).toMatch(
    /^\d{2}:30 \(08:30 UTC\)$/,
  );
});

test('wind in knots, Beaufort and km/h', () => {
  expect([
    windTxt('12'),
    windTxt('3,4'),
    windTxt(''),
    windConv(25),
    bft(0.4),
    bft(63.4),
    bft(64),
    kmh(10),
    knOk('x'),
  ]).toStrictEqual([
    '12 nd · 4 Bf (22 km/h)',
    '3 nd · 1 Bf (6 km/h)',
    '',
    '6 Bf · 46 km/h',
    0,
    11,
    12,
    19,
    false,
  ]);
  expect(windParts('17,6')).toStrictEqual({ knots: 18, beaufort: 5, kmh: 33 });
});

test('positions, distances and bearings', () => {
  expect([
    fmtCoord(46.5049, true),
    fmtCoord(6.4968, false),
    fmtCoord(-33.85, true),
    fmtCoord(-151.21, false),
  ]).toStrictEqual([
    "46°30,294' N",
    "006°29,808' E",
    "33°51,000' S",
    "151°12,600' W",
  ]);
  expect(fmtPos({ lat: 46.5049, lon: 6.4968 })).toBe(
    "46°30,294' N  006°29,808' E",
  );
  expect(fmtPos({ lat: 0, lon: 0, text: 'Port de Morges' })).toBe(
    'Port de Morges',
  );
  const morges = { lat: 46.5, lon: 6.5 };
  const rolle = { lat: 46.4, lon: 6.3 };
  expect(distNM(morges, rolle)).toBeCloseTo(10.222_425_836_038_875, 12);
  expect(bearing(morges, rolle)).toBeCloseTo(234.104_012_940_870_3, 10);
  expect([angDiff(350, 10), angDiff(90, 270)]).toStrictEqual([20, 180]);
  expect(distKm(46.5, 6.5, 46.4, 6.3)).toBeCloseTo(18.931_941_625_583_065, 12);
});
