import { expect, test } from 'vitest';

import type { LightningSpots } from '../lightning.ts';
import {
  chosenStorm,
  durationText,
  imageDrift,
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

test('the drift of the storms: the newest image laid on the oldest', () => {
  const size = 100;
  const box: [number, number, number, number] = [6, 46, 7.3, 47];
  const blob = (row0: number, col0: number) => {
    const mask = new Uint8Array(size * size);
    for (let row = row0; row < row0 + 6; row++) {
      for (let col = col0; col < col0 + 6; col++) mask[row * size + col] = 1;
    }
    return mask;
  };
  const spotOf = (mask: Uint8Array, t: number): LightningSpots => ({
    nearestKm: 20,
    bearing: 90,
    cells: 36,
    strong: false,
    mask,
    size,
    box,
    t,
  });
  // Two pixels east and one north every 5 minutes, for 35 minutes.
  const drift = imageDrift(
    [0, 1, 2, 3, 4, 5, 6, 7].map((back) =>
      spotOf(blob(40 + back, 40 - 2 * back), (35 - 5 * back) * MIN),
    ),
  );
  const kmEast = (1.3 * 111.32 * Math.cos((46.5 * Math.PI) / 180)) / size;
  const kmNorth = 111.32 / size;
  expect((drift?.east ?? 0) * 5 * MIN).toBeCloseTo(2 * kmEast, 3);
  expect((drift?.north ?? 0) * 5 * MIN).toBeCloseTo(kmNorth, 3);
  expect(imageDrift([spotOf(blob(50, 50), 0)])).toBeNull();
});

test('several storms: the one first on the boat is said, and no alert for one going away or already here', () => {
  // A square of 120 km around the place, 1.2 km a pixel.
  const size = 100;
  const place = { lat: 46.5, lon: 6.5 };
  const half = 60;
  const dLat = half / 111.32;
  const dLon = half / (111.32 * Math.cos((46.5 * Math.PI) / 180));
  const box: [number, number, number, number] = [
    6.5 - dLon,
    46.5 - dLat,
    6.5 + dLon,
    46.5 + dLat,
  ];
  // Both go east with the wind aloft, three pixels a step: the near cell to
  // the north passes by, the farther one to the west comes on the boat.
  const frame = (back: number): LightningSpots => {
    const mask = new Uint8Array(size * size);
    const square = (row0: number, col0: number) => {
      for (let row = row0; row < row0 + 4; row++) {
        for (let col = col0; col < col0 + 4; col++) {
          mask[row * size + col] = 1;
        }
      }
    };
    square(34, 48 - 3 * back);
    square(48, 12 - 3 * back);
    return {
      nearestKm: 15,
      bearing: 0,
      cells: 32,
      strong: false,
      mask,
      size,
      box,
      t: (35 - 5 * back) * MIN,
    };
  };
  const images = [0, 1, 2, 3, 4, 5, 6, 7].map((back) => frame(back));
  const chosen = chosenStorm(images, { ...place, km: 100 });
  expect(chosen?.storms).toBe(2);
  expect(chosen?.cell.bearing).toBeGreaterThan(260);
  expect(chosen?.motion?.closingKn).toBeGreaterThan(15);
  const report = lightningReport(images, 35 * MIN, 36 * MIN, {
    ...place,
    km: 100,
  });
  expect(report.storms).toBe(2);
  expect(report.bearing).toBeGreaterThan(260);
  expect(lightningDue(report, null, 36 * MIN, 100)).toBe('first');
  // Going away: no alert.
  const away = {
    ...report,
    motion: { towardDeg: 90, speedKn: 30, closingKn: -30, kmAt: 40 },
  };
  expect(lightningDue(away, null, 36 * MIN, 100)).toBeNull();
  // On the boat already: no alert.
  const here = {
    ...report,
    nearestKm: 2,
    motion: { towardDeg: 90, speedKn: 30, closingKn: 30, kmAt: 2 },
  };
  expect(lightningDue(here, null, 36 * MIN, 100)).toBeNull();
  // Out of the circle: no alert.
  expect(lightningDue(report, null, 36 * MIN, 10)).toBeNull();
});

test('an image the server gives twice (a time it does not have) is read once, at its older time', () => {
  const mask = new Uint8Array(4).fill(1);
  const other = new Uint8Array(4);
  other[0] = 1;
  const spotAt = (m: Uint8Array, t: number): LightningSpots => ({
    nearestKm: 10,
    bearing: 0,
    cells: m.reduce((sum, value) => sum + value, 0),
    strong: false,
    mask: m,
    size: 2,
    box: [0, 0, 1, 1],
    t,
  });
  const report = lightningReport(
    [
      spotAt(other, 20 * MIN),
      spotAt(mask, 15 * MIN),
      spotAt(mask, 10 * MIN),
      spotAt(other, 5 * MIN),
    ],
    20 * MIN,
    30 * MIN,
  );
  expect(report.at).toBe(20 * MIN);
  const twiceNewest = lightningReport(
    [spotAt(mask, 20 * MIN), spotAt(mask, 15 * MIN), spotAt(other, 10 * MIN)],
    20 * MIN,
    30 * MIN,
  );
  expect(twiceNewest.at).toBe(15 * MIN);
});
