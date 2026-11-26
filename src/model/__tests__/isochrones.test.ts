import { describe, expect, it } from 'vitest';

import { destination, distNM } from '../../lib/geo.ts';
import { routeIsochrones } from '../isochrones.ts';
import type { Polar } from '../polars.ts';
import { polarSpeed } from '../polars.ts';
import type { RoutingAsk, RoutingResult, Sea, Wind } from '../sailRouting.ts';
import { routeSail } from '../sailRouting.ts';

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
    motorBelow: 3,
    motorKn: 6,
    ...extra,
  };
}

/** A tide: 2.5 kn north the first 3 hours, then south. */
function tide(_lat: number, _lon: number, ms: number): Sea {
  return {
    waveM: 0.5,
    driftKn: 2.5,
    setDeg: ms < DEPART + 3 * 3_600_000 ? 0 : 180,
  };
}

type Done = Extract<RoutingResult, { kind: 'done' }>;

function done(result: RoutingResult): Done {
  if (result.kind !== 'done') throw new Error(result.kind);
  return result;
}

function hours(result: Done): number {
  return (result.arriveMs - DEPART) / 3_600_000;
}

describe('routeIsochrones', () => {
  it('goes about straight on a reach, as fast as point to point', () => {
    const to = destination(START, 90, 10);
    const iso = done(routeIsochrones(ask(to, { twd: 0, tws: 12 })));
    const direct = done(routeSail(ask(to, { twd: 0, tws: 12 })));
    expect(iso.tacks + iso.gybes).toBe(0);
    expect(hours(iso)).toBeLessThan(hours(direct) * 1.03);
    expect(distNM(iso.steps.at(-1) ?? START, to)).toBeLessThan(3);
  });

  it('tacks upwind and gets there', () => {
    const to = destination(START, 0, 10);
    const iso = done(routeIsochrones(ask(to, { twd: 0, tws: 12 })));
    expect(iso.tacks).toBeGreaterThan(0);
    expect(iso.motorMin).toBe(0);
    expect(iso.steps.every((step) => step.twa >= 35)).toBe(true);
    const direct = done(routeSail(ask(to, { twd: 0, tws: 12 })));
    expect(hours(iso)).toBeLessThan(hours(direct) * 1.06);
  });

  it('lets a cross current carry the boat and gains on steering up into it', () => {
    const to = destination(START, 90, 20);
    const iso = done(
      routeIsochrones(ask(to, { twd: 0, tws: 12 }, { seaAt: tide })),
    );
    const direct = done(
      routeSail(ask(to, { twd: 0, tws: 12 }, { seaAt: tide })),
    );
    expect(hours(iso)).toBeLessThanOrEqual(hours(direct) * 1.01);
    // The way is not a straight line: the boat goes up then down the chart.
    const highest = Math.max(...iso.steps.map((step) => step.lat));
    expect(distNM(START, { lat: highest, lon: START.lon })).toBeGreaterThan(
      0.5,
    );
  });

  it('takes the motor when the sails make too little, toward the point', () => {
    const to = destination(START, 45, 6);
    const iso = done(routeIsochrones(ask(to, { twd: 270, tws: 2 })));
    expect(iso.sailMin).toBe(0);
    expect(iso.steps.every((step) => step.mode === 'motor')).toBe(true);
    expect(hours(iso)).toBeCloseTo(1, 1);
  });

  it('keeps out of the land when it knows the water', () => {
    const to = destination(START, 0, 8);
    const shore = destination(START, 90, 0.6).lon;
    const navigable = (_: unknown, b: { lon: number }) => b.lon < shore;
    const iso = done(
      routeIsochrones(ask(to, { twd: 0, tws: 12 }, { navigable })),
    );
    expect(iso.steps.every((step) => step.lon < shore)).toBe(true);
  });

  it('says where and when the forecast ends', () => {
    const to = destination(START, 90, 5);
    expect(routeIsochrones(ask(to, null)).kind).toBe('no-wind');
  });

  it('routes leg by leg through the points', () => {
    const mid = destination(START, 90, 5);
    const end = destination(mid, 180, 5);
    const iso = done(
      routeIsochrones({
        ...ask(end, { twd: 0, tws: 12 }),
        points: [START, mid, end],
      }),
    );
    expect(iso.legs).toHaveLength(2);
    expect(iso.steps.some((step) => step.toPoint === 2)).toBe(true);
    expect(iso.nm).toBeGreaterThan(9.5);
  });
});
