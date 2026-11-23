import { afterEach, describe, expect, it, vi } from 'vitest';

import { destination } from '../../../lib/geo.ts';
import type { RoutingResult, RoutingStep } from '../../../model/sailRouting.ts';
import { state } from '../../../state/index.ts';
import { gotoTarget, gotoUpdate, setGoto } from '../goto.ts';
import { clearRouting, gotoRouting, showRouting } from '../routingShown.ts';
import { routingLeg, routingShape, shownRouting } from '../routingState.ts';

const A = { lat: 48.65, lon: -2.83 };
const B = destination(A, 0, 2);
const C = destination(B, 90, 2);

function step(at: { lat: number; lon: number }, rank: number): RoutingStep {
  return {
    ms: Date.UTC(2027, 5, 12, 8) + rank * 600_000,
    lat: at.lat,
    lon: at.lon,
    mode: 'sail',
    course: rank < 6 ? 0 : 90,
    kn: 6,
    twd: 270,
    tws: 12,
    twa: 90,
    side: 'bâbord',
    sails: 'Polaire',
    toPoint: rank < 6 ? 1 : 2,
    sog: 6,
    cog: rank < 6 ? 0 : 90,
    driftKn: 1.2,
    setDeg: 45,
    waveM: rank % 2 ? 1 : Number.NaN,
  };
}

const steps = [
  ...Array.from({ length: 6 }, (_, rank) =>
    step(destination(A, 0, (rank * 2) / 6), rank),
  ),
  ...Array.from({ length: 6 }, (_, rank) =>
    step(destination(B, 90, (rank * 2) / 6), rank + 6),
  ),
];

const done: Extract<RoutingResult, { kind: 'done' }> = {
  kind: 'done',
  steps,
  legs: [],
  arriveMs: Date.UTC(2027, 5, 12, 10),
  nm: 4,
  sailMin: 120,
  motorMin: 0,
  tacks: 0,
  gybes: 0,
};

function at(where: { lat: number; lon: number }): void {
  state.view.myPos.value = { ...where, sog: 6, cog: 0, t: Date.now() };
}

afterEach(() => {
  clearRouting();
  setGoto(null);
  state.view.myPos.value = null;
  vi.useRealTimers();
});

describe('routingShape', () => {
  it('keeps the way, the turns and evenly spaced wind, current and waves', () => {
    const shown = routingShape('Essai', done, [A, B, C]);
    expect(shown.track).toHaveLength(steps.length + 1);
    expect(shown.turns).toHaveLength(3);
    expect(shown.marks.length).toBeGreaterThan(3);
    expect(shown.marks.length).toBeLessThanOrEqual(steps.length);
    expect(shown.marks[0]).toMatchObject({
      twd: 270,
      driftKn: 1.2,
      waveM: null,
    });
  });
});

describe('routingLeg', () => {
  it('aims at the end of the nearest leg, then the next, never back', () => {
    const turns = [A, B, C];
    expect(routingLeg(turns, destination(A, 0, 1))).toBe(1);
    expect(routingLeg(turns, destination(B, 90, 1))).toBe(2);
    expect(routingLeg(turns, B)).toBe(2);
    expect(routingLeg(turns, destination(A, 0, 0.5), 2)).toBe(2);
  });
});

describe('Go to along the routing', () => {
  it('passes from one leg to the next as the boat goes', () => {
    showRouting(routingShape('Essai', done, [A, B, C]));
    expect(shownRouting.value?.name).toBe('Essai');
    at(destination(A, 0, 0.5));
    gotoRouting();
    expect(gotoTarget.value?.leg).toBe(1);
    expect(gotoTarget.value?.name).toContain('segment 1/2');
    at(destination(B, 90, 0.3));
    gotoUpdate();
    expect(gotoTarget.value?.leg).toBe(2);
    expect(gotoTarget.value?.name).toContain('arrivée');
    clearRouting();
    expect(gotoTarget.value).toBeNull();
  });
});
