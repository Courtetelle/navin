import { expect, test } from 'vitest';

import {
  BASIN_CYC,
  BASIN_ONLY,
  inBasin,
  seaAt,
} from '../../../model/basins.ts';
import { ZONE_CYC, nextBasin, nextZone } from '../zone.ts';

test('NavIn goes between lake and sea; the GPS is left for the lake', () => {
  expect(ZONE_CYC).toStrictEqual(['lac', 'mer']);
  expect(nextZone('lac')).toBe('mer');
  expect(nextZone('mer')).toBe('lac');
  expect(nextZone('auto')).toBe('lac');
});

test('on the GPS, a long press goes to the other zone than the boat', () => {
  expect(nextZone('auto', 'lac')).toBe('mer');
  expect(nextZone('auto', 'mer')).toBe('lac');
});

test('the zone button turns Atlantique, Méditerranée, Lacs', () => {
  expect(BASIN_CYC).toStrictEqual(['atl', 'med', 'lac']);
  expect(nextBasin('atl')).toBe('med');
  expect(nextBasin('med')).toBe('lac');
  expect(nextBasin('lac')).toBe('atl');
});

test('the sea of a place: the Mediterranean, else the Atlantic', () => {
  expect(seaAt(43.27, 5.32)).toBe('med'); // Marseille
  expect(seaAt(39.57, 2.65)).toBe('med'); // Palma
  expect(seaAt(37.97, 23.72)).toBe('med'); // Athènes
  expect(seaAt(48.65, -2.03)).toBe('atl'); // Saint-Malo
  expect(seaAt(46.16, -1.15)).toBe('atl'); // La Rochelle
  expect(seaAt(43.48, -1.56)).toBe('atl'); // Biarritz
  expect(seaAt(36.53, -6.29)).toBe('atl'); // Cadix
  expect(seaAt(38.7, -9.14)).toBe('atl'); // Lisbonne
});

test('tides are shown in the Atlantic only', () => {
  const tides = { basins: BASIN_ONLY.tides };
  expect(inBasin(tides, 'atl')).toBe(true);
  expect(inBasin(tides, 'med')).toBe(false);
  expect(inBasin(tides, 'lac')).toBe(false);
  expect(inBasin({}, 'med')).toBe(true);
});
