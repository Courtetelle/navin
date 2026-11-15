import { expect, test } from 'vitest';

import type { Mark } from '../../model/types.ts';
import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { setStorageBackend } from '../../storage/store.ts';
import { data } from '../data.ts';
import { markName, nextMarkNumber, renumberDuplicateMarks } from '../marks.ts';

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

test('two marks with one number (two devices): the later takes a new one', () => {
  setStorageBackend(createMemoryStorage());
  data.marks.value = [
    {
      id: 'a',
      n: 9,
      name: 'M009',
      at: '2026-11-14T21:20:00Z',
      lat: 1,
      lon: 1,
      depth: '',
      note: '',
    },
    {
      id: 'b',
      n: 9,
      name: 'M009',
      at: '2026-11-14T22:54:00Z',
      lat: 2,
      lon: 2,
      depth: '',
      note: '',
    },
    {
      id: 'c',
      n: 10,
      name: 'M010',
      at: '2026-11-14T21:38:00Z',
      lat: 3,
      lon: 3,
      depth: '',
      note: '',
    },
    {
      id: 'd',
      n: 10,
      name: 'M010',
      at: '2026-11-14T22:55:00Z',
      lat: 4,
      lon: 4,
      depth: '',
      note: '',
    },
    {
      id: 'e',
      n: 3,
      name: 'Bouée',
      at: '2026-11-14T20:00:00Z',
      lat: 5,
      lon: 5,
      depth: '',
      note: '',
    },
  ];
  expect(renumberDuplicateMarks()).toBe(2);
  const names = Object.fromEntries(
    data.marks.value.map((mark) => [mark.id, mark.name]),
  );
  expect(names).toStrictEqual({
    a: 'M009',
    b: 'M011',
    c: 'M010',
    d: 'M012',
    e: 'Bouée',
  });
  expect(renumberDuplicateMarks()).toBe(0);
  setStorageBackend(null);
});
