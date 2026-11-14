import { afterEach, beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { setStorageBackend, store } from '../../storage/store.ts';
import {
  mergeTraceNames,
  renameTrace,
  restoreTraceCuts,
  traceCutTimes,
  traceNames,
} from '../traceParts.ts';

const TRACK = [
  [1000, 46.4, 6.5],
  [2000, 46.41, 6.51],
  [3000, 46.42, 6.52],
  [4000, 46.43, 6.53],
];

beforeEach(() => {
  setStorageBackend(createMemoryStorage());
});
afterEach(() => {
  setStorageBackend(null);
});

test('the cuts of a recording travel as the times of their first points', () => {
  store.set('ldb.track.c1', TRACK);
  store.set('ldb.trkSegs.c1', [2]);
  expect(traceCutTimes('c1')).toStrictEqual([3000]);
  // Restored on a device where the track was merged with an earlier point.
  store.set('ldb.track.c2', [[500, 46, 6], ...TRACK]);
  restoreTraceCuts('c2', [3000]);
  expect(store.get('ldb.trkSegs.c2', [])).toStrictEqual([3]);
});

test('the cuts of the device are kept', () => {
  store.set('ldb.track.c1', TRACK);
  store.set('ldb.trkSegs.c1', [1]);
  restoreTraceCuts('c1', [3000]);
  expect(store.get('ldb.trkSegs.c1', [])).toStrictEqual([1]);
});

test('texts of traces: given, emptied, and merged from a backup', () => {
  renameTrace('c1', 'Tour du lac');
  renameTrace('c1#1', 'Retour');
  renameTrace('c1#1', ' ');
  expect(traceNames()).toStrictEqual({ c1: 'Tour du lac' });
  mergeTraceNames({ c1: 'Autre', c2: 'Régate' });
  expect(traceNames()).toStrictEqual({ c1: 'Tour du lac', c2: 'Régate' });
});
