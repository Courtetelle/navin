import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import { initState, saveCruiseRecord, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import { mergeCruise } from '../mergeCruise.ts';

import { useHarnessClock } from './fixtures.ts';

function cruise(overrides: Partial<Cruise>): Cruise {
  return {
    id: 'c1',
    created: '2026-07-01T08:00:00.000Z',
    updated: '2026-07-10T08:00:00.000Z',
    info: { name: 'Ici', boat: 'A' },
    crew: [],
    entries: [],
    days: {},
    ...overrides,
  };
}

const ENTRY_A = { id: 'a', t: '2026-07-01T09:00:00.000Z', v: { note: 'ici' } };
const ENTRY_B = { id: 'b', t: '2026-07-01T08:00:00.000Z', v: {} };
const NEW_A = { ...ENTRY_A, v: { note: 'là-bas' } };

beforeEach(() => {
  useHarnessClock();
  initState(createMemoryStorage());
});

afterEach(() => {
  vi.useRealTimers();
});

test('a cruise unknown here is added as it is, without a new stamp', () => {
  const received = {
    id: 'new',
    created: 'x',
    entries: [],
  } as unknown as Cruise;

  const stored = mergeCruise(received, []);

  expect(stored).toStrictEqual({
    id: 'new',
    created: 'x',
    entries: [],
    info: {},
    crew: [],
    days: {},
  });
  expect(state.data.index.value).toStrictEqual([
    {
      id: 'new',
      name: 'Sans nom',
      created: 'x',
      type: 'mer',
      duree: undefined,
    },
  ]);
  expect(store.get('ldb.current', '')).toBe('new');
});

test('the newer side wins for what both have, entries of both are kept', () => {
  saveCruiseRecord(cruise({ entries: [ENTRY_A] }), true);

  const stored = mergeCruise(
    cruise({
      updated: '2026-07-11T08:00:00.000Z',
      info: { name: 'Là-bas' },
      entries: [NEW_A, ENTRY_B],
      crew: [{ nom: 'Léa' }],
      purpose: 'Location',
    }),
    undefined,
  );

  expect(stored.entries).toStrictEqual([ENTRY_B, NEW_A]);
  expect(stored.info).toStrictEqual({ name: 'Là-bas', boat: 'A' });
  expect(stored.crew).toStrictEqual([{ nom: 'Léa' }]);
  expect(stored.purpose).toBe('Location');
  expect(stored.updated).toBe('2026-07-11T08:00:00.000Z');
});

test('an older file only completes what is missing here', () => {
  saveCruiseRecord(
    cruise({
      entries: [ENTRY_A],
      crew: [{ nom: 'Tom' }],
      days: { '2026-07-01': { de: 'Morges' } },
    }),
    true,
  );

  const stored = mergeCruise(
    cruise({
      updated: '2026-07-09T08:00:00.000Z',
      info: { name: 'Vieux', ports: 'Nyon' },
      entries: [NEW_A, ENTRY_B],
      crew: [{ nom: 'Léa' }],
      days: { '2026-07-01': { de: 'Nyon', a: 'Rolle' } },
      purpose: 'Location',
    }),
    undefined,
  );

  expect(stored.entries).toStrictEqual([ENTRY_B, ENTRY_A]);
  expect(stored.info).toStrictEqual({
    name: 'Ici',
    ports: 'Nyon',
    boat: 'A',
  });
  expect(stored.crew).toStrictEqual([{ nom: 'Tom' }]);
  expect(stored.days).toStrictEqual({
    '2026-07-01': { de: 'Morges', a: 'Rolle' },
  });
  expect(stored.purpose).toBe('Location');
  expect(stored.updated).toBe('2026-07-10T08:00:00.000Z');
});

test('deletions of both sides follow and photos are united', () => {
  saveCruiseRecord(
    cruise({
      entries: [ENTRY_A, ENTRY_B],
      deleted: ['a'],
      photos: [{ id: 'p1' }],
    }),
    true,
  );

  const stored = mergeCruise(
    cruise({
      entries: [ENTRY_B],
      deleted: ['b'],
      photos: [{ id: 'p1', late: true }, { id: 'p2' }],
    }),
    undefined,
  );

  expect(stored.entries).toStrictEqual([]);
  expect(stored.deleted).toStrictEqual(['a', 'b']);
  expect(stored.photos).toStrictEqual([{ id: 'p1' }, { id: 'p2' }]);
});

test('track points of the file are added once, in time order', () => {
  saveCruiseRecord(cruise({}), true);
  store.set('ldb.track.c1', [
    [2000, 46, 6],
    [4000, 46.2, 6.2],
  ]);

  mergeCruise(cruise({}), [
    [3000, 46.1, 6.1],
    [2000, 0, 0],
  ]);

  expect(store.get('ldb.track.c1', [])).toStrictEqual([
    [2000, 46, 6],
    [3000, 46.1, 6.1],
    [4000, 46.2, 6.2],
  ]);
});

test('a cruise listed but not stored makes the restoration fail', () => {
  saveCruiseRecord(cruise({}), true);
  store.del('ldb.cruise.c1');

  expect(() => mergeCruise(cruise({}), undefined)).toThrow(
    'cruise c1 is not stored',
  );
});
