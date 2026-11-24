import type { LiveStation } from '../onwater/liveStations.ts';
import { liveStations, stationKey } from '../onwater/liveStations.ts';
import { nearSea500 } from '../onwater/shoreFar.ts';

import type { MeteoZone } from './meteoZones.ts';
import {
  ZONE_MARGIN_KM,
  readCircles,
  stationInZones,
  zoneDistanceKm,
} from './meteoZones.ts';
import type { ArchiveReading } from './stationArchive.ts';

/** The keys the workflow has (its secrets), each empty without it. */
export interface RecordKeys {
  /** Météo-France. */
  mf: string;
  aemet: string;
  metOffice: string;
  frost: string;
  /** Address of the relay of NavIn (METAR, NOAA buoys, Pays-Bas, Croatie). */
  relay: string;
}

/** Stations read per network and per circle, for the archive. */
const OPEN_MOST = 200;
/** Météo-France stations per circle: it allows 50 requests a minute. */
const MF_MOST = 12;
/** Between two circles, with the key of Météo-France. */
const MF_PAUSE_MS = 16_000;

/**
 * The zones a place stands in (or on land within the margin of).
 * @param zones - The zones.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns Their ids.
 */
export function zonesOfPlace(
  zones: readonly MeteoZone[],
  lat: number,
  lon: number,
): string[] {
  return zones
    .filter((zone) => zoneDistanceKm(zone, lat, lon) <= ZONE_MARGIN_KM)
    .map((zone) => zone.id);
}

/**
 * Every badge of the map in some zones, as LiveMétéo draws them: the zones
 * read circle by circle (all of them, not the 16 nearest), each station
 * once, kept when it stands in a zone and at most 500 m inland of the sea
 * or of the Léman.
 * @param zones - The zones active.
 * @param keys - The keys.
 * @param pause - Wait (tests pass their own).
 * @returns The readings.
 */
export async function readZoneStations(
  zones: readonly MeteoZone[],
  keys: RecordKeys,
  pause: (ms: number) => Promise<void> = (ms) =>
    new Promise((done) => {
      setTimeout(done, ms);
    }),
): Promise<ArchiveReading[]> {
  if (zones.length === 0) return [];
  const first = zones[0]?.reads[0];
  const place = first ? { lat: first[0], lon: first[1] } : { lat: 0, lon: 0 };
  const circles = readCircles(zones, place, Number.POSITIVE_INFINITY);
  const taken = new Map<string, LiveStation>();
  for (const [index, circle] of circles.entries()) {
    // One circle after the other: Météo-France allows 50 requests a minute.
    // eslint-disable-next-line no-await-in-loop -- idem
    if (keys.mf && index > 0) await pause(MF_PAUSE_MS);
    // eslint-disable-next-line no-await-in-loop -- idem
    const read = await liveStations(
      circle,
      circle.km,
      keys.mf,
      null,
      { open: OPEN_MOST, mf: MF_MOST },
      {
        aemet: keys.aemet,
        metOffice: keys.metOffice,
        frost: keys.frost,
        relay: keys.relay,
      },
    ).catch(() => []);
    for (const station of read) {
      const key = stationKey(station);
      if (taken.has(key)) continue;
      if (!stationInZones(zones, station.lat, station.lon)) continue;
      taken.set(key, station);
    }
  }
  const kept = await nearSea500([...taken.values()]);
  return kept.map((station) => ({
    id: station.id,
    net: station.net,
    name: station.name,
    lat: station.lat,
    lon: station.lon,
    t: station.t,
    avg: station.avg,
    gust: station.gust,
    dir: station.dir,
    air: station.air ?? null,
    baro: station.baro ?? null,
  }));
}
