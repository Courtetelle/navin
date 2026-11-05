import { expect, test } from 'vitest';

import type { Detector, TrackEvent, TrackSample } from '../detector.ts';
import { detectorPush, newDetector } from '../detector.ts';

import type { TestWind } from './trackBuilder.ts';
import { ORIGIN, START, lastOf, leg } from './trackBuilder.ts';

interface Summary {
  kind: string | null;
  minute: number;
  cog: number | null;
  sog: number | null;
}

function run(
  points: readonly TrackSample[],
  detector: Detector = newDetector({ turn: 30, every: 10 }),
): { events: TrackEvent[]; summary: Summary[]; detector: Detector } {
  const events: TrackEvent[] = [];
  for (const point of points) events.push(...detectorPush(detector, point));
  const summary = events.map(({ kind, t, cog, sog }) => ({
    kind,
    minute: (t - START) / 60_000,
    cog,
    sog,
  }));
  return { events, summary, detector };
}

function twoLegs(first: number, second: number, wind?: TestWind) {
  const start = wind ? { ...ORIGIN, ...wind } : ORIGIN;
  const before = leg(start, first, 6, 10, wind);
  return [start, ...before, ...leg(lastOf(before), second, 6, 10, wind)];
}

test('the detector starts empty, with the keys of the stored format', () => {
  expect(newDetector({ turn: 30, every: 10 })).toStrictEqual({
    turn: 30,
    every: 10,
    splitGap: 0,
    buf: [],
    ref: null,
    refSide: 0,
    pendSince: null,
    refAllure: null,
    allurePend: null,
    allureSince: null,
    lastEntryT: null,
    dist: 0,
    lastPt: null,
    lastCog: null,
    lastSog: null,
    lastTwd: null,
    lastTws: null,
  });
});

test('the first point is the departure, with its own speed and course', () => {
  const detector = newDetector({ turn: 30, every: 10 });
  const events = detectorPush(detector, {
    ...ORIGIN,
    sog: 4.2,
    cog: 123,
    twd: 359.6,
    tws: 12.34,
  });
  expect(events).toStrictEqual([
    {
      kind: 'Départ',
      t: START,
      lat: 46.5,
      lon: 6.6,
      cog: 123,
      sog: 4.2,
      dist: 0,
      twd: 0,
      tws: 12.3,
    },
  ]);
  expect(detector.lastEntryT).toBe(START);
});

test('a lasting course change is noted after 2 minutes, without wind', () => {
  const { summary, events, detector } = run(twoLegs(45, 135));
  expect(summary).toStrictEqual([
    { kind: 'Départ', minute: 0, cog: null, sog: null },
    { kind: 'Changement de cap', minute: 8, cog: 135, sog: 6 },
  ]);
  expect(events[1]?.dist).toBeCloseTo(0.800_514_5, 6);
  expect(detector.dist).toBeCloseTo(1.000_647_2, 6);
  expect(detector.lastCog).toBe(135);
  expect(detector.lastSog).toBe(6);
});

test('the wind changing side with the wind ahead is a tack', () => {
  const { summary } = run(twoLegs(45, 315, { twd: 0, tws: 12 }));
  expect(summary[1]).toStrictEqual({
    kind: 'Virement',
    minute: 8,
    cog: 315,
    sog: 6,
  });
});

test('the wind changing side with the wind behind is a gybe', () => {
  const { summary } = run(twoLegs(45, 315, { twd: 180, tws: 12 }));
  expect(summary[1]).toStrictEqual({
    kind: 'Empannage',
    minute: 8,
    cog: 315,
    sog: 6,
  });
});

test('a short zigzag is no course change', () => {
  const before = leg(ORIGIN, 45, 6, 10);
  const zig = leg(lastOf(before), 135, 6, 1);
  const after = leg(lastOf(zig), 45, 6, 10);
  const { summary } = run([ORIGIN, ...before, ...zig, ...after]);
  expect(summary.map(({ kind }) => kind)).toStrictEqual(['Départ', null]);
});

test('a periodic point comes every 10 minutes', () => {
  const { summary } = run([ORIGIN, ...leg(ORIGIN, 90, 5, 45)]);
  expect(summary).toStrictEqual([
    { kind: 'Départ', minute: 0, cog: null, sog: null },
    { kind: null, minute: 10, cog: 90, sog: 5 },
    { kind: null, minute: 20, cog: 90, sog: 5 },
  ]);
});

test('a change of point of sail held 3 minutes is noted, 10 minutes after the last entry', () => {
  const wind = { twd: 0, tws: 12 };
  const before = leg({ ...ORIGIN, ...wind }, 90, 6, 30, wind);
  const after = leg(lastOf(before), 90, 6, 20, { twd: 45, tws: 12 });
  const { summary, events } = run([
    { ...ORIGIN, ...wind },
    ...before,
    ...after,
  ]);
  expect(summary).toStrictEqual([
    { kind: 'Départ', minute: 0, cog: null, sog: null },
    { kind: null, minute: 10, cog: 90, sog: 6 },
    { kind: 'Changement d’allure', minute: 20, cog: 90, sog: 6 },
  ]);
  expect(events[2]?.twd).toBe(45);
});

test('a long gap in an imported track splits it into two navigations', () => {
  const first = leg(ORIGIN, 90, 5, 6);
  const moved = { ...lastOf(first), t: lastOf(first).t + 46 * 60_000 };
  const points = [ORIGIN, ...first, moved, ...leg(moved, 90, 5, 6)];
  const { summary } = run(
    points,
    newDetector({ turn: 30, every: 10, splitGap: 45 * 60_000 }),
  );
  expect(summary).toStrictEqual([
    { kind: 'Départ', minute: 0, cog: null, sog: null },
    { kind: 'Arrivée', minute: 3, cog: 90, sog: 0 },
    { kind: 'Départ', minute: 49, cog: 90, sog: 5 },
  ]);
});

test('live tracking does not split: the gap gives a periodic point', () => {
  const first = leg(ORIGIN, 90, 5, 6);
  const moved = { ...lastOf(first), t: lastOf(first).t + 46 * 60_000 };
  const { summary } = run([ORIGIN, ...first, moved, ...leg(moved, 90, 5, 6)]);
  expect(summary).toStrictEqual([
    { kind: 'Départ', minute: 0, cog: null, sog: null },
    { kind: null, minute: 49, cog: 90, sog: 0 },
  ]);
});

test('a GPS jump above 40 kn is not counted', () => {
  const { detector } = run([
    ORIGIN,
    { t: START + 60_000, lat: 46.6, lon: 6.6 },
  ]);
  expect(detector.dist).toBe(0);
  expect(detector.lastPt).toStrictEqual({
    t: START + 60_000,
    lat: 46.6,
    lon: 6.6,
  });
});

test('a point under 5 m in less than a minute is ignored', () => {
  const near = { t: START + 10_000, lat: 46.500_01, lon: 6.6 };
  const { detector } = run([ORIGIN, near]);
  expect(detector.lastPt).toStrictEqual(ORIGIN);
  expect(detector.buf).toStrictEqual([ORIGIN]);
  expect(detector.dist).toBe(0);
});

test('a boat stopped for 90 s has a speed of 0', () => {
  const moving = leg(ORIGIN, 90, 5, 6);
  const stopped = lastOf(moving);
  const later = [1, 2, 3, 4].map((step) => ({
    ...stopped,
    t: stopped.t + step * 60_000,
  }));
  const { detector } = run([ORIGIN, ...moving, ...later]);
  expect(detector.lastSog).toBe(0);
  expect(detector.lastCog).toBe(90);
});
