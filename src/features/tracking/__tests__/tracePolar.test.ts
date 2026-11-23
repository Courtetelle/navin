import { describe, expect, it } from 'vitest';

import { destination } from '../../../lib/geo.ts';
import type { Cruise } from '../../../model/types.ts';
import type { TrackPoint } from '../../../state/index.ts';
import {
  MODEL_WIND,
  countTrace,
  sailsAt,
  traceMinutes,
} from '../tracePolar.ts';

const START = { lat: 48.65, lon: -2.83 };
const T0 = Date.UTC(2027, 5, 12, 8);

/** A trace every 10 s at a course and speed. */
function trace(
  seconds: number,
  course: number,
  kn: number,
  from = 0,
): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (let second = 0; second <= seconds; second += 10) {
    const at = destination(START, course, (kn * second) / 3600);
    points.push([T0 + (from + second) * 1000, at.lat, at.lon]);
  }
  return points;
}

describe('traceMinutes', () => {
  it('finds the steady minutes, their course and speed', () => {
    const minutes = traceMinutes(trace(300, 45, 6));
    expect(minutes.length).toBeGreaterThanOrEqual(4);
    expect(minutes[0]?.kn).toBeCloseTo(6, 0);
    expect(minutes[0]?.cog).toBeCloseTo(45, 0);
  });
  it('drops a hole and a turn', () => {
    const holed = [...trace(30, 45, 6), ...trace(30, 45, 6, 200)];
    expect(traceMinutes(holed)).toStrictEqual([]);
    const turning: TrackPoint[] = [];
    for (let second = 0; second <= 60; second += 10) {
      const at = destination(START, second * 3, 0.01 + second / 3600);
      turning.push([T0 + second * 1000, at.lat, at.lon]);
    }
    expect(traceMinutes(turning)).toStrictEqual([]);
  });
});

describe('sailsAt', () => {
  it('takes the sails of the logbook before the time', () => {
    const cruise = {
      entries: [
        { id: 'a', t: new Date(T0).toISOString(), v: { gv: '1 ris' } },
        {
          id: 'b',
          t: new Date(T0 + 3_600_000).toISOString(),
          v: { avant: 'Code 0' },
        },
      ],
    } as unknown as Cruise;
    expect(sailsAt(cruise, T0 + 60_000)).toStrictEqual({
      gv: '1 ris',
      avant: 'Génois',
    });
    expect(sailsAt(cruise, T0 + 7_200_000)).toStrictEqual({
      gv: '1 ris',
      avant: 'Code 0',
    });
    expect(sailsAt(null, T0)).toStrictEqual({ gv: 'Haute', avant: 'Génois' });
  });
});

describe('countTrace', () => {
  it('counts the minutes with the wind of the model, apart from the instruments', () => {
    const minutes = traceMinutes(trace(300, 62, 6));
    const { list, counted } = countTrace(
      [],
      minutes,
      () => ({ twd: 0, tws: 12 }),
      () => ({ gv: 'Haute', avant: 'Génois' }),
    );
    expect(counted).toBe(minutes.length);
    expect(list[0]?.sails).toBe(`GV haute · Génois · ${MODEL_WIND}`);
    expect(Object.keys(list[0]?.bins ?? {})).toStrictEqual(['60|12']);
  });
  it('counts nothing without wind or under bare poles', () => {
    const minutes = traceMinutes(trace(120, 45, 6));
    expect(
      countTrace(
        [],
        minutes,
        () => null,
        () => ({ gv: 'Haute', avant: '' }),
      ).counted,
    ).toBe(0);
    expect(
      countTrace(
        [],
        minutes,
        () => ({ twd: 0, tws: 12 }),
        () => ({ gv: 'Affalée', avant: 'Aucune' }),
      ).counted,
    ).toBe(0);
  });
});
