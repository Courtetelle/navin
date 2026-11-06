import { expect, test } from 'vitest';

import { offlineMapCovers } from '../offlineMapLayer.ts';
import { chunksFor, offlineMapName } from '../offlineMapStore.ts';
import { placeShows, roadWidth } from '../offlineMapStyle.ts';

test('a map file is named after the file', () => {
  expect(offlineMapName('leman.pmtiles')).toBe('Leman');
  expect(offlineMapName('mer-adriatique_nord.PMTILES')).toBe(
    'Mer adriatique nord',
  );
  expect(offlineMapName('.pmtiles')).toBe('Carte');
});

test('a map file covers what is inside its limits only', () => {
  const leman = { south: 46, west: 6, north: 47, east: 7 };
  expect(offlineMapCovers(leman, 46.5, 6.5)).toBe(true);
  expect(offlineMapCovers(leman, 45.9, 6.5)).toBe(false);
  expect(offlineMapCovers(leman, 46.5, 7.1)).toBe(false);
});

test('a range of a map file is found in its pieces', () => {
  expect(chunksFor(0, 10, 100)).toStrictEqual([0]);
  expect(chunksFor(95, 10, 100)).toStrictEqual([0, 1]);
  expect(chunksFor(100, 100, 100)).toStrictEqual([1]);
  expect(chunksFor(250, 300, 100)).toStrictEqual([2, 3, 4, 5]);
  expect(chunksFor(50, 0, 100)).toStrictEqual([]);
});

test('only roads get a road width, wider when zoomed in', () => {
  expect(roadWidth('rail', 14)).toBe(0);
  expect(roadWidth('motorway', 14)).toBeGreaterThan(roadWidth('motorway', 10));
  expect(roadWidth('motorway', 14)).toBeGreaterThan(roadWidth('minor', 14));
});

test('small places wait for a closer zoom', () => {
  expect(placeShows('city', 6)).toBe(true);
  expect(placeShows('village', 10)).toBe(false);
  expect(placeShows('village', 11)).toBe(true);
  expect(placeShows('hamlet', 12)).toBe(false);
});
