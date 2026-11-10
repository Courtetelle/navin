import { signal } from '@preact/signals-react';

import { defaultMapCenter } from '../../features/map/shownMap.ts';
import { windWatchPlace } from '../../features/onwater/index.ts';
import { isLake, lastKnownPos } from '../../state/index.ts';

/** A place searched around. */
export interface BoatPlace {
  lat: number;
  lon: number;
}

/**
 * Where the boat is, or was last seen, else the default place of the zone.
 * @returns The place.
 */
export function boatPlace(): BoatPlace {
  const known = lastKnownPos() ?? windWatchPlace.peek();
  if (known) return { lat: known.lat, lon: known.lon };
  return defaultMapCenter(isLake());
}

/** Where the ◀ of Live météo leads: data, or the Météo screen it came from. */
export const liveBack = signal<{ view: string; label: string }>({
  view: 'more',
  label: '◀ data',
});
