import { expect, test } from 'vitest';

import type { Cruise, Entry } from '../../../model/types.ts';
import { journalExtract, journalFull } from '../journal.ts';

const DAY = '2026-07-15';

function entry(time: string, values: Entry['v'], automatic = false): Entry {
  const base = { id: time, t: `${DAY}T${time}:00+02:00`, v: values };
  return automatic ? { ...base, auto: true } : base;
}

function cruiseWith(entries: Entry[]): Cruise {
  return {
    id: 'c',
    created: `${DAY}T08:00:00+02:00`,
    info: {},
    crew: [],
    entries,
    days: {},
  };
}

test('no entry gives no extract', () => {
  expect(journalExtract(DAY, cruiseWith([]))).toStrictEqual([]);
});

test('a row tells the time, the events and the details', () => {
  const cruise = cruiseWith([
    entry('08:40', {
      evt: ['Départ'],
      cog: 45,
      sog: 5.2,
      tws: 12,
      twd: 220,
      allure: 'Largue',
      gv: '1 ris',
      note: 'Belle brise',
    }),
  ]);
  expect(journalExtract(DAY, cruise)).toStrictEqual([
    {
      time: '08:40',
      what: 'Départ',
      more: '06:40 UTC · cap 045° · 5,2 nd · vent 12 nd · 4 Bf (22 km/h) du 220° · Largue · GV 1 ris · … · Belle brise',
    },
  ]);
});

test('a manual entry wins over an automatic one in its slot', () => {
  const cruise = cruiseWith([
    entry('09:00', { evt: ['Départ'] }),
    entry('09:14', {}, true),
    entry('09:20', { note: 'à la main' }),
    entry('09:50', {}, true),
    entry('10:00', { evt: ['Arrivée'] }),
  ]);
  const times = journalExtract(DAY, cruise).map((row) => row.time);
  expect(times).toStrictEqual(['09:00', '09:20', '09:50', '10:00']);
});

test('without arrival the last entry closes the extract', () => {
  const cruise = cruiseWith([entry('09:00', {}), entry('09:10', {}, true)]);
  const rows = journalExtract(DAY, cruise);
  expect(rows.map((row) => row.what)).toStrictEqual([
    'Entrée',
    'Point de route',
  ]);
});

test('the full journal drops automatic points without news', () => {
  const cruise = cruiseWith([
    entry('09:00', { cog: 100 }, true),
    entry('09:05', { cog: 105 }, true),
    entry('09:10', { cog: 130 }, true),
    entry('09:12', { cog: 131 }, true),
    entry('09:20', { note: 'bouée' }, true),
    entry('09:30', { cog: 131 }, true),
    entry('09:50', { cog: 131 }, true),
  ]);
  const times = journalFull(DAY, cruise).map((row) => row.time);
  expect(times).toStrictEqual(['09:00', '09:10', '09:20', '09:50']);
});
