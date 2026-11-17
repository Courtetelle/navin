import { afterEach, expect, test } from 'vitest';

import { setNavinSpot, state } from '../../../state/index.ts';
import { alertPlace } from '../lightningWatch.ts';

const PORTRIEUX = { name: 'Saint-Quay-Portrieux', lat: 48.65, lon: -2.82 };

afterEach(() => {
  state.view.zoneSimV.value = '';
});

test('in a zone, the storm alert starts from the place set in Zones, never from where the map was moved', () => {
  state.preferences.settings.value = {
    ...state.preferences.settings.value,
    seaBasin: 'atl',
    seaPlace: PORTRIEUX,
  };
  state.view.zoneSimV.value = 'mer';
  setNavinSpot({ lat: 50.3, lon: 0.7 });
  expect(alertPlace()).toEqual({ lat: PORTRIEUX.lat, lon: PORTRIEUX.lon });
});
