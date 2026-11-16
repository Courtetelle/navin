import type { LiveStation } from '../../features/onwater/index.ts';
import { distKm } from '../../lib/geo.ts';

/** A station this close to the place of an alert is the one that gave it. */
const SAME_STATION_KM = 0.3;

/**
 * The station that gave a wind alert, among those shown.
 * @param stations - Stations shown.
 * @param lat - Latitude of the station of the alert.
 * @param lon - Its longitude.
 * @returns The closest one within 300 m, or `undefined`.
 */
export function alertStation(
  stations: readonly LiveStation[],
  lat: number,
  lon: number,
): LiveStation | undefined {
  let best: LiveStation | undefined;
  let bestKm = SAME_STATION_KM;
  for (const station of stations) {
    const km = distKm(lat, lon, station.lat, station.lon);
    if (km <= bestKm) {
      best = station;
      bestKm = km;
    }
  }
  return best;
}
