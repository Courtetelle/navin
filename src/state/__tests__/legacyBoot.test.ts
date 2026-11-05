import { afterEach, beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { initState } from '../init.ts';

import { buildLakeOuting } from './buildSamples.ts';
import { buildSeaCruise } from './buildSeaSample.ts';
import {
  leaveHarnessWorld,
  parseStored,
  rawStorage,
  readFixture,
  useHarnessWorld,
} from './parityHelpers.ts';

function expectStorageToBe(name: string): void {
  const legacy = readFixture(name);
  const ours = rawStorage();
  expect(Object.keys(ours).toSorted()).toStrictEqual(
    Object.keys(legacy).toSorted(),
  );
  for (const key of Object.keys(legacy)) {
    expect([key, parseStored(ours[key])]).toStrictEqual([
      key,
      parseStored(legacy[key]),
    ]);
    expect([key, ours[key]]).toStrictEqual([key, legacy[key]]);
  }
}

beforeEach(useHarnessWorld);
afterEach(leaveHarnessWorld);

test('a fresh boot writes the same data as the legacy app', () => {
  initState(createMemoryStorage());
  expectStorageToBe('empty');
});

test('the lake sample built with the state actions matches the legacy one', () => {
  initState(createMemoryStorage());
  buildLakeOuting();
  expectStorageToBe('sample-lake');
});

test('the sea sample built with the state actions matches the legacy one', () => {
  initState(createMemoryStorage());
  buildSeaCruise();
  expectStorageToBe('sample-sea');
});

test('both samples, the lake outing open, match the legacy ones', () => {
  initState(createMemoryStorage());
  buildSeaCruise();
  buildLakeOuting();
  expectStorageToBe('sample');
});

test('booting again on legacy data changes nothing', () => {
  for (const name of ['empty', 'sample-sea']) {
    initState(createMemoryStorage(readFixture(name)));
    expectStorageToBe(name);
  }
});

test('booting again gives an identifier to a crew set saved without one', () => {
  initState(createMemoryStorage(readFixture('sample-lake')));
  const sets = parseStored(rawStorage()['ldb.crewSets']) as Array<{
    id: string;
    ident?: string;
  }>;
  expect(sets.map((set) => [set.id, set.ident])).toStrictEqual([
    ['exc1', 'EQ001'],
    ['exc2', 'EQ002'],
    ['exc3', 'EQ003'],
    ['cs-lake', 'EQ004'],
  ]);
  expect(rawStorage()['ldb.crewSeq']).toBe('4');
});

test('the one-shot migrations of old data give the legacy result', () => {
  initState(createMemoryStorage(readFixture('old-input')));
  expectStorageToBe('old-migrated');
});
