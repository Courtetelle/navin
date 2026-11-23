import { describe, expect, it } from 'vitest';

import type { RainIndex } from '../rainAhead.ts';
import {
  parseRainIndex,
  rainFileAt,
  rainImageSize,
  rainPixels,
} from '../rainAhead.ts';

const raw = {
  model: 'ICON-EU',
  run: '2026112312',
  lat: [38, 55],
  lon: [-12, 16],
  w: 449,
  h: 273,
  scale: 0.1,
  hours: ['2026-11-23T13:00Z', '2026-11-23T14:00Z', 'bad'],
  files: ['2026112312_001.png', '2026112312_002.png', 'x.png'],
};

describe('parseRainIndex', () => {
  it('keeps a well formed index and drops bad hours', () => {
    const index = parseRainIndex(raw);
    expect(index?.hours).toEqual([
      Date.parse('2026-11-23T13:00Z'),
      Date.parse('2026-11-23T14:00Z'),
    ]);
    expect(index?.files).toEqual(['2026112312_001.png', '2026112312_002.png']);
  });

  it('refuses a broken one', () => {
    expect(parseRainIndex(null)).toBeNull();
    expect(parseRainIndex({ ...raw, lat: [55, 38] })).toBeNull();
    expect(parseRainIndex({ ...raw, scale: 0 })).toBeNull();
    expect(parseRainIndex({ ...raw, files: ['../evil.png'] })).toBeNull();
  });
});

describe('rainFileAt', () => {
  const index = parseRainIndex(raw) as RainIndex;
  it('takes the hour that ends at the time shown', () => {
    expect(rainFileAt(index, Date.parse('2026-11-23T14:00Z'))).toBe(
      '2026112312_002.png',
    );
  });
  it('has nothing beyond the run', () => {
    expect(rainFileAt(index, Date.parse('2026-11-23T18:00Z'))).toBeNull();
  });
});

describe('rainPixels', () => {
  const small = parseRainIndex({
    ...raw,
    lat: [40, 50],
    lon: [0, 10],
    w: 11,
    h: 11,
    hours: ['2026-11-23T13:00Z'],
    files: ['a.png'],
  }) as RainIndex;

  it('lays rows as the map does (Mercator): taller than wide here', () => {
    const { width, height } = rainImageSize(small);
    expect(width).toBe(40);
    expect(height).toBeGreaterThan(50);
  });

  it('leaves dry land clear and shades the rain, smoothed', () => {
    const grey = new Uint8Array(11 * 11);
    // 5 mm/h at the point 45° N, 5° E.
    grey[5 * 11 + 5] = 50;
    const { width, height, data } = rainPixels(small, grey);
    const alpha = (x: number, y: number) => data[(y * width + x) * 4 + 3];
    expect(alpha(0, 0)).toBe(0);
    // The row of 45° N on a Mercator image.
    const merc = (lat: number) =>
      Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const y45 = Math.round(
      ((merc(50) - merc(45)) / (merc(50) - merc(40))) * height,
    );
    expect(alpha(width / 2, y45)).toBe(255);
    // Red-orange at the heart (4 to 8 mm/h), yellow then blue around it.
    const colour = (x: number, y: number) =>
      [0, 1, 2].map((k) => data[(y * width + x) * 4 + k]).join(',');
    const near: string[] = [];
    for (let y = y45 - 2; y <= y45 + 2; y++) {
      for (let x = width / 2 - 2; x <= width / 2 + 1; x++) {
        near.push(colour(x, y));
      }
    }
    expect(near).toContain('255,68,0');
    expect(colour(width / 2 + 3, y45)).not.toBe('255,68,0');
    expect(alpha(width / 2 + 3, y45)).toBe(255);
  });
});
