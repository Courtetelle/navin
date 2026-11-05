import { expect, test } from 'vitest';

import { expNote, expParse, expState } from '../expiry.ts';

const NOW = new Date(2026, 6, 15, 10, 30);

test('dates are read in their usual forms', () => {
  expect(expParse('2027-03-31')).toStrictEqual(new Date(2027, 2, 31));
  expect(expParse('31.03.2027')).toStrictEqual(new Date(2027, 2, 31));
  expect(expParse('31/3/27')).toStrictEqual(new Date(2027, 2, 31));
  expect(expParse('03.2027')).toStrictEqual(new Date(2027, 3, 0));
  expect(expParse('bientôt')).toBeNull();
  expect(expParse(null)).toBeNull();
});

test('expired, soon expired or valid', () => {
  expect(expState('14.07.2026', NOW)).toBe('bad');
  expect(expState('15.07.2026', NOW)).toBe('warn');
  expect(expState('14.10.2026', NOW)).toBe('warn');
  expect(expState('15.10.2026', NOW)).toBe('ok');
  expect(expState('', NOW)).toBe('');
});

test('note under the field', () => {
  expect(expNote('bad')).toBe('Expirée');
  expect(expNote('warn')).toBe('Expire dans moins de 3 mois');
  expect(expNote('ok')).toBe('');
  expect(expNote('')).toBe('');
});
