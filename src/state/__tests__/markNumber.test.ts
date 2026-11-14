import { expect, test } from 'vitest';

import type { Mark } from '../../model/types.ts';
import { markName, nextMarkNumber } from '../marks.ts';

const mark = (n: number, name: string): Mark =>
  ({ id: `m${n}`, n, name, at: '', lat: 0, lon: 0 }) as Mark;

test('a new mark takes one after the highest number kept', () => {
  expect(nextMarkNumber([])).toBe(1);
  expect(nextMarkNumber([mark(1, 'M001'), mark(4, 'M004')])).toBe(5);
});

test('a renamed mark no longer counts: one after the highest M###', () => {
  // M007 renamed « 001 Bretagne »: the next one is M007 again.
  expect(
    nextMarkNumber([mark(5, 'M005'), mark(6, 'M006'), mark(7, '001 Bretagne')]),
  ).toBe(7);
  expect(nextMarkNumber([mark(2, 'Port'), mark(7, 'Bouée verte')])).toBe(1);
  expect(markName(7)).toBe('M007');
});
