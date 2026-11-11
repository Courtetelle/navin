import { beforeEach, expect, test } from 'vitest';

import { initState, setNavinSpot, setZoneSim } from '../../../state/actions.ts';
import { state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { contextPlace } from '../contextPlace.ts';
import { seaPlace } from '../seaCenter.ts';

beforeEach(() => {
  initState(createMemoryStorage());
  state.view.lastFix.value = null;
});

test('a zone chosen with NavIn rules over the GPS: the place of the settings', () => {
  setZoneSim('mer');
  const { lat, lon } = seaPlace();
  expect(contextPlace()).toStrictEqual({ lat, lon, forced: true });
});

test('where the fingers left the NavIn map is the place of the menus and alerts', () => {
  setZoneSim('mer');
  setNavinSpot({ lat: 43, lon: 6.2 });
  expect(contextPlace()).toStrictEqual({ lat: 43, lon: 6.2, forced: true });
});

test('on the GPS, the place NavIn looked at no longer counts', () => {
  setZoneSim('mer');
  setNavinSpot({ lat: 43, lon: 6.2 });
  setZoneSim('auto');
  expect(contextPlace().forced).toBe(false);
});
