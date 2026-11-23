import { describe, expect, it } from 'vitest';

import { routingChanges } from '../routingShift.ts';

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
