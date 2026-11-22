import { expect, test } from 'vitest';

import { FIXED_ALERTS } from '../../../model/fixedAlerts.ts';
import { byDistance, fixedDistance } from '../fixedSort.ts';

const SAINT_QUAY = { lat: 48.65, lon: -2.83 };
const PORQUEROLLES = { lat: 43, lon: 6.2 };

test('the fixed alerts sorted from the nearest zone, those without one last', () => {
  const near = byDistance(FIXED_ALERTS, SAINT_QUAY);
  expect(near[0]?.id).toBe('st-brieuc');
  expect(near).toHaveLength(FIXED_ALERTS.length);
  const distances = near.map((alert) => fixedDistance(alert, SAINT_QUAY));
  expect(distances).toStrictEqual(distances.toSorted((a, b) => a - b));
  expect(byDistance(FIXED_ALERTS, PORQUEROLLES)[0]?.sea).toBe('mediterranee');
});

test('inside a zone the distance is 0, without a zone it is infinite', () => {
  const bay = FIXED_ALERTS.find((alert) => alert.id === 'st-brieuc');
  if (!bay?.zone) throw new Error('no bay');
  expect(fixedDistance(bay, bay.zone)).toBe(0);
  expect(fixedDistance({ ...bay, zone: null }, SAINT_QUAY)).toBe(
    Number.POSITIVE_INFINITY,
  );
});
