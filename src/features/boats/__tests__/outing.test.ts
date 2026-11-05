import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import { initState, state, updateCruise } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import {
  autoFillLakeDay,
  hasTrace,
  navDur,
  outingTimes,
  rentalPrice,
} from '../outing.ts';

const DAY = '2026-07-15';
const PRICES = 'Journée semaine : 300\nJournée WE : 350\nSoir (dès 17h) : 180';

beforeEach(() => {
  useHarnessWorld();
  initState(createMemoryStorage(readFixture('sample-lake')));
});
afterEach(leaveHarnessWorld);

test('rental price: week day, weekend, evening', () => {
  expect(rentalPrice('2026-07-15T08:00:00.000Z', PRICES)).toBe('300');
  expect(rentalPrice('2026-07-18T08:00:00.000Z', PRICES)).toBe('350');
  expect(rentalPrice('2026-07-15T15:00:00.000Z', PRICES)).toBe('180');
  expect(rentalPrice('2026-07-15T08:00:00.000Z', '')).toBeNull();
  expect(rentalPrice('2026-07-15T08:00:00.000Z', 'Semaine : 299,60')).toBe(
    '300',
  );
});

test('outing times come from the entries of the day', () => {
  const times = outingTimes(DAY);
  expect(times).toStrictEqual({
    t0: Date.parse('2026-07-15T06:40:00.000Z'),
    t1: Date.parse('2026-07-15T08:05:00.000Z'),
    nm: times.nm,
    live: false,
  });
  expect(times.nm).toBeCloseTo(1.03, 1);
  expect(hasTrace(DAY)).toBe(true);
  expect(outingTimes('2026-07-10')).toStrictEqual({
    t0: null,
    t1: null,
    nm: 0,
    live: false,
  });
});

test('a tracked day today is live', () => {
  state.view.tracking.value = true;
  expect(outingTimes(DAY).live).toBe(true);
  expect(outingTimes('2026-07-10').live).toBe(false);
  state.view.tracking.value = false;
});

test('navigation time is empty on a day without navigation', () => {
  expect(navDur('2026-07-10')).toBe('');
});

test('auto fill writes the free values and remembers them', () => {
  updateCruise((cruise) => {
    cruise.days[DAY] = {};
  });
  const day = autoFillLakeDay(DAY);
  expect(day).toStrictEqual({
    _auto: {
      coSkipper: 'Camille Rochat',
      equipage: 'Noa Dubois',
      nmJour: day.nmJour,
      skipper: 'Thomas Keller',
      typeSortie: 'Entraînement',
    },
    coSkipper: 'Camille Rochat',
    equipage: 'Noa Dubois',
    nmJour: day.nmJour,
    skipper: 'Thomas Keller',
    typeSortie: 'Entraînement',
  });
  expect(day.nmJour).toBe('1,0');
});

test('auto fill never replaces a value corrected by hand', () => {
  autoFillLakeDay(DAY);
  updateCruise((cruise) => {
    const day = cruise.days[DAY];
    if (day) day.skipper = 'Léa Favre';
    cruise.crew = cruise.crew.slice(1);
  });
  const day = autoFillLakeDay(DAY);
  expect(day.skipper).toBe('Léa Favre');
  expect(day.coSkipper).toBe('Camille Rochat');
});

test('auto fill takes the engine hours of the previous evening', () => {
  updateCruise((cruise) => {
    cruise.days['2026-07-14'] = { moteurSoir: '1230,5' };
    cruise.days['2026-07-13'] = { moteurSoir: '1229' };
    cruise.days[DAY] = {};
  });
  expect(autoFillLakeDay(DAY).moteurDebut).toBe('1230,5');
});

test('auto fill sets the rental amount of a Location', () => {
  updateCruise((cruise) => {
    cruise.purpose = 'Location';
    cruise.info.tarifs = PRICES;
    cruise.days[DAY] = {};
  });
  expect(autoFillLakeDay(DAY).montant).toBe('300');
});

test('auto fill creates the day', () => {
  autoFillLakeDay('2026-07-20');
  expect(state.data.cruise.value?.days['2026-07-20']?._auto).toStrictEqual({
    coSkipper: 'Camille Rochat',
    equipage: 'Noa Dubois',
    skipper: 'Thomas Keller',
    typeSortie: 'Entraînement',
  });
});
