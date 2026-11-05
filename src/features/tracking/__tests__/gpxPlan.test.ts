import { beforeEach, expect, test } from 'vitest';

import {
  blankCruise,
  setCruise,
  setZoneSim,
  updateCruise,
} from '../../../state/index.ts';
import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import type { TrackSample } from '../detector.ts';
import { gpxSample } from '../gpxParse.ts';
import { planImport, thinPoints } from '../gpxPlan.ts';

import { ORIGIN, START, lastOf, leg } from './trackBuilder.ts';

function sample(children: Record<string, string>): TrackSample {
  return gpxSample((name) => children[name] ?? null, '46.5', '6.6');
}

function time(minutes: number): string {
  return new Date(START + minutes * 60_000 + 10_000).toISOString();
}

/** Two hours at 6 kn, a course change after one hour. */
function twoHours(): TrackSample[] {
  const first = leg(ORIGIN, 45, 6, 120);
  return [ORIGIN, ...first, ...leg(lastOf(first), 135, 6, 120)];
}

beforeEach(() => {
  initState(createMemoryStorage());
  setCruise(blankCruise('Essai'));
  setZoneSim('mer');
});

test('a GPX point reads the time, the standard speed in m/s and the course', () => {
  expect(
    sample({ time: '2026-07-15T08:00:00Z', speed: '2.5', course: '359.6' }),
  ).toStrictEqual({
    t: START,
    lat: 46.5,
    lon: 6.6,
    sog: 4.9,
    cog: 0,
    twd: null,
    tws: null,
  });
});

test('the NavimetriX extensions take over the standard fields', () => {
  expect(
    sample({
      sog: '5,26',
      speed: '1',
      cog: '12',
      course: '200',
      twd: '180',
      tws: '11.5',
    }),
  ).toStrictEqual({
    t: Number.NaN,
    lat: 46.5,
    lon: 6.6,
    sog: 5.3,
    cog: 12,
    twd: 180,
    tws: 11.5,
  });
});

test('an import finds the key points and keeps about one entry per hour', () => {
  const plan = planImport({ pts: twoHours(), name: 'Sortie' }, 'trace.gpx');
  expect(plan.name).toBe('Sortie');
  expect(plan.points).toHaveLength(241);
  expect(plan.lastTime).toBe(START + 2 * 3_600_000);
  expect(plan.navigationMs).toBe(2 * 3_600_000);
  expect(plan.distance).toBeCloseTo(12.008, 2);
  expect(plan.legs).toHaveLength(1);
  expect(
    plan.fresh.map(({ kind, t }) => [kind, (t - START) / 60_000]),
  ).toStrictEqual([
    ['Départ', 0],
    [null, 40],
    ['Changement de cap', 63],
    ['Arrivée', 120],
  ]);
  expect(plan.fresh.at(-1)?.note).toBe('Navigation 2 h 00 · 12,0 NM');
});

test('points are put in time order and the file name is the default title', () => {
  const plan = planImport(
    { pts: twoHours().toReversed(), name: '' },
    'trace.gpx',
  );
  expect(plan.name).toBe('trace.gpx');
  expect(plan.points[0]?.t).toBe(START);
});

test('a track cut by more than 45 minutes gives two navigations', () => {
  const first = leg(ORIGIN, 90, 5, 20);
  const moved = { ...lastOf(first), t: lastOf(first).t + 50 * 60_000 };
  const plan = planImport(
    { pts: [ORIGIN, ...first, moved, ...leg(moved, 90, 5, 20)], name: '' },
    'a.gpx',
  );
  expect(plan.legs).toHaveLength(2);
  expect(plan.navigationMs).toBe(20 * 60_000);
  expect(plan.fresh.map(({ kind }) => kind)).toStrictEqual([
    'Départ',
    'Arrivée',
    'Départ',
    'Arrivée',
  ]);
});

test('no key point on a minute that already has an entry', () => {
  updateCruise((cruise) => {
    cruise.entries.push({
      id: 'auto',
      t: new Date(START + 15_000).toISOString(),
      v: {},
      auto: true,
    });
  });
  const plan = planImport({ pts: twoHours(), name: '' }, 'a.gpx');
  expect(plan.fresh.map(({ kind }) => kind)).toStrictEqual([
    null,
    'Changement de cap',
    'Arrivée',
  ]);
});

test('entries noted during the navigation are completed from the nearest point', () => {
  const points = twoHours().map((point) => ({
    ...point,
    twd: 90.4,
    tws: 12.6,
  }));
  updateCruise((cruise) => {
    cruise.entries.push(
      { id: 'near', t: time(30), v: {} },
      {
        id: 'typed',
        t: time(60),
        v: {
          pos: { lat: 0, lon: 0, text: 'Là' },
          sog: 1,
          cog: 2,
          twd: 3,
          tws: 4,
        },
      },
      {
        id: 'full',
        t: time(61),
        v: { pos: { lat: 1, lon: 2 }, sog: 1, cog: 2, twd: 3, tws: 4 },
      },
      { id: 'far', t: time(300), v: {} },
      { id: 'auto', t: time(31), v: {}, auto: true },
    );
  });
  const { fills } = planImport({ pts: points, name: '' }, 'a.gpx');
  expect(fills.map(({ id }) => id)).toStrictEqual(['near', 'typed']);
  expect(fills[0]?.add).toStrictEqual({
    pos: { lat: points[60]?.lat, lon: points[60]?.lon },
    sog: 6,
    cog: 45,
    twd: 90,
    tws: 13,
  });
  expect(Object.keys(fills[1]?.add ?? {})).toStrictEqual(['pos']);
});

test('the track keeps one point every 10 s, first and last included', () => {
  const times = [0, 2000, 9000, 10_000, 15_000, 21_000, 22_000];
  const points = times.map((t) => ({ t, lat: 1, lon: 2 }));
  expect(thinPoints(points).map(({ t }) => t)).toStrictEqual([
    0, 10_000, 21_000, 22_000,
  ]);
});
