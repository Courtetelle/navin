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
      { t, avg: 12, gust: 21 },
    ]);
    expect(paths.top).toBe(25);
    expect(paths.avg).toBe('M0.0 60.8L300.0 41.6');
    expect(paths.gust.endsWith('Z')).toBe(true);
    expect(paths.since).toBe('il y a 3 h');
  });
});
