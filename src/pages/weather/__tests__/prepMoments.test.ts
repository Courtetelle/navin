import { expect, test } from 'vitest';

import type { ForecastRow } from '../../../features/tracking/index.ts';
import { prepMoments } from '../prepMoments.ts';

function hours(from: Date, count: number): ForecastRow[] {
  return Array.from({ length: count }, (_, index) => ({
    t: from.getTime() + index * 3_600_000,
    tws: index,
    twd: 200,
    gust: index + 4,
    air: 15,
    rain: 0,
    cape: 0,
  }));
}

test('in the morning: now, in 3 h, this evening and tomorrow morning', () => {
  const now = new Date(2026, 6, 15, 9, 10);
  const rows = hours(new Date(2026, 6, 15, 9), 40);
  const moments = prepMoments(rows, now.getTime());
  expect(moments.map((moment) => moment.key)).toStrictEqual([
    'now',
    'later',
    'evening',
    'morning',
  ]);
  expect(new Date(moments[1]?.row.t ?? 0).getHours()).toBe(12);
  expect(new Date(moments[2]?.row.t ?? 0).getHours()).toBe(19);
  const morning = new Date(moments[3]?.row.t ?? 0);
  expect([morning.getDate(), morning.getHours()]).toStrictEqual([16, 8]);
});

test('less than 3 h before the evening, no evening', () => {
  const now = new Date(2026, 6, 15, 17, 0);
  const rows = hours(new Date(2026, 6, 15, 17), 20);
  expect(
    prepMoments(rows, now.getTime()).map((moment) => moment.key),
  ).toStrictEqual(['now', 'later', 'morning']);
});

test('a forecast too short leaves the far moments out', () => {
  const now = new Date(2026, 6, 15, 9, 0);
  const rows = hours(new Date(2026, 6, 15, 9), 4);
  expect(
    prepMoments(rows, now.getTime()).map((moment) => moment.key),
  ).toStrictEqual(['now', 'later']);
});
