import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SHIFT,
  routingChanges,
  routingCost,
  saveShiftPrefs,
  shiftPrefs,
  sortByCost,
} from '../routingShift.ts';

const base = { nm: 30, sailMin: 300, motorMin: 0, tacks: 2, gybes: 0 };

describe('routingChanges', () => {
  it('says what moving the ETD changes against the first routing', () => {
    expect(routingChanges(base, base, 300, 300)).toStrictEqual([]);
    expect(
      routingChanges(
        { ...base, motorMin: 45, tacks: 4, gybes: 1 },
        base,
        380,
        300,
      ),
    ).toStrictEqual([
      'durée +1 h 20',
      'moteur +45 min',
      '+2 virements',
      '+1 empannage',
    ]);
    expect(routingChanges({ ...base, tacks: 1 }, base, 290, 300)).toStrictEqual(
      ['durée −10 min', '−1 virement'],
    );
  });
});

describe('routingCost', () => {
  it('counts the minutes under way, the motor half more', () => {
    const ms = Date.UTC(2027, 5, 12, 8);
    const result = {
      kind: 'done' as const,
      steps: [{ ms } as never],
      legs: [],
      arriveMs: ms + 4 * 3_600_000,
      nm: 24,
      sailMin: 180,
      motorMin: 60,
      tacks: 0,
      gybes: 0,
    };
    expect(routingCost(result)).toBe(270);
  });
});

describe('shiftPrefs', () => {
  it('moves the ETD by 30 minutes by default, and keeps what is set', () => {
    expect(DEFAULT_SHIFT).toStrictEqual({ stepMin: 30, moves: 'etd' });
    saveShiftPrefs({ stepMin: 60, moves: 'eta' });
    expect(shiftPrefs.value).toStrictEqual({ stepMin: 60, moves: 'eta' });
    saveShiftPrefs(DEFAULT_SHIFT);
  });
});

describe('sortByCost', () => {
  it('sorts the routings of the day from the most efficient', () => {
    const ms = Date.UTC(2027, 5, 12, 8);
    const one = (hours: number, motorMin: number) => ({
      kind: 'done' as const,
      steps: [{ ms } as never],
      legs: [],
      arriveMs: ms + hours * 3_600_000,
      nm: 24,
      sailMin: 0,
      motorMin,
      tacks: 0,
      gybes: 0,
    });
    const sorted = sortByCost([one(5, 0), one(4, 120), one(4, 0)]);
    expect(sorted.map((item) => routingCost(item))).toStrictEqual([
      240, 300, 300,
    ]);
  });
});
