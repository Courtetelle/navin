import { beforeEach, expect, test } from 'vitest';

import {
  blankCruise,
  setCruise,
  setZoneSim,
  updateSettings,
} from '../../../state/index.ts';
import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import type { TrackEvent } from '../detector.ts';
import { entryBudget, legsFromEvents, selectLeg } from '../entrySelection.ts';

const HOUR = 3_600_000;

function event(kind: string | null, hours: number, dist = 0): TrackEvent {
  return {
    kind,
    t: hours * HOUR,
    lat: 46,
    lon: 6,
    cog: null,
    sog: null,
    dist,
  };
}

function setPerHour(perHour: number): void {
  updateSettings((settings) => {
    settings.autoPerHour = perHour;
  });
}

beforeEach(() => {
  initState(createMemoryStorage());
  setCruise(blankCruise('Essai'));
  setZoneSim('mer');
});

test('at sea: about one entry per hour, then half as many after 4 hours', () => {
  const budgets = [0.5, 1, 3.9, 4, 5, 6, 10, 24, 30].map(entryBudget);
  expect(budgets).toStrictEqual([0, 1, 3, 4, 4, 5, 7, 12, 12]);
});

test('at sea: the budget follows the setting', () => {
  setPerHour(2);
  expect(entryBudget(3)).toBe(5);
  setPerHour(0.5);
  expect(entryBudget(3)).toBe(1);
});

test('on a lake: two entries per hour, one per hour from 3 hours', () => {
  setZoneSim('lac');
  const budgets = [0.2, 0.5, 1, 2.9, 3, 5.4, 20].map(entryBudget);
  expect(budgets).toStrictEqual([0, 1, 2, 6, 3, 5, 12]);
});

test('a manoeuvre is preferred to a plain point of its slot', () => {
  const plain = event(null, 0.75);
  const tack = event('Virement', 1);
  const other = event(null, 2);
  const departure = event('Départ', 0);
  const arrival = event('Arrivée', 3, 15);
  const kept = selectLeg(departure, [plain, tack, other], arrival);
  expect(kept).toStrictEqual([departure, tack, other, arrival]);
  expect(arrival.note).toBe('Navigation 3 h 00 · 15,0 NM');
});

test('the closest candidate of a slot is kept', () => {
  const early = event(null, 0.6);
  const close = event(null, 0.8);
  const departure = event('Départ', 0);
  const arrival = event('Arrivée', 3);
  const kept = selectLeg(departure, [early, close], arrival);
  expect(kept).toStrictEqual([departure, close, arrival]);
});

test('a candidate between two slots is kept only once', () => {
  const between = event(null, 1.125);
  const departure = event('Départ', 0);
  const arrival = event('Arrivée', 3);
  const kept = selectLeg(departure, [between], arrival);
  expect(kept).toStrictEqual([departure, between, arrival]);
});

test('a slot without candidate stays empty', () => {
  const departure = event('Départ', 0);
  const arrival = event('Arrivée', 4, 8.25);
  expect(selectLeg(departure, [], arrival)).toStrictEqual([departure, arrival]);
  expect(arrival.note).toBe('Navigation 4 h 00 · 8,3 NM');
});

test('a track is split into navigations; events outside a leg are dropped', () => {
  const stray = event(null, 0.5);
  const firstDeparture = event('Départ', 1);
  const middle = event(null, 2);
  const firstArrival = event('Arrivée', 3);
  const secondDeparture = event('Départ', 4);
  const secondArrival = event('Arrivée', 5);
  const unfinished = event('Départ', 6);
  expect(
    legsFromEvents([
      stray,
      firstDeparture,
      middle,
      firstArrival,
      secondDeparture,
      secondArrival,
      unfinished,
    ]),
  ).toStrictEqual([
    { dep: firstDeparture, mids: [middle], arr: firstArrival },
    { dep: secondDeparture, mids: [], arr: secondArrival },
  ]);
});
