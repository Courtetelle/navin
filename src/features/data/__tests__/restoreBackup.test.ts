import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import { hooks, state } from '../../../state/index.ts';
import { store } from '../../../storage/store.ts';
import type { BackupFile } from '../restoreBackup.ts';
import { restoreBackup } from '../restoreBackup.ts';
import { restoredMessage } from '../restoredMessage.ts';

import { fixture, load, useHarnessClock } from './fixtures.ts';

function backupOf(name: string): BackupFile {
  return structuredClone(fixture(name).__backupAll) as BackupFile;
}

beforeEach(useHarnessClock);

afterEach(() => {
  hooks.stopTracking = null;
  vi.useRealTimers();
});

test('a full legacy backup rebuilds an empty device', async () => {
  const backup = backupOf('data-files-lake');
  load('empty');

  const result = await restoreBackup(structuredClone(backup));

  expect(result.count).toBe(2);
  expect(state.data.index.value.map((meta) => meta.id)).toStrictEqual([
    'mrltkr40tkny6',
    'mrltkr405l9e4',
  ]);
  expect(state.data.cruise.value?.id).toBe(backup.current);
  const cruises = backup.cruises as Array<{ cruise: Cruise }>;
  for (const { cruise } of cruises) {
    expect(store.get(`ldb.cruise.${cruise.id}`, null)).toStrictEqual(cruise);
  }
  expect(state.data.members.value.map((member) => member.id)).toContain(
    'm-lea',
  );
  expect(state.data.marks.value.map((mark) => mark.id)).toContain('mk-lake');
  expect(state.data.sosLogs.value).toHaveLength(1);
});

test('the sheets are copied before the merge', async () => {
  load('sample-lake');
  const boats = state.data.boats.value;

  await restoreBackup(backupOf('data-files-lake'));

  const copy = store.get<{ t: string; boats: unknown }>('ldb.preRestore', {
    t: '',
    boats: [],
  });
  expect(copy.t).toBe('2026-07-15T08:30:00.000Z');
  expect(copy.boats).toStrictEqual(boats);
});

test('the cruise open here stays open', async () => {
  load('sample-sea');

  await restoreBackup(backupOf('data-files-lake'));

  expect(state.data.cruise.value?.id).toBe('mrltkr40tkny6');
});

test('a file of sheets alone is valid when it is a full backup', async () => {
  load('sample-lake');

  const result = await restoreBackup({
    all: true,
    cruises: [],
    boats: [{ id: 'b-new', info: { boat: 'Nouveau' } }],
  });

  expect(result).toStrictEqual({ count: 0, last: null });
  expect(state.data.boats.value.at(-1)?.id).toBe('b-new');
});

test.each([
  [{}],
  [{ cruise: { id: 'x' } }],
  [{ all: true, cruises: [{ cruise: { id: 'x', entries: 'none' } }] }],
])('%j is refused', async (file) => {
  load('sample-lake');
  const before = state.data.index.value;

  await expect(restoreBackup(file)).rejects.toThrow('not a backup file');
  expect(state.data.index.value).toBe(before);
});

test('recording stops before a restoration', async () => {
  load('sample-lake');
  const stopTracking = vi.fn();
  hooks.stopTracking = stopTracking;
  state.view.tracking.value = true;

  await restoreBackup(backupOf('data-files-lake'));

  expect(stopTracking).toHaveBeenCalledExactlyOnceWith(false);
});

test('settings of a full backup apply only on an empty device', async () => {
  load('empty');
  await restoreBackup({
    all: true,
    boats: [],
    settings: { theme: 'night' },
  });
  expect(state.preferences.settings.value.theme).toBe('night');

  load('sample-lake');
  await restoreBackup({
    all: true,
    boats: [],
    settings: { theme: 'night' },
  });
  expect(state.preferences.settings.value.theme).toBe('day');
});

test('man overboard procedures follow their stamp', async () => {
  load('sample-lake');
  store.set('ldb.mob.at', '2026-07-01');
  const mob = { real: [{ steps: [] }], train: [] };

  await restoreBackup({ all: true, boats: [], mob, mobAt: '2026-06-01' });
  expect(store.get('ldb.mob.at', '')).toBe('2026-07-01');

  await restoreBackup({
    all: true,
    boats: [],
    mob,
    mobMer: { real: [] },
    mobAt: '2026-07-02',
  });
  expect(store.get('ldb.mob2', null)).toStrictEqual(mob);
  expect(store.get('ldb.mob2mer', null)).toStrictEqual({ real: [] });
  expect(store.get('ldb.mob.at', '')).toBe('2026-07-02');
});

test('crew sets and SOS logs already here are not replaced', async () => {
  load('sample-lake');
  const logs = state.data.sosLogs.value.length;
  const sets = state.data.crewSets.value.length;

  await restoreBackup({
    all: true,
    boats: [],
    sosLogs: [
      { id: state.data.sosLogs.value[0]?.id, what: 'autre' },
      { id: 'log-new', start: 'x' },
      null,
    ],
    sosPwd: 'abc',
    crewSets: [
      { id: 'exc1', name: 'autre', crew: [] },
      { id: 'cs-new', name: 'Neuf', crew: [] },
    ],
  });

  expect(state.data.sosLogs.value).toHaveLength(logs + 1);
  expect(store.get('ldb.sosPwd', '')).toBe('abc');
  expect(state.data.crewSets.value).toHaveLength(sets + 1);
  expect(state.data.crewSets.value.at(-1)?._sig).toBe('["Neuf",[]]');
});

test('the message tells what was restored', () => {
  const named = { info: { name: 'Croatie' } } as Cruise;

  expect(restoredMessage({ version: 4 }, { count: 1, last: named })).toBe(
    '🔄 Synchronisé : 1 navigation',
  );
  expect(restoredMessage({ version: 4 }, { count: 3, last: named })).toBe(
    '🔄 Synchronisé : 3 navigations',
  );
  expect(restoredMessage({ version: 2 }, { count: 1, last: named })).toBe(
    'Croisière « Croatie » récupérée',
  );
  expect(restoredMessage({}, { count: 2, last: named })).toBe(
    '2 croisières récupérées',
  );
});
