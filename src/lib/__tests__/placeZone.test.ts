import { expect, test } from 'vitest';

import { placeTimeText, placeZone } from '../placeZone.ts';

test.each([
  ['Léman', 46.43, 6.55, 'Europe/Paris'],
  ['Toulon', 43.1, 5.93, 'Europe/Paris'],
  ['Brest', 48.38, -4.49, 'Europe/Paris'],
  ['Boulogne', 50.72, 1.6, 'Europe/Paris'],
  ['Calais', 50.95, 1.85, 'Europe/Paris'],
  ['Dover', 51.13, 1.3, 'Europe/London'],
  ['Cowes', 50.76, -1.3, 'Europe/London'],
  ['Lisbonne', 38.7, -9.15, 'Europe/Lisbon'],
  ['Huelva', 37.25, -6.95, 'Europe/Paris'],
  ['Tenerife', 28.4, -16.3, 'Atlantic/Canary'],
  ['Majorque', 39.57, 2.65, 'Europe/Paris'],
  ['Alger', 36.77, 3.06, 'Africa/Algiers'],
  ['Tanger', 35.78, -5.8, 'Africa/Casablanca'],
  ['Tunis', 36.8, 10.18, 'Africa/Tunis'],
  ['Malte', 35.9, 14.5, 'Europe/Paris'],
  ['Corfou', 39.62, 19.92, 'Europe/Athens'],
  ['Sarandë', 39.87, 20, 'Europe/Paris'],
  ['Le Pirée', 37.94, 23.64, 'Europe/Athens'],
  ['Rhodes', 36.43, 28.2, 'Europe/Athens'],
  ['Bodrum', 37.03, 29.43, 'Europe/Istanbul'],
  ['Helsinki', 60.17, 24.94, 'Europe/Athens'],
  ['Stockholm', 59.33, 18.07, 'Europe/Paris'],
])('%s lies in %s', (_name, lat, lon, zone) => {
  expect(placeZone(lat, lon)).toBe(zone);
});

test('out of the table, the nautical zone', () => {
  expect(placeZone(10, -60)).toBe('Etc/GMT+4');
  expect(placeZone(-20, 57.5)).toBe('Etc/GMT-4');
  expect(placeZone(5, -3)).toBe('Etc/GMT');
});

test('the legal time follows summer time', () => {
  expect(placeTimeText(new Date('2026-07-15T08:30:00Z'), 46.43, 6.55)).toBe(
    '10:30',
  );
  expect(placeTimeText(new Date('2026-11-09T08:30:00Z'), 46.43, 6.55)).toBe(
    '09:30',
  );
  expect(placeTimeText(new Date('2026-11-09T08:30:00Z'), 38.7, -9.15)).toBe(
    '08:30',
  );
  expect(placeTimeText(new Date('2026-11-09T08:30:00Z'), 37.94, 23.64)).toBe(
    '10:30',
  );
});
