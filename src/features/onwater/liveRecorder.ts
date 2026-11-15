import { distKm } from '../../lib/geo.ts';
import { lastKnownPos, state } from '../../state/index.ts';

import { lakePlace, seaPlace } from './externals.ts';
import { liveStations } from './liveStations.ts';
import { sendToRelay } from './relayRecord.ts';
import type { WindReading } from './windTypes.ts';
import { windConfig } from './windWatch.ts';

/** Radius of the stations recorded around each point, in km (120 km across). */
export const RECORD_RADIUS = 60;

/** Météo-France stations read around each point, at most. */
const MF_MOST = 12;

/** Two points this close are one: their circles are read once. */
const SAME_KM = 20;

/**
 * Météo-France allows 50 requests a minute: the points are read one after
 * the other, a minute apart.
 */
const BETWEEN_MS = 65_000;

/** A GPS position older than this is no longer where the boat is. */
const GPS_FRESH_MS = 6 * 3_600_000;

/** A point recorded around. */
export interface RecordPoint {
  /** What it is: the GPS, the lake, the Mediterranean, the Atlantic. */
  name: string;
  lat: number;
  lon: number;
}

/**
 * The points whose stations are recorded: the GPS position, and the three
 * zones kept in NavIn (Lacs, Méditerranée, Atlantique, as chosen in the
 * settings). A zone moved or the boat moved: the next reading follows.
 * Two points closer than 20 km count once.
 * @param gps - The GPS position, or null.
 * @param zones - The three zones.
 * @returns The points, the GPS first.
 */
export function recordPoints(
  gps: { lat: number; lon: number } | null,
  zones: readonly RecordPoint[],
): RecordPoint[] {
  const points: RecordPoint[] = gps ? [{ name: 'GPS', ...gps }] : [];
  for (const zone of zones) {
    if (
      !points.some(
        (point) => distKm(point.lat, point.lon, zone.lat, zone.lon) < SAME_KM,
      )
    ) {
      points.push(zone);
    }
  }
  return points;
}

function currentPoints(): RecordPoint[] {
  const settings = state.preferences.settings.peek();
  const known = lastKnownPos();
  const gps =
    known && (!known.at || Date.now() - Date.parse(known.at) < GPS_FRESH_MS)
      ? { lat: known.lat, lon: known.lon }
      : null;
  const lake = lakePlace(settings);
  const atl = seaPlace(settings, 'atl');
  const med = seaPlace(settings, 'med');
  return recordPoints(gps, [
    { name: 'Lacs', lat: lake.lat, lon: lake.lon },
    { name: 'Méditerranée', lat: med.lat, lon: med.lon },
    { name: 'Atlantique', lat: atl.lat, lon: atl.lon },
  ]);
}

/** A reading under way: the next one waits for it to end. */
let current: Promise<unknown> | null = null;

/**
 * Read every station within 60 km (120 km across) of the GPS position and
 * of the three zones of NavIn, and keep all their measurements (wind,
 * gusts, direction, air, pressure; liveStations keeps them), so that
 * LiveMétéo and the alerts have the past of the stations where the boat is
 * and where it sails. It goes on while NavIn runs; the device stops it when
 * NavIn is closed. Nothing without network.
 */
export async function recordAround(): Promise<void> {
  if (current || !navigator.onLine) return;
  const run = (async () => {
    const points = currentPoints();
    const read: WindReading[] = [];
    for (const [index, point] of points.entries()) {
      /* eslint-disable no-await-in-loop -- one point after the other, for Météo-France */
      if (index > 0) {
        await new Promise((resolve) => {
          setTimeout(resolve, BETWEEN_MS);
        });
      }
      read.push(
        ...(await liveStations(
          { lat: point.lat, lon: point.lon },
          RECORD_RADIUS,
          windConfig().mfKey,
          null,
          { open: Infinity, mf: MF_MOST },
        ).catch(() => [])),
      );
      /* eslint-enable no-await-in-loop */
    }
    // The relay records the same points NavIn closed, and keeps what was read.
    await sendToRelay(
      points.map(({ lat, lon }) => ({ lat, lon, km: RECORD_RADIUS })),
      read,
    );
  })().finally(() => {
    current = null;
  });
  current = run;
  await run;
}
