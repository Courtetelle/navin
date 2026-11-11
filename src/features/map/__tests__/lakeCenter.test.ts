import { beforeEach, expect, test } from 'vitest';

import { initState, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import {
  DEFAULT_LAKE_PLACE,
  LAKE_PLACES,
  lakeCenter,
  lakePlace,
  lakeZoom,
  setLakePlace,
} from '../lakeCenter.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
});

test('the lake map opens on Lake Geneva until a lake is chosen', () => {
  expect(lakePlace()).toStrictEqual(DEFAULT_LAKE_PLACE);
  expect(DEFAULT_LAKE_PLACE.name).toBe('Léman');
});

test('a lake of the list keeps its zoom', () => {
  const annecy = LAKE_PLACES.find((lake) => lake.name === 'Lac d’Annecy');
  if (!annecy) throw new Error('no Annecy');
  setLakePlace(annecy);
  expect(lakeCenter()).toStrictEqual([annecy.lat, annecy.lon]);
  expect(lakeZoom()).toBe(annecy.zoom);
  expect(state.preferences.settings.value.lakePlace).toMatchObject({
    name: 'Lac d’Annecy',
  });
});

test('a place found by name gets a close zoom', () => {
  setLakePlace({ name: 'Lac de Joux', lat: 46.64, lon: 6.28 });
  expect(lakePlace()).toStrictEqual({
    name: 'Lac de Joux',
    lat: 46.64,
    lon: 6.28,
    zoom: 12,
  });
});

test('every lake of the list is a place in Europe, named once', () => {
  const names = new Set(LAKE_PLACES.map((lake) => lake.name));
  expect(names.size).toBe(LAKE_PLACES.length);
  for (const lake of LAKE_PLACES) {
    expect(lake.lat).toBeGreaterThan(40);
    expect(lake.lat).toBeLessThan(65);
    expect(lake.zoom).toBeGreaterThanOrEqual(8);
  }
});
