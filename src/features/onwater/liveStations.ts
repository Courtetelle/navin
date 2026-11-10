import { distKm } from '../../lib/geo.ts';

import { mfReadings, owmReadings } from './coastStations.ts';
import { smnNow, smnStations } from './externals.ts';
import { rememberReadings } from './stationHistory.ts';
import type { StationRow } from './windModels.ts';
import { stationReading } from './windModels.ts';
import type { WindReading } from './windTypes.ts';

/** The MeteoSwiss network. */
export const METEO_SWISS = 'MeteoSwiss';

/** Stations read per network on the live screen. */
const LIVE_MOST = 25;

/** A station of the live screen: a reading with its place. */
export type LiveStation = WindReading & {
  id: string;
  lat: number;
  lon: number;
  net: string;
};

/**
 * Every wind station measuring now around a place: MeteoSwiss, OpenWindMap,
 * Météo-France (with a key), the closest first.
 * @param center - Place searched around.
 * @param radius - Radius in km.
 * @param mfKey - Météo-France key, empty without one.
 * @returns The stations with a recent measurement.
 */
export async function liveStations(
  center: { lat: number; lon: number },
  radius: number,
  mfKey: string,
): Promise<LiveStation[]> {
  const [swiss, beacons, french] = await Promise.all([
    smnLive(center, radius).catch(() => []),
    owmReadings(center, radius, LIVE_MOST).catch(() => []),
    mfReadings(center, radius, mfKey, LIVE_MOST).catch(() => []),
  ]);
  const live = [...swiss, ...beacons, ...french]
    .filter(isLive)
    .toSorted((a, b) => (a.km ?? 0) - (b.km ?? 0));
  rememberReadings(live, Date.now());
  return live;
}

/**
 * Key of a station across networks.
 * @param station - The station.
 * @returns `network:id`.
 */
export function stationKey(station: LiveStation): string {
  return `${station.net}:${station.id}`;
}

function isLive(reading: WindReading): reading is LiveStation {
  return (
    reading.id != null &&
    reading.lat != null &&
    reading.lon != null &&
    reading.net != null
  );
}

async function smnLive(
  center: { lat: number; lon: number },
  radius: number,
): Promise<WindReading[]> {
  const stations = await smnStations();
  const near = stations
    .map((station) => ({
      station,
      km: distKm(center.lat, center.lon, station[2], station[3]),
    }))
    .filter(({ station, km }) => km < radius && (station[4] || 0) < 800)
    .toSorted((a, b) => a.km - b.km)
    .slice(0, LIVE_MOST);
  const readings = await Promise.all(
    near.map(async ({ station: [id, name, lat, lon], km }) => {
      try {
        const rows = (await smnNow(id)) as unknown as StationRow[];
        const reading = stationReading(rows, name, km, Date.now());
        if (!reading) return null;
        const last = rows.findLast((row) => row.fu3010z0 != null);
        return {
          ...reading,
          id,
          lat,
          lon,
          net: METEO_SWISS,
          air: numberOf(last?.tre200s0),
          baro: numberOf(last?.pp0qffs0),
        };
      } catch {
        return null;
      }
    }),
  );
  return readings.filter((reading) => reading !== null);
}

function numberOf(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
