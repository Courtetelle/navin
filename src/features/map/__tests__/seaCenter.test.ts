import { beforeEach, expect, test } from 'vitest';

import { initState } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import {
  DEFAULT_SEA_PLACE,
  seaCenter,
  seaPlace,
  setSeaPlace,
} from '../seaCenter.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
});

test('the sea map opens on Saint-Malo by default', () => {
  expect(seaPlace()).toStrictEqual(DEFAULT_SEA_PLACE);
  expect(seaCenter()).toStrictEqual([48.6493, -2.0257]);
});

test('a place chosen in the settings is kept', () => {
  setSeaPlace({ name: 'Brest', lat: 48.39, lon: -4.49 });
  expect(seaPlace().name).toBe('Brest');
  expect(seaCenter()).toStrictEqual([48.39, -4.49]);
  expect(
    store.get<{ seaPlace?: unknown }>('ldb.settings', {}).seaPlace,
  ).toStrictEqual({
    name: 'Brest',
    lat: 48.39,
    lon: -4.49,
  });
});
