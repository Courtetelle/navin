import { describe, expect, it } from 'vitest';

import { destination, distNM } from '../../lib/geo.ts';
import type { Polar } from '../polars.ts';
import { polarSpeed } from '../polars.ts';
import type { RoutingAsk, Wind } from '../sailRouting.ts';
import {
  crossTrack,
  routeSail,
  routingTurns,
  windSide,
} from '../sailRouting.ts';

const polar: Polar = {
  twa: [40, 60, 90, 120, 150, 180],
  tws: [6, 10, 16],
  kn: [
    [4, 5.5, 6.5],
    [5, 6.5, 7.2],
    [5.5, 7, 7.8],
    [5.3, 6.9, 8],
    [4.2, 5.8, 7.2],
    [3.5, 5, 6.5],
  ],
};

const START = { lat: 48.65, lon: -2.83 };
const DEPART = Date.UTC(2027, 5, 12, 6);

function ask(
  to: { lat: number; lon: number },
  wind: Wind | null,
  extra: Partial<RoutingAsk> = {},
): RoutingAsk {
  return {
    points: [START, to],
    departMs: DEPART,
    windAt: () => wind,
    sailSpeed: (twa, tws) => ({
      kn: polarSpeed(polar, twa, tws, 0.9),
      sails: 'Polaire',
    }),
    polar,
    motorBelow: 5,
    motorKn: 6,
    ...extra,
  };
}

describe('routeSail', () => {
  it('goes straight on a reach, at the speed of the polar', () => {
    const to = destination(START, 0, 10);
    const result = routeSail(ask(to, { twd: 270, tws: 10 }));
    if (result.kind !== 'done') throw new Error(result.kind);
    expect(result.tacks).toBe(0);
    expect(result.motorMin).toBe(0);
    // 7 kn × 0.9 = 6.3 kn: 10 NM in about 95 minutes.
    expect((result.arriveMs - DEPART) / 60_000).toBeCloseTo(95, -1);
    expect(result.nm).toBeCloseTo(10, 0);
    expect(result.steps[0]?.side).toBe('bâbord');
  });

  it('tacks upwind and gets there', () => {
    const to = destination(START, 0, 8);
    const result = routeSail(ask(to, { twd: 0, tws: 12 }));
    if (result.kind !== 'done') throw new Error(result.kind);
    expect(result.tacks).toBeGreaterThan(0);
    expect(result.nm).toBeGreaterThan(9);
    expect(result.steps.every((step) => step.twa >= 35)).toBe(true);
    const turns = routingTurns(result, [START, to]);
    expect(turns.length).toBeGreaterThan(2);
    expect(distNM(turns.at(-1) ?? START, to)).toBeLessThan(0.01);
  });

  it('gybes downwind', () => {
    const to = destination(START, 180, 8);
    const result = routeSail(ask(to, { twd: 0, tws: 12 }));
    if (result.kind !== 'done') throw new Error(result.kind);
    expect(result.steps.every((step) => step.twa < 180)).toBe(true);
    expect(result.steps[0]?.twa).toBeGreaterThan(120);
  });

  it('motors straight under the threshold and the time follows', () => {
    const to = destination(START, 0, 6);
    const result = routeSail(ask(to, { twd: 270, tws: 3 }));
    if (result.kind !== 'done') throw new Error(result.kind);
    expect(result.sailMin).toBe(0);
    expect(result.steps.every((step) => step.mode === 'motor')).toBe(true);
    // 6 NM at 6 kn: one hour.
    expect((result.arriveMs - DEPART) / 60_000).toBeCloseTo(60, 0);
    const lower = routeSail(ask(to, { twd: 270, tws: 3 }, { motorBelow: 1 }));
    if (lower.kind !== 'done') throw new Error(lower.kind);
    expect(lower.motorMin).toBe(0);
  });

  it('says where and when the forecast ends', () => {
    const to = destination(START, 0, 6);
    expect(routeSail(ask(to, null)).kind).toBe('no-wind');
  });
});

describe('helpers', () => {
  it('know the side of the wind and the distance off the route', () => {
    expect(windSide(0, 90)).toBe('tribord');
    expect(windSide(0, 270)).toBe('bâbord');
    const end = destination(START, 0, 10);
    const off = destination(destination(START, 0, 5), 90, 1);
    expect(crossTrack(off, START, end)).toBeCloseTo(1, 1);
  });
});
