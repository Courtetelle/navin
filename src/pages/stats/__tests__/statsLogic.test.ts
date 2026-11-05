import { expect, test } from 'vitest';

import { isoWeek, periodOf, statsSummary } from '../statsLogic.ts';

const DAYS = [
  { k: '2026-07-15', boatId: 'a', nm: 10, ms: 3_600_000 },
  { k: '2026-07-16', boatId: 'b', nm: 5, ms: 1_800_000 },
  { k: '2026-06-01', boatId: 'a', nm: 20, ms: 7_200_000 },
];

test('isoWeek follows ISO 8601 around the new year', () => {
  expect(isoWeek(new Date(2026, 6, 15))).toStrictEqual([2026, 29]);
  expect(isoWeek(new Date(2027, 0, 1))).toStrictEqual([2026, 53]);
  expect(isoWeek(new Date(2024, 11, 30))).toStrictEqual([2025, 1]);
});

test('periodOf gives a sort key and a label', () => {
  expect(periodOf('2026-07-15', 'annee')).toStrictEqual(['2026', '2026']);
  expect(periodOf('2026-07-15', 'mois')).toStrictEqual([
    '2026-07',
    'juillet 2026',
  ]);
  expect(periodOf('2026-07-15', 'semaine')).toStrictEqual([
    '2026-29',
    'Semaine 29 · 2026',
  ]);
});

test('statsSummary groups by period, newest first', () => {
  const summary = statsSummary(DAYS, new Set(), 'mois');
  expect(summary.total).toStrictEqual({ n: 3, nm: 35, ms: 12_600_000 });
  expect(summary.max).toBe(20);
  expect(summary.periods).toStrictEqual([
    ['2026-07', { label: 'juillet 2026', n: 2, nm: 15, ms: 5_400_000 }],
    ['2026-06', { label: 'juin 2026', n: 1, nm: 20, ms: 7_200_000 }],
  ]);
});

test('statsSummary keeps the boats chosen; nothing left gives a max of 1', () => {
  expect(statsSummary(DAYS, new Set(['b']), 'annee').total).toStrictEqual({
    n: 1,
    nm: 5,
    ms: 1_800_000,
  });
  const none = statsSummary(DAYS, new Set(['z']), 'annee');
  expect(none.periods).toStrictEqual([]);
  expect(none.max).toBe(1);
});
