import { afterEach, beforeEach, expect, test } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import { initState } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import { boatsByNav, cruiseRealAt, membersByNav } from '../navOrder.ts';

const LAKE_ID = 'mrltkr40tkny6';

beforeEach(() => {
  useHarnessWorld();
  initState(createMemoryStorage(readFixture('sample-lake')));
});
afterEach(leaveHarnessWorld);

function emptyCruise(change: Partial<Cruise> = {}): Cruise {
  return {
    id: 'c1',
    created: '2026-01-01T00:00:00.000Z',
    info: {},
    crew: [],
    entries: [],
    days: {},
    ...change,
  };
}

test('a cruise counts its last entry, its track and its filled days', () => {
  expect(cruiseRealAt({ id: 'c1' }, emptyCruise())).toBe('');
  const entries = [{ id: 'e', t: '2026-07-01T10:00:00.000Z', v: {} }];
  expect(cruiseRealAt({ id: 'c1' }, emptyCruise({ entries }))).toBe(
    '2026-07-01T10:00:00.000Z',
  );
  store.set('ldb.track.c1', [[Date.parse('2026-07-02T10:00:00.000Z'), 46, 6]]);
  expect(cruiseRealAt({ id: 'c1' }, emptyCruise({ entries }))).toBe(
    '2026-07-02T10:00:00.000Z',
  );
  const days = { '2026-07-03': { diesel: '3/4' } };
  expect(cruiseRealAt({ id: 'c1' }, emptyCruise({ entries, days }))).toBe(
    '2026-07-03T23:59',
  );
});

test('a day with only its outing type is not a navigation', () => {
  const days = { '2026-07-03': { typeSortie: 'Location', note: '' } };
  expect(cruiseRealAt({ id: 'none' }, emptyCruise({ days }))).toBe('');
});

test('boats: last navigated first, then by name', () => {
  expect(boatsByNav().map((boat) => boat.id)).toStrictEqual([
    'savannah',
    'exb1',
    'exb2',
    'inspiration',
    'exb3',
  ]);
});

test('with a purpose, the last boat of that purpose comes first', () => {
  store.set('ldb.cruise.other', {
    ...emptyCruise({ id: 'other', boatId: 'exb3', purpose: 'Location' }),
    entries: [{ id: 'e', t: '2026-07-01T10:00:00.000Z', v: {} }],
  });
  const index = store.get<unknown[]>('ldb.index', []);
  store.set('ldb.index', [...index, { id: 'other', name: 'x', type: 'lac' }]);
  initState();
  expect(boatsByNav('Location')[0]?.id).toBe('exb3');
  expect(boatsByNav()[0]?.id).toBe('savannah');
});

test('members: most navigations first, then by name', () => {
  expect(membersByNav().map((member) => member.id)).toStrictEqual([
    'ex1',
    'ex5',
    'ex2',
    'ex6',
    'm-lea',
    'ex4',
    'ex3',
  ]);
  expect(store.get<Cruise | null>(`ldb.cruise.${LAKE_ID}`, null)?.type).toBe(
    'lac',
  );
});
