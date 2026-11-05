import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { fileName, state } from '../../../state/index.ts';
import { backupAll, cruiseBackupJson, syncPack } from '../backup.ts';
import { csvDays, csvEntries, dayVal, tideLines } from '../csv.ts';

import { load, useHarnessClock } from './fixtures.ts';

beforeEach(useHarnessClock);

afterEach(() => {
  vi.useRealTimers();
});

test.each(['data-files-lake', 'data-files-sea'])(
  'the CSV files of %s are the legacy bytes',
  (name) => {
    const seed = load(name);
    const cruise = state.data.cruise.value;
    if (!cruise) throw new Error('no cruise');

    expect(csvEntries(cruise)).toBe(seed.__csvEntries);
    expect(csvDays(cruise)).toBe(seed.__csvDays);
    expect(fileName('-entrees', 'csv')).toBe(seed.__fileName);
  },
);

test.each(['data-files-lake', 'data-files-sea'])(
  'the backups of %s are the legacy bytes',
  (name) => {
    const seed = load(name);
    const cruise = state.data.cruise.value;
    if (!cruise) throw new Error('no cruise');

    expect(cruiseBackupJson(cruise)).toBe(
      JSON.stringify(seed.__cruiseBackup, null, 1),
    );
    expect(backupAll().json).toBe(JSON.stringify(seed.__backupAll));
  },
);

test('a full backup is named after the day', () => {
  load('data-files-sea');

  expect(backupAll().name).toBe('navin-tout-20260715.json');
});

test('dayVal joins lists and adds the prefix to a value only', () => {
  const field = { key: 'sonde', type: 'num', prefix: '≥' } as const;

  expect(dayVal(field, ['a', 'b'])).toBe('≥ a, b');
  expect(dayVal(field, 2.5)).toBe('≥ 2.5');
  expect(dayVal(field, undefined)).toBe('');
  expect(dayVal({ key: 'note', type: 'text' }, 'x')).toBe('x');
});

test('tideLines skips empty rows', () => {
  expect(
    tideLines([{ type: 'PM', h: '06:12', m: '4,2' }, { h: '12:30' }, {}]),
  ).toStrictEqual(['PM 06:12 4,2 m', '12:30']);
  expect(tideLines(undefined)).toStrictEqual([]);
});

test('a sync file carries the boat photos and its time', async () => {
  load('data-files-sea');

  const pack = await syncPack(false, () =>
    Promise.resolve([{ id: 'doc1', url: 'data:image/jpeg;base64,AA' }]),
  );

  expect(pack.name).toBe('navin-synchro-20260715-1030.json');
  expect(pack.data.photos).toStrictEqual([
    { id: 'doc1', url: 'data:image/jpeg;base64,AA' },
  ]);
  expect(JSON.parse(pack.json)).toHaveProperty('photos', pack.data.photos);
});
