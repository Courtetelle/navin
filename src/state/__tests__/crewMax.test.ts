import { expect, test } from 'vitest';

import { crewMaxFromCategory } from '../boatMigrations.ts';

test('the design category text becomes the number of people on board', () => {
  const info: Record<string, unknown> = {
    category: 'A · 8 personnes au maximum',
  };
  expect(crewMaxFromCategory(info)).toBe(true);
  expect(info).toStrictEqual({ category: '8' });
});

test('without the letter too', () => {
  const info: Record<string, unknown> = { category: '12 personnes' };
  expect(crewMaxFromCategory(info)).toBe(true);
  expect(info).toStrictEqual({ category: '12' });
});

test('a number, or another text, is left as it is', () => {
  const number: Record<string, unknown> = { category: '8' };
  expect(crewMaxFromCategory(number)).toBe(false);
  expect(number).toStrictEqual({ category: '8' });
  expect(crewMaxFromCategory({ category: 'Croisière' })).toBe(false);
  expect(crewMaxFromCategory(null)).toBe(false);
});
