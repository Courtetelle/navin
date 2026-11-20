import { describe, expect, it } from 'vitest';

import {
  addMinute,
  angleMean,
  binKey,
  binSpeed,
  isRealPolar,
  realMinutes,
  realToPolar,
  sailsName,
  sailsSail,
} from '../realPolar.ts';

describe('the sails', () => {
  it('have a name', () => {
    expect(sailsName({ gv: 'Haute', avant: 'Génois' })).toBe(
      'GV haute · Génois',
    );
    expect(sailsName({ gv: '', avant: 'Code 0' })).toBe('Code 0');
  });
  it('sail unless all down', () => {
    expect(sailsSail({ gv: 'Affalée', avant: 'Aucune' })).toBe(false);
    expect(sailsSail({ gv: 'Affalée', avant: 'Code 0' })).toBe(true);
    expect(sailsSail({ gv: '1 ris', avant: 'Aucune' })).toBe(true);
  });
});

describe('binKey', () => {
  it('rounds the angle to 10° and the wind to 2 kn, either side', () => {
    expect(binKey(87, 11.2)).toBe('90|12');
    expect(binKey(-87, 10.9)).toBe('90|10');
  });
  it('leaves out too close to the wind, no wind, a storm', () => {
    expect(binKey(20, 10)).toBeNull();
    expect(binKey(90, 0.5)).toBeNull();
    expect(binKey(90, 45)).toBeNull();
  });
});

describe('addMinute', () => {
  it('keeps the best minutes of each box', () => {
    let real = addMinute(undefined, 'GV haute · Génois', {
      twa: 90,
      tws: 10,
      kn: 6,
      at: '2027-06-10T10:00:00Z',
    });
    for (const [rank, kn] of [
      5, 7, 6.5, 4, 6.8, 7.2, 5.5, 6.1, 6.9,
    ].entries()) {
      real = addMinute(real, 'GV haute · Génois', {
        twa: 92,
        tws: 10.4,
        kn,
        at: `2027-06-10T09:${String(50 + rank)}:00Z`,
      });
    }
    const bin = real.bins['90|10'];
    expect(bin?.n).toBe(10);
    expect(bin?.best).toHaveLength(8);
    expect(bin?.best[0]).toBe(7.2);
    expect(binSpeed(bin)).toBeCloseTo(6.5, 1);
    expect(real.from).toBe('2027-06-10T09:50:00Z');
    expect(real.to).toBe('2027-06-10T10:00:00Z');
    expect(realMinutes(real)).toBe(10);
    expect(isRealPolar(real)).toBe(true);
  });
  it('does not count a minute out of the boxes', () => {
    const real = addMinute(undefined, 'x', {
      twa: 10,
      tws: 10,
      kn: 3,
      at: '2027-06-10T10:00:00Z',
    });
    expect(realMinutes(real)).toBe(0);
    expect(binSpeed(undefined)).toBe(0);
  });
});

describe('realToPolar', () => {
  it('gives the angles and winds met', () => {
    let real = addMinute(undefined, 'x', { twa: 90, tws: 10, kn: 6, at: 'a' });
    real = addMinute(real, 'x', { twa: 44, tws: 14, kn: 5, at: 'b' });
    expect(realToPolar(real)).toStrictEqual({
      twa: [40, 90],
      tws: [10, 14],
      kn: [
        [0, 5],
        [6, 0],
      ],
    });
  });
});

describe('angleMean', () => {
  it('averages across north', () => {
    const { mean, spread } = angleMean([350, 10]);
    expect(Math.min(mean, 360 - mean)).toBeCloseTo(0);
    expect(spread).toBeCloseTo(10);
  });
  it('knows a non-object', () => {
    expect(isRealPolar(null)).toBe(false);
  });
});
