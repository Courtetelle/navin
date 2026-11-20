import { expect, test } from 'vitest';

import { bft } from '../../lib/wind.ts';
import type { Combined, CombinedInput } from '../beaufortDouglas.ts';
import {
  SCALE_GROUPS,
  SEA_OF_FORCE,
  assembledReading,
  brokenDownReading,
  combine,
  degreeOfHeight,
  forceOfDegree,
  groupOfDegree,
  groupOfForce,
  parseTyped,
} from '../beaufortDouglas.ts';
import { BEAUFORT_TBL } from '../lists.ts';

const knots = (force: number) => BEAUFORT_TBL[force]?.[1] ?? '';

function read(input: CombinedInput): Combined {
  const combined = combine(input, bft);
  if (!combined) throw new Error('no reading');
  return combined;
}

test('every force and every degree has one group, in order', () => {
  const forces = SCALE_GROUPS.flatMap((group) => group.forces);
  const degrees = SCALE_GROUPS.flatMap((group) => group.degrees);
  expect(forces).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(degrees).toStrictEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  // The sea of each force lies in the group of that force.
  for (const [force, degree] of SEA_OF_FORCE.entries()) {
    expect(groupOfDegree(degree)).toBe(groupOfForce(force));
  }
});

test('the open-sea sea follows the WMO probable heights', () => {
  // Force 5: 2 m (degree 4); force 6: 3 m (5); force 9: 7 m (7).
  expect(SEA_OF_FORCE[5]).toBe(degreeOfHeight(2));
  expect(SEA_OF_FORCE[6]).toBe(degreeOfHeight(3));
  expect(SEA_OF_FORCE[9]).toBe(degreeOfHeight(7));
  expect(degreeOfHeight(0)).toBe(0);
  expect(degreeOfHeight(1.25)).toBe(3);
  expect(degreeOfHeight(1.26)).toBe(4);
  expect(degreeOfHeight(20)).toBe(9);
  expect(forceOfDegree(4)).toBe(5);
  expect(forceOfDegree(6)).toBe(7);
  expect(forceOfDegree(9)).toBe(12);
});

test('a wind alone: the sea is the open-sea theory', () => {
  const combined = read({ windKn: 18, waveM: null, periodS: null });
  expect(combined).toMatchObject({
    force: 5,
    degree: 4,
    seaAuto: true,
    windAuto: false,
    gap: 0,
    note: '5 / 4',
  });
  expect(assembledReading(combined, false)[0]).toBe(
    'Conditions maniables mais toniques.',
  );
  expect(brokenDownReading(combined, knots, false)).toStrictEqual([
    'Vent force 5 (17 à 21 nœuds).',
    'Mer 4, agitée (1,25 à 2,5 m) (théorique).',
  ]);
});

test('a sea alone: the wind is the one raising it in open sea', () => {
  const combined = read({ windKn: null, waveM: 3, periodS: 9 });
  expect(combined).toMatchObject({
    force: 6,
    degree: 5,
    windAuto: true,
    note: '6 / 5 (9 s)',
  });
});

test('wind fallen, sea left: the sea is above the wind', () => {
  const combined = read({ windKn: 5, waveM: 3, periodS: null });
  expect(combined).toMatchObject({ force: 2, degree: 5, gap: 3 });
  const lines = assembledReading(combined, false);
  expect(lines[0]).toBe('Petit temps, sur une mer forte.');
  expect(lines[1]).toContain('Mer plus forte que le vent');
  expect(lines[2]).toContain('changement de temps');
  expect(brokenDownReading(combined, knots, false)[2]).toBe(
    'Écart : la mer est 3 degrés au-dessus de la mer 2 que ce vent lève en pleine mer.',
  );
});

test('strong wind on a sheltered sea, in English', () => {
  const combined = read({ windKn: 30, waveM: 0.4, periodS: null });
  expect(combined).toMatchObject({ force: 7, degree: 2, gap: -4 });
  const lines = assembledReading(combined, true);
  expect(lines[0]).toBe(
    'Strong wind: reefed, take care, on a smooth (wavelets) sea.',
  );
  expect(lines[1]).toContain('Wind much stronger than the sea');
  expect(brokenDownReading(combined, knots, true)[0]).toBe(
    'Wind force 7 (28 to 33 kn).',
  );
});

test('nothing typed, nothing read; numbers with a comma', () => {
  expect(combine({ windKn: null, waveM: null, periodS: 5 }, bft)).toBeNull();
  expect(parseTyped(' 4,7 ')).toBe(4.7);
  expect(parseTyped('12')).toBe(12);
  expect(parseTyped('')).toBeNull();
  expect(parseTyped('abc')).toBeNull();
  expect(parseTyped('-3')).toBeNull();
});
