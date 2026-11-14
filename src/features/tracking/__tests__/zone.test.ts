import { expect, test } from 'vitest';

import { BASIN_CYC, ZONE_CYC, basinOf, nextBasin, nextZone } from '../zone.ts';

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

test('the zone button shows the sea chosen, or the lakes', () => {
  expect(basinOf('lac', 'med')).toBe('lac');
  expect(basinOf('mer', 'med')).toBe('med');
  expect(basinOf('mer', 'atl')).toBe('atl');
  expect(basinOf('auto', 'atl', 'lac')).toBe('lac');
  expect(basinOf('auto', 'med', 'mer')).toBe('med');
});
