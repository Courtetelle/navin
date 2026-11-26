import { describe, expect, it } from 'vitest';

import {
  hourText,
  labelLines,
  nightOf,
  stormRisk,
  worstAgainst,
} from '../routingLabel.ts';
import {
  DEFAULT_SHIFT,
  canGoEarlier,
  planKey,
  rankDeparts,
  routingChanges,
  routingCost,
  saveShiftPrefs,
  shiftPrefs,
  sortByCost,
} from '../routingShift.ts';
import { markAt } from '../routingState.ts';

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
  it('moves the ETD by 30 minutes and sorts 6 hours by default, and keeps what is set', () => {
    expect(DEFAULT_SHIFT).toStrictEqual({ stepMin: 30, rankHours: 6 });
    saveShiftPrefs({ stepMin: 60, rankHours: 24 });
    expect(shiftPrefs.value).toStrictEqual({ stepMin: 60, rankHours: 24 });
    saveShiftPrefs(DEFAULT_SHIFT);
  });
});

describe('canGoEarlier', () => {
  it('never departs before now', () => {
    const now = Date.UTC(2027, 5, 12, 8);
    expect(canGoEarlier(now + 3_600_000, 30, now)).toBe(true);
    expect(canGoEarlier(now + 20 * 60_000, 30, now)).toBe(false);
    expect(canGoEarlier(now, 10, now)).toBe(false);
  });
});

describe('rankDeparts', () => {
  it('takes the next hours from now, about 25 departures at most', () => {
    const now = Date.UTC(2027, 5, 12, 8, 10);
    const six = rankDeparts(6, 30, now);
    expect(six[0]).toBe(Date.UTC(2027, 5, 12, 8, 30));
    expect(six.at(-1)).toBe(Date.UTC(2027, 5, 12, 14));
    expect(six).toHaveLength(12);
    const day = rankDeparts(24, 30, now);
    expect((day[1] ?? 0) - (day[0] ?? 0)).toBe(3_600_000);
    expect(day.length).toBeLessThanOrEqual(25);
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

describe('labelLines', () => {
  const departMs = new Date(2027, 5, 12, 21, 30).getTime();
  const plan = {
    routeId: 'r',
    boatId: 'b',
    motorBelow: 5,
    motorKn: 6,
    model: 'best_match',
    base: {
      departMs,
      arriveMs: departMs + 5 * 3_600_000,
      stats: { ...base },
    },
  };
  const shown = {
    name: 'Routage',
    departMs,
    arriveMs: departMs + 5 * 3_600_000,
    plan,
    stats: {
      ...base,
      motorMin: 70,
      maxTws: 18.4,
      maxGust: 26,
      maxWaveM: 1.4,
      maxCape: 800,
    },
    track: [],
    turns: [],
    marks: [],
  };

  it('gives the hours, length, manoeuvres, motor, wind, waves and storms', () => {
    expect(hourText(departMs)).toBe('21h30');
    expect(labelLines(shown, null)).toStrictEqual([
      'ETD 21h30 · ETA 02h30',
      'Durée 5 h 00',
      'Distance 30,0 NM · moyenne 6,0 nd',
      '2 virements · 0 empannage',
      'Moteur 1 h 10',
      'Vent max 18 nd · rafales 26 nd',
      'Vagues max 1,4 m',
      'Risque orageux possible (CAPE 800 J/kg)',
    ]);
  });

  it('says the time lost against the best departure of the next hours', () => {
    const best = {
      key: planKey(plan),
      hours: 6,
      departMs: departMs + 3_600_000,
      lengthMin: 240,
      soonDepartMs: departMs - 3_600_000,
      soonLengthMin: 345,
      motorMin: 30,
      at: departMs,
    };
    expect(labelLines(shown, best)[2]).toBe(
      '+1 h 00 sur le meilleur départ des prochaines 6 h (22h30)',
    );
    // Another departure shorter, with more motor.
    expect(labelLines(shown, { ...best, lengthMin: 330 })[2]).toBe(
      '−30 min sur le meilleur départ des prochaines 6 h (22h30), mais 40 min de moteur en plus',
    );
    expect(labelLines(shown, { ...best, lengthMin: 300 })[2]).toBe(
      'Même durée que le meilleur départ des prochaines 6 h (22h30)',
    );
    // The best shown: the time gained on leaving at the first hour.
    const itself = { ...best, departMs, lengthMin: 300 };
    expect(labelLines(shown, itself)[2]).toBe(
      'Meilleur départ des prochaines 6 h : −45 min sur un départ à 20h30',
    );
    expect(labelLines(shown, { ...itself, soonLengthMin: 270 })[2]).toBe(
      'Meilleur départ des prochaines 6 h : +30 min sur un départ à 20h30',
    );
    expect(labelLines(shown, { ...itself, soonDepartMs: departMs })[2]).toBe(
      'Meilleur départ des prochaines 6 h',
    );
    expect(labelLines(shown, { ...best, key: 'other' })[2]).toBe(
      'Distance 30,0 NM · moyenne 6,0 nd',
    );
  });

  it('reads the storm risk with the go/no-go thresholds', () => {
    expect(stormRisk(200)).toBe('faible');
    expect(stormRisk(500)).toBe('possible');
    expect(stormRisk(1500)).toBe('fort');
  });
});

describe('worstAgainst', () => {
  it('finds the strongest current flowing against the wind', () => {
    const ms = Date.UTC(2027, 5, 12, 8);
    const point = (setDeg: number, driftKn: number, tws: number) => ({
      ms,
      twd: 270,
      tws,
      setDeg,
      driftKn,
    });
    expect(worstAgainst([point(90, 3, 20)])).toBeNull();
    expect(worstAgainst([point(260, 0.3, 20)])).toBeNull();
    const worst = point(250, 2, 20);
    expect(worstAgainst([point(280, 1, 20), worst, point(90, 4, 25)])).toBe(
      worst,
    );
  });
});

describe('nightOf', () => {
  it('counts the minutes under way between sunset and sunrise', () => {
    // Saint-Quay-Portrieux, mid-June: sunset about 22:00 UTC+2.
    const place = { lat: 48.65, lon: -2.83 };
    const noon = Date.UTC(2027, 5, 15, 10);
    expect(nightOf(noon, noon + 4 * 3_600_000, place).minutes).toBe(0);
    const evening = Date.UTC(2027, 5, 15, 18);
    const night = nightOf(evening, evening + 4 * 3_600_000, place);
    expect(night.minutes).toBeGreaterThan(60);
    expect(night.minutes).toBeLessThan(4 * 60);
    expect(night.set).not.toBeNull();
  });
});

function playMark(lat: number, at: number, tws: number) {
  return {
    lat,
    lon: -2.8,
    ms: at,
    twd: 270,
    tws,
    setDeg: 0,
    driftKn: 0,
    waveM: null,
  };
}

describe('markAt', () => {
  it('places the boat played between the marks, with their weather', () => {
    const ms = Date.UTC(2027, 5, 12, 8);
    const shown = {
      name: 'Routage',
      departMs: ms,
      arriveMs: ms + 2 * 3_600_000,
      track: [
        [48.6, -2.8],
        [48.8, -2.8],
      ] as Array<[number, number]>,
      turns: [],
      marks: [playMark(48.6, ms, 10), playMark(48.7, ms + 3_600_000, 14)],
    };
    expect(markAt(shown, ms - 1)?.lat).toBe(48.6);
    const half = markAt(shown, ms + 1_800_000);
    expect(half?.lat).toBeCloseTo(48.65);
    expect(half?.tws).toBe(10);
    const late = markAt(shown, ms + 1.5 * 3_600_000);
    expect(late?.lat).toBeCloseTo(48.75);
    expect(late?.tws).toBe(14);
  });
});
