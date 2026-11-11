import { beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { initState, navinSpot, setNavinSpot, setZoneSim } from '../actions.ts';

beforeEach(() => {
  initState(createMemoryStorage());
});

test('NavIn keeps the place the fingers left the map at', () => {
  expect(navinSpot()).toBeNull();
  setNavinSpot({ lat: 46.5, lon: 6.6 });
  expect(navinSpot()).toStrictEqual({ lat: 46.5, lon: 6.6 });
  setZoneSim('auto');
  expect(navinSpot()).toStrictEqual({ lat: 46.5, lon: 6.6 });
});

test('another zone chosen with NavIn goes back to the place of the settings', () => {
  setNavinSpot({ lat: 46.5, lon: 6.6 });
  setZoneSim('mer');
  expect(navinSpot()).toBeNull();
});
