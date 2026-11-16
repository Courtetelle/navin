import { expect, test } from 'vitest';

import type { LightningSpots } from '../lightning.ts';
import {
  lightningBox,
  lightningClearNoData,
  lightningDue,
  lightningRadiusNm,
  lightningReport,
  lightningSpots,
  lightningText,
  lightningTimes,
  lightningUrl,
} from '../lightning.ts';

const AREA = { lat: 48.65, lon: -2, km: 55.56 };

function image(size: number, lit: Array<[number, number, number]>) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  for (const [row, col, green] of lit) {
    const at = (row * size + col) * 4;
    pixels[at] = 255;
    pixels[at + 1] = green;
    pixels[at + 2] = 100;
    pixels[at + 3] = 255;
  }
  return pixels;
}

test('the radius of the alert is one of those offered, 30 NM by default', () => {
  expect(lightningRadiusNm(undefined)).toBe(30);
  expect(lightningRadiusNm({ radiusNm: 60 })).toBe(60);
  expect(lightningRadiusNm({ radiusNm: 45 })).toBe(30);
});

test('the images of the last quarter of an hour, on the 5-minute steps', () => {
  const now = Date.UTC(2026, 10, 15, 18, 37, 12);
  expect(lightningTimes(now).map((t) => new Date(t).toISOString())).toEqual([
    '2026-11-15T18:30:00.000Z',
    '2026-11-15T18:25:00.000Z',
    '2026-11-15T18:20:00.000Z',
    '2026-11-15T18:15:00.000Z',
  ]);
  const url = lightningUrl(AREA, 100, Date.UTC(2026, 10, 15, 18, 30));
  expect(url).toContain('layers=mtg_fd%3Ali_afa');
  expect(url).toContain('time=2026-11-15T18%3A30%3A00Z');
});

test('the square of the image holds the circle', () => {
  const [west, south, east, north] = lightningBox(AREA);
  expect(north - south).toBeCloseTo(1, 1);
  expect(east - west).toBeGreaterThan(north - south);
});

test('the nearest flashes inside the circle, their bearing, their strength', () => {
  const size = 100;
  // A pale cell due east halfway out, a red one far in the corner (outside).
  const spots = lightningSpots(
    image(size, [
      [50, 75, 240],
      [0, 0, 20],
    ]),
    size,
    AREA,
  );
  expect(spots.cells).toBe(1);
  expect(spots.strong).toBe(false);
  expect(spots.nearestKm).toBeGreaterThan(25);
  expect(spots.nearestKm).toBeLessThan(31);
  expect(spots.bearing).toBeGreaterThan(80);
  expect(spots.bearing).toBeLessThan(100);
  const none = lightningSpots(image(size, []), size, AREA);
  expect(none.nearestKm).toBeNull();
  const strong = lightningSpots(image(size, [[50, 52, 60]]), size, AREA);
  expect(strong.strong).toBe(true);
});

const spot = (km: number | null): LightningSpots => ({
  nearestKm: km,
  bearing: km == null ? null : 225,
  cells: km == null ? 0 : 3,
  strong: false,
});

test('a storm coming nearer is said so', () => {
  const report = lightningReport(
    [spot(20), spot(25), spot(null), spot(40)],
    Date.UTC(2026, 10, 15, 18, 30),
    0,
  );
  expect(report.nearestKm).toBe(20);
  expect(report.nearer).toBe(true);
  expect(lightningText(report, 30)).toBe(
    '⚡ Éclairs à 11 NM, direction SO, se rapproche (image satellite de 18:30 UTC).',
  );
  const away = lightningReport([spot(40), spot(30), spot(25), spot(20)], 0, 0);
  expect(away.nearer).toBe(false);
  expect(away.nearestKm).toBe(25);
  const calm = lightningReport([spot(null), spot(null)], 0, 0);
  expect(lightningText(calm, 30)).toBe(
    'Aucun éclair à moins de 30 NM (image satellite de 00:00 UTC).',
  );
});

test('the alert sounds when the storm enters, comes much nearer, or stays', () => {
  const report = lightningReport([spot(30)], 0, 0);
  expect(lightningDue(report, null, 0)).toBe(true);
  expect(lightningDue(report, { km: 40, at: 0 }, 60_000)).toBe(false);
  expect(lightningDue(report, { km: 60, at: 0 }, 60_000)).toBe(true);
  expect(lightningDue(report, { km: 30, at: 0 }, 15 * 60_000)).toBe(true);
  expect(lightningDue(lightningReport([spot(null)], 0, 0), null, 0)).toBe(
    false,
  );
});

test('the black of no data is cleared, the flashes kept', () => {
  const pixels = new Uint8ClampedArray([
    0, 0, 0, 255, 254, 249, 189, 255, 160, 20, 20, 255, 0, 0, 0, 0,
  ]);
  expect(lightningClearNoData(pixels)).toBe(1);
  expect([...pixels]).toEqual([
    0, 0, 0, 0, 254, 249, 189, 255, 160, 20, 20, 255, 0, 0, 0, 0,
  ]);
});

test('no black of no data counted as a flash', () => {
  const black = new Uint8ClampedArray(4 * 4).fill(0);
  for (let at = 3; at < black.length; at += 4) black[at] = 255;
  expect(lightningSpots(black, 2, { lat: 70, lon: 20, km: 500 }).cells).toBe(0);
});
