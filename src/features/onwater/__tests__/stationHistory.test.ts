/* eslint-disable camelcase -- names in the APIs */
import { describe, expect, it } from 'vitest';

import {
  mergePoints,
  mfPoints,
  owmPoints,
  smnPoints,
  windTrend,
} from '../stationHistory.ts';

const NOW = Date.parse('2026-11-10T12:00:00Z');
const MIN = 60_000;

function line(
  values: number[],
  step = 10,
): Array<{ t: number; avg: number; gust: null }> {
  return values.map((avg, index) => ({
    t: NOW - (values.length - 1 - index) * step * MIN,
    avg,
    gust: null,
  }));
}

describe('stationHistory', () => {
  it('reads the OpenWindMap archive in knots', () => {
    const points = owmPoints({
      data: [
        ['2026-11-10T11:00:00.000Z', 43, 5, 0, 18.52, 37.04, 90, null],
        'bad',
      ],
    });
    expect(points).toHaveLength(1);
    expect(points[0]?.avg).toBeCloseTo(10);
    expect(points[0]?.gust).toBeCloseTo(20);
  });

  it('reads MeteoSwiss and Météo-France rows', () => {
    const smn = smnPoints([{ t: NOW, fu3010z0: '18.52', fu3010z1: null }]);
    expect(smn[0]?.avg).toBeCloseTo(10);
    expect(smn[0]?.gust).toBeNull();
    const mf = mfPoints([
      { validity_time: '2026-11-10T11:54:00Z', ff: 5, fxi10: 10 },
      { validity_time: '2026-11-10T11:48:00Z', ff: null },
    ]);
    expect(mf).toHaveLength(1);
    expect(mf[0]?.avg).toBeCloseTo(9.72, 1);
    expect(mf[0]?.gust).toBeCloseTo(19.44, 1);
  });

  it('merges, sorts and drops old or duplicate points', () => {
    const merged = mergePoints(
      [
        { t: NOW - 10 * MIN, avg: 5, gust: null },
        { t: NOW - 4 * 3_600_000, avg: 1, gust: null },
      ],
      [
        { t: NOW - 10 * MIN + 20_000, avg: 6, gust: null },
        { t: NOW - 30 * MIN, avg: 4, gust: null },
      ],
      NOW,
    );
    expect(merged.map((point) => point.avg)).toEqual([4, 5]);
  });

  it('says where the wind goes', () => {
    expect(windTrend(line([8, 8, 9, 10, 12, 14, 15]))).toMatchObject({
      way: 'up',
      minutes: 60,
    });
    expect(windTrend(line([15, 15, 14, 12, 10, 9, 8]))?.way).toBe('down');
    expect(windTrend(line([10, 11, 10, 9, 10, 11, 10]))?.way).toBe('flat');
    expect(windTrend(line([10, 11, 12]))).toBeNull();
  });
});

describe('rememberReadings', () => {
  it('keeps a day, one point every 8 minutes at most', async () => {
    const { rememberReadings, stationHistory } =
      await import('../stationHistory.ts');
    const { createMemoryStorage } =
      await import('../../../storage/memoryStorage.ts');
    const { setStorageBackend } = await import('../../../storage/store.ts');
    setStorageBackend(createMemoryStorage({}));
    const station = { id: 'X', net: 'Test' };
    for (let minutes = 0; minutes <= 30 * 60; minutes += 4) {
      const t = NOW - 30 * 3_600_000 + minutes * MIN;
      rememberReadings([{ ...station, t, avg: 10.04, gust: null }], t);
    }
    const day = await stationHistory(station, '', NOW, 24 * 3_600_000);
    expect(day.length).toBeGreaterThan(170);
    expect(day.length).toBeLessThanOrEqual(181);
    expect(day[0]?.avg).toBe(10);
    expect(
      day.every(
        (point, index) =>
          index === 0 || point.t - (day[index - 1]?.t ?? 0) >= 8 * MIN,
      ),
    ).toBe(true);
  });
});
