import { beforeEach, expect, test } from 'vitest';

import type { TrackPoint } from '../../../state/index.ts';
import { initState, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend, store } from '../../../storage/store.ts';
import {
  allLakeTracks,
  currentTrack,
  traceSheet,
  traceTitle,
  trackStats,
} from '../trackStats.ts';

beforeEach(() => {
  const storage = createMemoryStorage({});
  setStorageBackend(storage);
  initState(storage);
});

test('trackStats skips gaps and GPS jumps', () => {
  const track: TrackPoint[] = [
    [0, 46, 6],
    [600_000, 46.01, 6],
    [600_000 + 3_600_000, 46.02, 6],
    [600_000 + 3_600_000 + 60_000, 46.5, 6],
  ];
  const stats = trackStats(track);
  expect(stats.nm).toBeCloseTo(29.4, 1);
  expect(stats.max).toBeCloseTo(3.6, 1);
  expect(stats.moving).toBeCloseTo(1 / 6, 5);
  expect(stats.start).toBe(0);
  expect(stats.end).toBe(4_260_000);
});

test('trackStats of an empty track', () => {
  expect(trackStats([])).toStrictEqual({
    nm: 0,
    max: 0,
    moving: 0,
    start: null,
    end: null,
  });
});

test('allLakeTracks splits a cruise at its starts, newest first', () => {
  state.data.index.value = [
    { id: 'a', name: 'Une', created: '' },
    { id: 'b', name: 'Deux', created: '' },
  ] as never;
  store.set('ldb.track.a', [
    [1000, 1, 1],
    [2000, 2, 2],
    [3000, 3, 3],
    [4000, 4, 4],
  ]);
  store.set('ldb.trkSegs.a', [2, 9]);
  store.set('ldb.track.b', [
    [2500, 5, 5],
    [2600, 6, 6],
  ]);
  const tracks = allLakeTracks();
  expect(tracks.map((item) => [item.id, item.name])).toStrictEqual([
    ['a#1', 'Une · trace 2'],
    ['b', 'Deux'],
    ['a#0', 'Une · trace 1'],
  ]);
  expect(tracks[0]?.track).toHaveLength(2);
});

test('currentTrack shows only the recording in progress', () => {
  expect(currentTrack()).toStrictEqual([]);
  state.view.trip.value = {
    start: 10_000_000,
    from: 1,
    lochBase: 0,
    det: {},
    dep: null,
    cands: [],
  };
  state.view.tracking.value = true;
  state.view.trackBuf.value = [
    [1, 1, 1],
    [2, 2, 2],
  ];
  expect(currentTrack()).toStrictEqual([[2, 2, 2]]);
  state.view.trip.value = {
    start: 10_000_000,
    lochBase: 0,
    det: {},
    dep: null,
    cands: [],
  };
  state.view.trackBuf.value = [
    [9_000_000, 1, 1],
    [9_950_000, 2, 2],
  ];
  expect(currentTrack()).toStrictEqual([[9_950_000, 2, 2]]);
});

test('traceTitle gives date, boat, type and saved crew', () => {
  const cruise = {
    id: 'a',
    created: '',
    info: { boat: 'Savannah' },
    crew: [{ memberId: 'm1' }, { memberId: 'm2' }],
    entries: [],
    days: {},
    type: 'lac',
    purpose: 'Entraînement',
  } as const;
  const time = new Date(2026, 1, 26, 14).getTime();
  const sets = [
    { id: 's1', name: 'Autre', crew: [{ memberId: 'm1' }] },
    {
      id: 's2',
      name: 'Régate',
      crew: [{ memberId: 'm2' }, { memberId: 'm1' }],
    },
  ];
  expect(traceTitle(cruise as never, time, sets)).toBe(
    '20260226_Savan Ent-Réga',
  );
  expect(traceTitle(cruise as never, time, [])).toBe('20260226_Savan Ent');
  expect(
    traceTitle(
      { ...cruise, purpose: 'Location', crew: [] } as never,
      time,
      sets,
    ),
  ).toBe('20260226_Savan Loc');
  expect(
    traceTitle(
      { ...cruise, purpose: undefined, type: 'mer' } as never,
      time,
      [],
    ),
  ).toBe('20260226_Savan Mer');
});

test('traceSheet gives speeds, wind when recorded, and the sun during the track', () => {
  const start = Date.UTC(2026, 5, 21, 17);
  const hour = 3_600_000;
  const withWind = traceSheet([
    [start, 46.5, 6.6, 10, 12],
    [start + hour * 2, 46.5, 6.7, 20, 24],
    [start + hour * 5, 46.55, 6.7],
  ]);
  expect(withWind.duration).toBe(hour * 5);
  expect(withWind.maxWind).toBe(20);
  expect(withWind.meanWind).toBe(15);
  expect(withWind.maxApparent).toBe(24);
  expect(withWind.meanApparent).toBe(18);
  expect(withWind.meanSpeed).toBeCloseTo(withWind.nm / 5);
  expect(withWind.sun.map((event) => event.kind)).toStrictEqual(['set']);
  const without = traceSheet([
    [start, 46.5, 6.6],
    [start + hour, 46.5, 6.61],
  ]);
  expect(without.maxWind).toBeNull();
  expect(without.maxApparent).toBeNull();
  expect(without.sun).toStrictEqual([]);
});
