import { afterEach, expect, test } from 'vitest';

import { dayText } from '../../features/voyages/voyageDates.ts';
import { whenLocal } from '../../model/zoneBulletin.ts';
import { shownOffset, utcClock, utcMark } from '../clockMode.ts';
import {
  bothTimes,
  fmtDateTime,
  fmtDotDateTime,
  fmtHhMm,
  fmtLocalTime,
  fmtTime,
  fmtTime2,
  fmtTimeShared,
  fromLocalInput,
  hms,
  logTimes,
  shownTimeOptions,
  toLocalInput,
  toPhoneInput,
} from '../format.ts';
import { timeSpans } from '../timeMatches.ts';

// Zurich in summer is UTC+2 (vitest runs in Europe/Zurich).
const SUMMER = new Date('2026-07-15T08:05:09Z');
// 00:30 in Zurich is still the day before in UTC.
const AFTER_MIDNIGHT = new Date('2026-07-15T22:30:00Z');

afterEach(() => {
  utcClock.value = false;
});

test('the phone time while the clock shows the zone time', () => {
  expect([
    fmtTime(SUMMER),
    fmtTime2(SUMMER),
    hms(SUMMER),
    bothTimes(SUMMER.toISOString()),
    fmtDotDateTime(SUMMER),
    fmtDateTime(AFTER_MIDNIGHT),
    fmtHhMm(SUMMER),
    fmtTimeShared(SUMMER),
    toLocalInput(SUMMER),
    utcMark(),
    shownOffset(7200),
    shownTimeOptions({ hour: '2-digit' }),
  ]).toStrictEqual([
    '10:05',
    '10:05 (08:05 UTC)',
    '10:05:09',
    '10:05:09 · 08:05:09 UTC',
    '15.07.2026 à 10h05',
    '16/07/2026 00:30',
    '10h05',
    '10:05',
    '2026-07-15T10:05',
    '',
    7200,
    { hour: '2-digit' },
  ]);
  expect(fromLocalInput('2026-07-15T10:05')).toBe(
    Date.parse('2026-07-15T08:05:00Z'),
  );
});

test('every time in UTC while the clock shows UTC', () => {
  utcClock.value = true;
  expect([
    fmtTime(SUMMER),
    fmtTime2(SUMMER),
    hms(SUMMER),
    bothTimes(SUMMER.toISOString()),
    fmtDotDateTime(SUMMER),
    fmtDateTime(AFTER_MIDNIGHT),
    fmtHhMm(SUMMER),
    fmtTimeShared(SUMMER),
    toLocalInput(SUMMER),
    utcMark(),
    shownOffset(7200),
    shownTimeOptions({ hour: '2-digit' }),
  ]).toStrictEqual([
    '08:05',
    '08:05 UTC',
    '08:05:09',
    '08:05:09 UTC',
    '15.07.2026 à 08h05',
    '15/07/2026 22:30',
    '8h05',
    '08:05 UTC',
    '2026-07-15T08:05',
    ' UTC',
    0,
    { hour: '2-digit', timeZone: 'UTC' },
  ]);
  // Typed in UTC, read back in UTC; files keep the phone's time.
  expect(fromLocalInput('2026-07-15T08:05')).toBe(
    Date.parse('2026-07-15T08:05:00Z'),
  );
  expect(fromLocalInput('')).toBeNaN();
  expect(fmtLocalTime(SUMMER)).toBe('10:05');
  expect(toPhoneInput(SUMMER)).toBe('2026-07-15T10:05');
});

test('the logs of SOS and man overboard say UTC when the clock does', () => {
  const iso = SUMMER.toISOString();
  expect([logTimes(iso, true), logTimes(iso, false)]).toStrictEqual([
    '10:05:09',
    '10:05:09 · 08:05:09 UTC',
  ]);
  utcClock.value = true;
  expect([logTimes(iso, true), logTimes(iso, false)]).toStrictEqual([
    '08:05:09 UTC',
    '08:05:09 UTC',
  ]);
});

test('the hours of a cruise and of a bulletin follow the clock', () => {
  expect(dayText('2027-06-12', '09:00')).toBe('Samedi 12/06/2027 · 09 h 00');
  expect(dayText('2027-06-12', '')).toBe('Samedi 12/06/2027');
  const now = Date.parse('2027-06-12T06:00:00Z');
  const at = Date.parse('2027-06-12T12:00:00Z');
  expect(whenLocal(at, now, 7200)).toBe('14 h');
  utcClock.value = true;
  expect(dayText('2027-06-12', '09:00')).toBe(
    'Samedi 12/06/2027 · 07 h 00 UTC',
  );
  // A departure at 00:30 is still the day before in UTC.
  expect(dayText('2027-06-12', '00:30')).toBe(
    'Vendredi 11/06/2027 · 22 h 30 UTC',
  );
  // Without an hour, the day as typed.
  expect(dayText('2027-06-12', '')).toBe('Samedi 12/06/2027');
  expect(whenLocal(at, now, 7200)).toBe('12 h UTC');
  expect(whenLocal(at, now, 7200, false)).toBe('12 h');
});

test('the times of day found in a text, never the durations', () => {
  const found = (text: string) =>
    timeSpans(text).map(([from, to]) => text.slice(from, to));
  expect(found('Départ 14:30 → 16:05:09, arrivée 9h05')).toStrictEqual([
    '14:30',
    '16:05:09',
    '9h05',
  ]);
  expect(found('vers 14 h UTC, puis sam. 23, 9 h 30 UTC')).toStrictEqual([
    '14 h UTC',
    '9 h 30 UTC',
  ]);
  expect(found('08:05 UTC et 08:05UTC')).toStrictEqual([
    '08:05 UTC',
    '08:05UTC',
  ]);
  expect(
    found(
      'durée 1 h 05, sur 6 h, échelle 1:25000, 46°27,609, 3:5, 24:00, v12:30, 12:3',
    ),
  ).toStrictEqual([]);
});
