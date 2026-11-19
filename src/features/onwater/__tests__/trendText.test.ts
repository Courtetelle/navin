import { describe, expect, it } from 'vitest';

import { chartPaths, trendText } from '../trendText.ts';

describe('trendText', () => {
  it('says the trend in one sentence', () => {
    expect(trendText({ way: 'up', change: 5.6, minutes: 60 })).toBe(
      '↗ En hausse : +6 nd en 1 h',
    );
    expect(trendText({ way: 'down', change: -4.2, minutes: 90 })).toBe(
      '↘ En baisse : −4 nd en 1 h 30',
    );
    expect(trendText({ way: 'flat', change: 1, minutes: 45 })).toBe(
      '→ Stable depuis 45 min',
    );
    expect(trendText(null)).toContain('pas encore');
  });

  it('draws the mean wind and the gusts band', () => {
    const t = Date.parse('2026-11-10T12:00:00Z');
    const paths = chartPaths([
      { t: t - 3 * 3_600_000, avg: 6, gust: 9 },
      ...Array.from({ length: 5 }, (_, index) => ({
        t: t - (5 - index) * 1_800_000,
        avg: 9,
        gust: 15,
      })),
      { t, avg: 12, gust: 21 },
    ]);
    expect(paths.top).toBe(25);
    expect(paths.avg.startsWith('M0.0 60.8L')).toBe(true);
    expect(paths.avg.endsWith('L300.0 41.6')).toBe(true);
    expect(paths.gust.endsWith('Z')).toBe(true);
    expect(paths.since).toBe('il y a 3 h');
  });

  it('cuts the curve where the record stopped', () => {
    const t = Date.parse('2026-11-10T12:00:00Z');
    const paths = chartPaths([
      { t: t - 5 * 3_600_000, avg: 6, gust: 9 },
      { t: t - 5 * 3_600_000 + 600_000, avg: 7, gust: 10 },
      { t: t - 600_000, avg: 10, gust: 18 },
      { t, avg: 12, gust: 21 },
    ]);
    expect(paths.avg.match(/M/g)).toHaveLength(2);
    expect(paths.gust.match(/Z/g)).toHaveLength(2);
  });
});
