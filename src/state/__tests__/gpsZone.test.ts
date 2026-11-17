import { afterEach, expect, test } from 'vitest';

import { state } from '../index.ts';
import { basinAt, currentBasin, navZone } from '../position.ts';

afterEach(() => {
  state.view.zoneSimV.value = '';
  state.view.gpsBasin.value = null;
});

test('a place is in one of the three zones of NavIn', () => {
  expect(basinAt({ lat: 46.45, lon: 6.6 })).toBe('lac');
  expect(basinAt({ lat: 43.1, lon: 6.2 })).toBe('med');
  expect(basinAt({ lat: 48.6, lon: -2 })).toBe('atl');
  expect(basinAt({ lat: 43.5, lon: -1.6 })).toBe('atl');
});

test('anywhere in Switzerland, the zone is Lacs', () => {
  const swiss = [
    { lat: 46.2, lon: 6.14 }, // Genève
    { lat: 46.95, lon: 7.45 }, // Berne, far from a lake
    { lat: 47.56, lon: 7.59 }, // Bâle
    { lat: 47.7, lon: 8.64 }, // Schaffhouse
    { lat: 45.84, lon: 9.03 }, // Chiasso
    { lat: 46, lon: 7.75 }, // Zermatt
    { lat: 46.63, lon: 10.45 }, // Val Müstair
    { lat: 47.4, lon: 6.95 }, // Porrentruy
  ];
  for (const place of swiss) expect(basinAt(place)).toBe('lac');
});

test('on the GPS, the zone where the GPS puts the boat is the one active', () => {
  state.view.zoneSimV.value = '';
  state.view.gpsBasin.value = 'lac';
  expect(currentBasin()).toBe('lac');
  expect(navZone()).toBe('lac');
  state.view.gpsBasin.value = 'med';
  expect(currentBasin()).toBe('med');
  expect(navZone()).toBe('mer');
});

test('a zone chosen with NavIn wins over the GPS', () => {
  state.view.gpsBasin.value = 'med';
  state.view.zoneSimV.value = 'lac';
  expect(currentBasin()).toBe('lac');
  expect(navZone()).toBe('lac');
});
