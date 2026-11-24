import { onLake } from '../../features/onwater/onLake.ts';
import type { MeteoZone } from '../../features/zones/meteoZones.ts';
import { zonesAt } from '../../features/zones/meteoZones.ts';
import { buzz } from '../../lib/dom.ts';
import { boatPlace } from '../meteo/boatPlace.ts';

import { liveZoneIds, setLiveZones } from './liveOnMap.ts';

/**
 * The ids a change starts from: those chosen, else those of the place.
 * @param zones - All the zones.
 * @returns The ids.
 */
export function startIds(zones: readonly MeteoZone[]): string[] {
  const chosen = liveZoneIds();
  if (chosen.length > 0) return chosen;
  const place = boatPlace();
  return zonesAt(zones, place.lat, place.lon, onLake());
}

/**
 * The ids shown as chosen: those chosen, else those of the place.
 * @param zones - All the zones (empty while read).
 * @returns The ids.
 */
export function shownIds(zones: readonly MeteoZone[]): Set<string> {
  const chosen = liveZoneIds();
  return new Set(
    chosen.length > 0 ? chosen : zones.length > 0 ? startIds(zones) : [],
  );
}

/**
 * Add a zone, or take it away.
 * @param zones - All the zones.
 * @param id - The zone touched.
 */
export function toggleZone(zones: readonly MeteoZone[], id: string): void {
  buzz();
  const ids = startIds(zones);
  setLiveZones(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
}
