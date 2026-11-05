import { expect, test } from 'vitest';

import type { Cruise, Entry } from '../../../../model/types.ts';
import { engineFigures, lochSuggestion, milesFigures } from '../calcValues.ts';

function cruiseWith(partial: Partial<Cruise>): Cruise {
  return {
    id: 'c',
    created: '2026-07-14T07:00:00.000Z',
    info: {},
    crew: [],
    entries: [],
    days: {},
    ...partial,
  };
}

const entry = (t: string, loch: string | number): Entry => ({
  id: t,
  t,
  v: { loch },
});

test('engine figures: hours, litres and fuel left', () => {
  const cruise = cruiseWith({
    info: { moteurInit: '1515', conso: 3, conso2: '1,5', fuelInit: '200' },
    days: {
      '2026-07-14': { plein: '20' },
      '2026-07-15': { plein: '10' },
      '2026-07-16': { plein: '99' },
    },
  });
  expect(
    engineFigures(cruise, { moteurSoir: '1520,5' }, '2026-07-15'),
  ).toStrictEqual({
    evening: 1520.5,
    start: 1515,
    hours: 5.5,
    consumption: 4.5,
    burnt: 24.75,
    refuelled: 30,
    loaded: 230,
    available: 205.25,
    incomplete: false,
  });
});

test('engine figures without the data of departure', () => {
  const figures = engineFigures(cruiseWith({}), {}, '2026-07-15');
  expect(figures).toStrictEqual({
    evening: null,
    start: null,
    hours: null,
    consumption: null,
    burnt: null,
    refuelled: 0,
    loaded: null,
    available: null,
    incomplete: true,
  });
});

test('loch suggestion starts from the last reading before the day', () => {
  const cruise = cruiseWith({
    entries: [
      entry('2026-07-14T09:00:00.000Z', 10),
      entry('2026-07-15T08:00:00.000Z', '12,5'),
      entry('2026-07-15T12:00:00.000Z', 20.26),
    ],
  });
  expect(lochSuggestion(cruise, '2026-07-15')).toBe(10.3);
  expect(lochSuggestion(cruise, '2026-07-14')).toBeNull();
  expect(lochSuggestion(cruise, '2026-07-16')).toBeNull();
});

test('loch suggestion on the first day starts from its first reading', () => {
  const cruise = cruiseWith({
    entries: [
      entry('2026-07-15T08:00:00.000Z', 12),
      entry('2026-07-15T12:00:00.000Z', 15),
    ],
  });
  expect(lochSuggestion(cruise, '2026-07-15')).toBe(3);
});

test('miles figures: previous days and engine share', () => {
  const cruise = cruiseWith({
    info: { moteurInit: '100', vMoteur: 5 },
    days: {
      '2026-07-13': { nmJour: '10', moteurSoir: '101' },
      '2026-07-14': { nmJour: '20,5', moteurSoir: '102' },
      '2026-07-15': {},
    },
  });
  expect(
    milesFigures(cruise, { nmJour: '4', moteurSoir: '103' }, '2026-07-15'),
  ).toStrictEqual({
    previous: 30.5,
    today: 4,
    speed: 5,
    engineTotal: 15,
    engineToday: 5,
    suggestion: null,
  });
});
