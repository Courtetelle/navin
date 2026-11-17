import { expect, test } from 'vitest';

import type { LightningSpots } from '../lightning.ts';
import {
  durationText,
  lightningBox,
  lightningClear,
  lightningClearNoData,
  lightningDue,
  lightningEta,
  lightningMotionLines,
  lightningRadiusNm,
  lightningReport,
  lightningSpots,
  lightningText,
  lightningTimes,
  lightningUrl,
  nmToKm,
  pointAt,
  stormView,
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
  expect(lightningRadiusNm({ radiusNm: 45 })).toBe(45);
  expect(lightningRadiusNm({ radiusNm: 50 })).toBe(30);
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

const RADIUS_KM = nmToKm(30);

test('the alert sounds when the storm enters, comes much nearer, or stays', () => {
  const report = lightningReport([spot(30)], 0, 0);
  expect(lightningDue(report, null, 0, RADIUS_KM)).toBe('first');
  expect(lightningDue(report, { km: 40, at: 0 }, 60_000, RADIUS_KM)).toBe(null);
  expect(lightningDue(report, { km: 60, at: 0 }, 60_000, RADIUS_KM)).toBe(
    'nearer',
  );
  expect(lightningDue(report, { km: 30, at: 0 }, 15 * 60_000, RADIUS_KM)).toBe(
    'again',
  );
  expect(
    lightningDue(lightningReport([spot(null)], 0, 0), null, 0, RADIUS_KM),
  ).toBe(null);
});

test('a second alert under half the distance, once', () => {
  const near = lightningReport([spot(25)], 0, 0);
  expect(lightningDue(near, { km: 35, at: 0 }, 60_000, RADIUS_KM)).toBe('half');
  expect(
    lightningDue(near, { km: 26, at: 0, half: true }, 60_000, RADIUS_KM),
  ).toBe(null);
});

test('the end of the alert after 30 minutes without flashes', () => {
  const calm = lightningReport([spot(null)], 40 * 60_000, 0);
  const last = { km: 20, at: 0 };
  expect(lightningClear(calm, last, 5 * 60_000)).toBe(true);
  expect(lightningClear(calm, last, 20 * 60_000)).toBe(false);
  expect(lightningClear(calm, null, 0)).toBe(false);
  expect(
    lightningClear(lightningReport([spot(10)], 40 * 60_000, 0), last, 0),
  ).toBe(false);
});

const MIN = 60_000;
const HERE = { lat: 46.5, lon: 6.5 };

/** A storm due east, coming west at 20 km in 15 minutes. */
function coming(): LightningSpots[] {
  return [0, 1, 2, 3].map((back) => {
    const km = 30 + back * (20 / 3);
    return {
      nearestKm: km,
      bearing: 90,
      cells: 5,
      strong: false,
      core: pointAt(HERE.lat, HERE.lon, 90, km + 5),
      t: 60 * MIN - back * 5 * MIN,
    };
  });
}

test('the motion of a storm: where it goes, how fast it comes nearer', () => {
  const report = lightningReport(coming(), 60 * MIN, 70 * MIN, HERE);
  const { motion } = report;
  expect(motion).not.toBeNull();
  // 20 km in 15 minutes: 80 km/h, 43 kn.
  expect(motion?.closingKn).toBeCloseTo(43.2, 0);
  expect(motion?.speedKn).toBeCloseTo(43.2, 0);
  expect(motion?.towardDeg).toBeCloseTo(270, -1);
  expect(motion?.kmAt).toBeCloseTo(30, 3);
});

test('when it is on the boat: the delay of the image counted', () => {
  const report = lightningReport(coming(), 60 * MIN, 70 * MIN, HERE);
  // Ten minutes after the image: 13.3 km nearer.
  const eta = lightningEta(report, 70 * MIN);
  expect(eta?.delayMin).toBe(10);
  expect(eta?.kmNow).toBeCloseTo(16.7, 0);
  expect(((eta?.etaAt ?? 0) - 70 * MIN) / MIN).toBeCloseTo(10, 0);
  expect(eta?.onUs).toBe(false);
  const lines = lightningMotionLines(report, 70 * MIN);
  expect(lines[0]).toBe('Déplacement : 270° (vers le O) à 43 nd.');
  expect(lines[1]).toBe('Vitesse de rapprochement : 43 nd.');
  expect(lines[2]).toBe(
    'Estimé maintenant à 9 NM (retard de l’image de 10 min compté).',
  );
  expect(lines[3]).toContain('⚠️ Sur vous vers');
  const later = lightningEta(report, 85 * MIN);
  expect(later?.onUs).toBe(true);
});

test('a storm going away has no time of arrival', () => {
  const away = coming()
    .map((one, index, all) => ({ ...one, t: all[3 - index]?.t }))
    .toReversed();
  const report = lightningReport(
    away.toSorted((a, b) => (b.t ?? 0) - (a.t ?? 0)),
    60 * MIN,
    70 * MIN,
    HERE,
  );
  expect(report.motion?.closingKn).toBeLessThan(-40);
  expect(lightningEta(report, 70 * MIN)?.etaAt).toBeNull();
  expect(durationText(85 * MIN)).toBe('1 h 25');
  expect(durationText(25 * MIN)).toBe('25 min');
});

test('the newest image twice (not out yet) is read once', () => {
  const twice = coming();
  const first = twice[1];
  if (!first) throw new Error('no image');
  twice[0] = { ...first, t: 60 * MIN };
  const report = lightningReport(twice, 60 * MIN, 70 * MIN, HERE);
  expect(report.at).toBe(55 * MIN);
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

test('a point at a distance and a bearing, and the view of a storm', () => {
  const east = pointAt(46.5, 6.5, 90, 100);
  expect(east.lat).toBeCloseTo(46.49, 1);
  expect(east.lon).toBeCloseTo(7.81, 1);
  const north = pointAt(46.5, 6.5, 0, 111.2);
  expect(north.lat).toBeCloseTo(47.5, 1);
  const view = stormView({ lat: 46.5, lon: 6.5 }, { lat: 47.5, lon: 6.5 });
  expect(view.lat).toBeCloseTo(47, 3);
  expect(Math.round(view.km)).toBe(71);
});

test('a storm passing by does not come nearer: the approach along the arrow', () => {
  // Due east at 30 km, going north at 20 km in 15 minutes.
  const passing: LightningSpots[] = [0, 1, 2, 3].map((back) => {
    const core = pointAt(HERE.lat, HERE.lon, 90, 30);
    const north = pointAt(core.lat, core.lon, 0, -back * (20 / 3));
    return {
      nearestKm: 30,
      bearing: 90,
      cells: 5 + back,
      strong: false,
      core: north,
      t: 60 * MIN - back * 5 * MIN,
    };
  });
  const report = lightningReport(passing, 60 * MIN, 70 * MIN, HERE);
  expect(report.motion?.towardDeg).toBeCloseTo(0, -1);
  expect(Math.abs(report.motion?.closingKn ?? 99)).toBeLessThan(2);
  expect(lightningEta(report, 70 * MIN)?.etaAt).toBeNull();
});
