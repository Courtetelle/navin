import { describe, expect, it } from 'vitest';

import { forecastPeak, weatherChecks } from '../weatherChecks.ts';

function row(t: number, tws: number, gust: number | null) {
  return { t, tws, gust, twd: 0, air: null, rain: null, cape: null };
}

describe('weatherChecks', () => {
  it('asks for the sea state at sea, the storms on a lake', () => {
    const sea = weatherChecks(false).map((check) => check.id);
    const lake = weatherChecks(true).map((check) => check.id);
    expect(sea).toContain('sea');
    expect(lake).toContain('storms');
    expect(sea).toHaveLength(6);
    expect(new Set(lake).size).toBe(6);
  });

  it('finds the strongest hour', () => {
    expect(
      forecastPeak([row(1, 8, 12), row(2, 10, 18), row(3, 12, 15)]),
    ).toEqual({
      t: 2,
      tws: 10,
      gust: 18,
    });
    expect(forecastPeak([])).toBeNull();
  });
});
