import { expect, test } from 'vitest';

import * as map from '../index.ts';

test('the barrel loads without a browser, Leaflet stays out of it', () => {
  expect(map.LEMAN_BBOX).toStrictEqual({ s: 46.18, n: 46.56, w: 6.1, e: 6.95 });
  expect(() => map.leaflet()).toThrow('leaflet');
});

test('inSwissArea tells the Swiss map area', () => {
  expect(map.inSwissArea({ lat: 46.5, lon: 6.5 })).toBe(true);
  expect(map.inSwissArea({ lat: 43, lon: 6 })).toBe(false);
  expect(map.inSwissArea(null)).toBe(false);
});

test('lakesNote waits for the network without stored state', () => {
  expect(map.lakesNote()).toBe(
    'Léman : au prochain réseau · lac de Neuchâtel : au prochain réseau',
  );
});
