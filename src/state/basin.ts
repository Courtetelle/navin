import type { SeaBasin } from '../model/basins.ts';
import { seaAt } from '../model/basins.ts';
import type { Cruise } from '../model/types.ts';

import { data } from './data.ts';
import { preferences } from './preferences.ts';
import { view } from './view.ts';

/**
 * The sea chosen with NavIn (`settings.seaBasin`).
 * @returns `atl` (the default) or `med`.
 */
export function chosenSea(): SeaBasin {
  return preferences.settings.value.seaBasin === 'med' ? 'med' : 'atl';
}

/**
 * The sea one sails on: the one chosen with NavIn, else the sea of the
 * first position of the cruise, else of the last GPS fix.
 * @param cruise - The cruise read, the open one by default.
 * @returns `atl` or `med`.
 */
export function sailedSea(cruise: Cruise | null = data.cruise.value): SeaBasin {
  if (view.zoneSimV.value === 'mer') return chosenSea();
  const first = cruise?.entries.find((entry) => entry.v.pos)?.v.pos;
  const place = first ?? view.lastFix.value;
  return place ? seaAt(place.lat, place.lon) : chosenSea();
}
