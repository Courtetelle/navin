import { expect, test } from 'vitest';

import type { Hour } from '../goNoGo.ts';
import {
  corrected,
  dayVerdict,
  lengthShift,
  pointOfSail,
  thresholdsOf,
} from '../goNoGo.ts';

const DUFOUR = {
  loa: 13.6,
  ce: 'A',
  kind: 'monocoque',
  smallCrew: false,
} as const;

function hours(rows: Array<Partial<Hour>>): Hour[] {
  return rows.map((row, index) => ({
    t: index * 3_600_000,
    windKn: null,
    windFrom: 270,
    gustKn: null,
    hs: null,
    period: null,
    windSeaHs: null,
    windSeaSteep: null,
    windSeaDir: null,
    swellHs: null,
    swellDir: null,
    cape: null,
    cin: null,
    pressure: null,
    rain: null,
    ...row,
  }));
}

test('thresholds follow the boat', () => {
  const reference = thresholdsOf(DUFOUR);
  expect(reference.wind.pres).toStrictEqual([18, 25]);
  expect(reference.hs).toStrictEqual([2, 3.5]);
  expect(reference.cap).toBeNull();
  const small = thresholdsOf({ ...DUFOUR, loa: 7, ce: 'C', smallCrew: true });
  expect(small.wind.pres).toStrictEqual([9, 16]);
  expect(small.hs).toStrictEqual([0.5, 2]);
  expect(small.cap).toStrictEqual({ windKn: 27, hs: 2 });
  expect(lengthShift(9)).toStrictEqual({ kn: -3, m: -0.5 });
  expect(lengthShift(15)).toStrictEqual({ kn: 3, m: 0.5 });
  expect(thresholdsOf({ ...DUFOUR, kind: 'multicoque' }).gustGap).toBe(0);
  expect(thresholdsOf({ ...DUFOUR, kind: 'deriveur' }).shortHs).toStrictEqual([
    0.5, 1,
  ]);
});

test('point of sail', () => {
  expect(pointOfSail(null, 270)).toBe('pres');
  expect(pointOfSail(270, 290)).toBe('pres');
  expect(pointOfSail(0, 270)).toBe('travers');
  expect(pointOfSail(90, 270)).toBe('portant');
});

test('a criterion counts two hours in a row; one hour is only said', () => {
  const limits = thresholdsOf(DUFOUR);
  const one = hours([{ windKn: 12 }, { windKn: 19 }, { windKn: 12 }]);
  const single = dayVerdict(one, one, limits, null);
  expect(single.light).toBe('go');
  expect(single.isolated[0]).toContain('vent moyen 19 nd');
  const two = hours([{ windKn: 19 }, { windKn: 19 }]);
  expect(dayVerdict(two, two, limits, null).light).toBe('prudence');
  const red = hours([{ windKn: 26 }, { windKn: 27 }]);
  expect(dayVerdict(red, red, limits, null).light).toBe('nogo');
});

test('gusts count with a gap of 12 kn; two oranges make red', () => {
  const limits = thresholdsOf(DUFOUR);
  const steady = hours([
    { windKn: 17, gustKn: 28 },
    { windKn: 17, gustKn: 28 },
  ]);
  expect(dayVerdict(steady, steady, limits, null).light).toBe('go');
  const gusty = hours([
    { windKn: 15, gustKn: 29 },
    { windKn: 15, gustKn: 30 },
  ]);
  expect(dayVerdict(gusty, gusty, limits, null).light).toBe('prudence');
  const both = hours([
    { windKn: 19, gustKn: 31, hs: 2.2 },
    { windKn: 19, gustKn: 31, hs: 2.2 },
  ]);
  const verdict = dayVerdict(both, both, limits, null);
  expect(verdict.light).toBe('nogo');
  expect(verdict.reasons).toContain('deux critères orange en même temps');
});

test('a measure corrects the next hours, fading over 6 h', () => {
  const times = [0, 1, 2, 3, 6, 9].map((hour) => hour * 3_600_000);
  const values = corrected([10, 10, 10, 10, 10, 10], times, {
    value: 15,
    t: 0,
  });
  expect(values[0]).toBe(15);
  expect(values[3]).toBeCloseTo(12.5);
  expect(values[4]).toBe(10);
  expect(values[5]).toBe(10);
});
