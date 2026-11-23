import { expect, test } from 'vitest';

import type { MeteoZone } from '../meteoZones.ts';
import {
  ZONE_SETS,
  inZone,
  parseZones,
  readCircles,
  shownZones,
  stationInZones,
  zoneDistanceKm,
  zonesAt,
  zonesBox,
  zonesButtonText,
  zonesText,
} from '../meteoZones.ts';

function square(
  id: string,
  kind: MeteoZone['kind'],
  west: number,
  south: number,
  east: number,
  north: number,
  basin: MeteoZone['basin'] = 'manche',
): MeteoZone {
  return {
    id,
    name: id,
    basin,
    kind,
    polys: [
      [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    ],
    reads: [[(south + north) / 2, (west + east) / 2, 45]],
  };
}

// A coast band from 48.6 to 49 °N, an offshore zone over it up to 50 °N.
const coast = square('hague-penmarch', 'cote', -4, 48.6, -2, 49);
const large = square('casquets', 'large', -3.6, 48.3, -1.94, 50);
const lake = square('leman', 'lac', 6.1, 46.2, 6.9, 46.5, 'lac');
const ZONES = [coast, large, lake];

test('a point is in a zone, and not outside it', () => {
  expect(inZone(coast, 48.8, -3)).toBe(true);
  expect(inZone(coast, 49.2, -3)).toBe(false);
});

test('a zone with a hole leaves the hole out', () => {
  const holed: MeteoZone = {
    ...coast,
    polys: [
      [
        ...(coast.polys[0] ?? []),
        [
          [-3.2, 48.7],
          [-2.8, 48.7],
          [-2.8, 48.9],
          [-3.2, 48.9],
          [-3.2, 48.7],
        ],
      ],
    ],
  };
  expect(inZone(holed, 48.8, -3)).toBe(false);
  expect(inZone(holed, 48.65, -3)).toBe(true);
});

test('the distance to a zone is 0 inside and in km outside', () => {
  expect(zoneDistanceKm(coast, 48.8, -3)).toBe(0);
  // 0.01° of latitude south of the band: about 1.1 km.
  expect(zoneDistanceKm(coast, 48.59, -3)).toBeCloseTo(1.11, 1);
});

test('Saint-Quay-Portrieux gets its coast zone, the open sea its offshore zone', () => {
  expect(zonesAt(ZONES, 48.65, -2.83)).toEqual(['hague-penmarch']);
  expect(zonesAt(ZONES, 49.5, -2.5)).toEqual(['casquets']);
  expect(zonesAt(ZONES, 30, 0)).toEqual([]);
});

test('on a lake the zone is the lake', () => {
  expect(zonesAt(ZONES, 46.45, 6.34, true)).toEqual(['leman']);
});

test('the zones chosen win over the place, none chosen gives the place', () => {
  const place = { lat: 48.65, lon: -2.83 };
  expect(shownZones(ZONES, [], place).map((z) => z.id)).toEqual([
    'hague-penmarch',
  ]);
  expect(
    shownZones(ZONES, ['casquets', 'leman'], place).map((z) => z.id),
  ).toEqual(['casquets', 'leman']);
});

test('a station 500 m inland of a zone belongs to it, one 3 km inland not', () => {
  expect(stationInZones([coast], 48.595, -3)).toBe(true);
  expect(stationInZones([coast], 48.573, -3)).toBe(false);
});

test('near circles are read once, the nearest first, at most 16', () => {
  const many: MeteoZone = {
    ...coast,
    reads: Array.from({ length: 40 }, (_, k) => [48.7, -4 + k * 0.5, 45]),
  };
  const twin: MeteoZone = { ...large, reads: [[48.7, -4.05, 45]] };
  const circles = readCircles([many, twin], { lat: 48.7, lon: -4 });
  expect(circles).toHaveLength(16);
  expect(circles[0]).toEqual({ lat: 48.7, lon: -4, km: 45 });
  expect(circles.filter((c) => Math.abs(c.lon + 4) < 0.1)).toHaveLength(1);
});

test('the box holds the zones', () => {
  expect(zonesBox([coast, large])).toEqual({
    south: 48.3,
    west: -4,
    north: 50,
    east: -1.94,
  });
  expect(zonesBox([])).toBeNull();
});

test('the button says the zone in short, or how many', () => {
  expect(zonesButtonText([large])).toBe('Cas');
  expect(zonesButtonText([coast, large])).toBe('2');
  expect(zonesButtonText([])).toBe('–');
  expect(zonesText([coast, large, lake])).toBe(
    'hague-penmarch, casquets et 1 autre',
  );
});

test('the groups pick their zones', () => {
  const manche = ZONE_SETS.find((set) => set.id === 'manche');
  expect(manche?.ids(ZONES)).toEqual(['hague-penmarch', 'casquets']);
  const coasts = ZONE_SETS.find((set) => set.id === 'cotes');
  expect(coasts?.ids(ZONES)).toEqual(['hague-penmarch']);
});

test('a file that is not one gives no zone', () => {
  expect(parseZones(null)).toEqual([]);
  expect(parseZones({ zones: [{ id: 1 }] })).toEqual([]);
  expect(parseZones({ v: 1, zones: [coast] })).toEqual([coast]);
});
