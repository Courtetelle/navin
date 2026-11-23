import { describe, expect, it } from 'vitest';

import { destination, distNM } from '../../lib/geo.ts';
import type { Polar } from '../polars.ts';
import { polarSpeed } from '../polars.ts';
import type { RoutingAsk, Wind } from '../sailRouting.ts';
import {
  apparentWind,
  crabInto,
  crossTrack,
  groundOf,
  motorWaveShare,
  routeSail,
  routingTurns,
  waveShare,
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

  it('tacks before the land when it knows the water', () => {
    const to = destination(START, 0, 8);
    // Land east of 0.6 NM from the route.
    const shore = destination(START, 90, 0.6).lon;
    const navigable = (_: unknown, b: { lon: number }) => b.lon < shore;
    const result = routeSail(ask(to, { twd: 0, tws: 12 }, { navigable }));
    if (result.kind !== 'done') throw new Error(result.kind);
    expect(result.steps.every((step) => step.lon < shore)).toBe(true);
    const free = routeSail(ask(to, { twd: 0, tws: 12 }));
    if (free.kind !== 'done') throw new Error(free.kind);
    expect(result.tacks).toBeGreaterThanOrEqual(free.tacks);
  });

  it('steers up into the current straight to the point, the time follows', () => {
    const to = destination(START, 0, 6);
    const still = routeSail(ask(to, { twd: 270, tws: 3 }));
    // A current of 2 kn flowing east, then one against the boat.
    const across = routeSail(
      ask(
        to,
        { twd: 270, tws: 3 },
        { seaAt: () => ({ waveM: 0.5, driftKn: 2, setDeg: 90 }) },
      ),
    );
    const against = routeSail(
      ask(
        to,
        { twd: 270, tws: 3 },
        { seaAt: () => ({ waveM: 0.5, driftKn: 2, setDeg: 180 }) },
      ),
    );
    if (
      still.kind !== 'done' ||
      across.kind !== 'done' ||
      against.kind !== 'done'
    ) {
      throw new Error('no routing');
    }
    expect(across.steps[0]?.course).toBeGreaterThan(300);
    expect(across.steps[0]?.cog).toBe(0);
    expect(distNM(across.steps.at(-1) ?? START, to)).toBeLessThan(1.2);
    expect(against.arriveMs - DEPART).toBeGreaterThan(
      1.4 * (still.arriveMs - DEPART),
    );
    expect(against.steps[0]?.sog).toBe(4);
  });

  it('slows in the waves', () => {
    const to = destination(START, 0, 10);
    const flat = routeSail(ask(to, { twd: 270, tws: 10 }));
    const rough = routeSail(
      ask(
        to,
        { twd: 270, tws: 10 },
        { seaAt: () => ({ waveM: 3, driftKn: 0, setDeg: 0 }) },
      ),
    );
    if (flat.kind !== 'done' || rough.kind !== 'done') {
      throw new Error('no routing');
    }
    expect(rough.arriveMs).toBeGreaterThan(flat.arriveMs);
    expect(rough.steps[0]?.waveM).toBe(3);
  });

  it('says where and when the forecast ends', () => {
    const to = destination(START, 0, 6);
    expect(routeSail(ask(to, null)).kind).toBe('no-wind');
  });
});

describe('sea helpers', () => {
  it('keep a share of the speed in the waves', () => {
    expect(waveShare(Number.NaN, 40)).toBe(1);
    expect(waveShare(0.8, 40)).toBe(1);
    expect(waveShare(3, 40)).toBeCloseTo(0.84);
    expect(waveShare(3, 150)).toBeCloseTo(0.96);
    expect(waveShare(20, 40)).toBe(0.6);
    expect(motorWaveShare(3)).toBeCloseTo(0.9);
  });
  it('add the current and steer up into it', () => {
    const ground = groundOf(0, 6, { driftKn: 2, setDeg: 180 });
    expect(ground.sog).toBeCloseTo(4);
    expect(ground.cog).toBeCloseTo(0);
    const crab = crabInto(0, 5, { driftKn: 3, setDeg: 90 });
    expect(crab.steer).toBeCloseTo(323.1, 0);
    expect(crab.sog).toBeCloseTo(4);
    expect(crabInto(0, 2, { driftKn: 3, setDeg: 90 }).steer).toBe(0);
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

describe('apparentWind', () => {
  it('comes forward and grows upwind, eases off downwind', () => {
    expect(apparentWind(90, 10, 0)).toStrictEqual({ awa: 90, aws: 10 });
    const close = apparentWind(45, 12, 6);
    expect(close.awa).toBeLessThan(45);
    expect(close.aws).toBeGreaterThan(12);
    const run = apparentWind(180, 12, 6);
    expect(run).toStrictEqual({ awa: 180, aws: 6 });
  });
});
