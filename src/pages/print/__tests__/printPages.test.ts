import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  load,
  useHarnessClock,
} from '../../../features/data/__tests__/fixtures.ts';
import { state } from '../../../state/index.ts';
import { defaultSelection, printPages } from '../printPages.ts';

function pagesOfOpenCruise() {
  const cruise = state.data.cruise.value;
  if (!cruise) throw new Error('no cruise');
  return printPages(cruise);
}

beforeEach(useHarnessClock);

afterEach(() => {
  vi.useRealTimers();
});

test('a lake outing offers its day and the PréP report', () => {
  load('sample-lake');

  expect(pagesOfOpenCruise().map((page) => page.id)).toStrictEqual([
    'title',
    'tech',
    'crew',
    'safety',
    'radio',
    'day:2026-07-15',
    'prep',
    'blank',
  ]);
});

test('a day page counts its entries', () => {
  load('sample-sea');

  expect(pagesOfOpenCruise().filter((page) => page.day)).toStrictEqual([
    {
      id: 'day:2026-07-14',
      label: 'Journée du 14/07/2026',
      sub: '3 entrées',
      day: true,
    },
    {
      id: 'day:2026-07-15',
      label: 'Journée du 15/07/2026',
      sub: '2 entrées',
      day: true,
    },
  ]);
});

test('the optional pages start unchecked', () => {
  load('sample-lake');

  expect([...defaultSelection(pagesOfOpenCruise())]).toStrictEqual([
    'title',
    'crew',
    'safety',
    'radio',
    'day:2026-07-15',
  ]);
});

test('without crew, the crew list starts unchecked', () => {
  expect([
    ...defaultSelection([
      { id: 'title', label: 'Titre' },
      { id: 'crew', label: 'Équipage', off: true },
    ]),
  ]).toStrictEqual(['title']);
});
