import { expect, test } from 'vitest';

import type { Mark } from '../../model/types.ts';
import { markName, nextMarkNumber } from '../marks.ts';

const mark = (n: number, name: string): Mark =>
  ({ id: `m${n}`, n, name, at: '', lat: 0, lon: 0 }) as Mark;

test('a new mark takes one after the highest number kept', () => {
  expect(nextMarkNumber([])).toBe(1);
  expect(nextMarkNumber([mark(1, 'M001'), mark(4, 'M004')])).toBe(5);
});

test('renamed marks keep their number for the next one', () => {
  expect(nextMarkNumber([mark(2, 'Port'), mark(7, 'Bouée verte')])).toBe(8);
  expect(markName(8)).toBe('M008');
});
