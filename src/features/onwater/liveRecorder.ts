import { lastKnownPos } from '../../state/index.ts';

import { liveStations } from './liveStations.ts';
import { windConfig } from './windWatch.ts';

/** Radius of the stations recorded around the boat, in km. */
export const RECORD_RADIUS = 60;

/**
 * Météo-France allows 50 requests a minute, read one after the other: the
 * closest 40 stations stay well within it every 10 minutes.
 */
const MF_MOST = 40;

/** A reading under way: the next one waits for it to end. */
let current: Promise<unknown> | null = null;

/**
 * Read every station within 60 km of the GPS position and keep all their
 * measurements (wind, gusts, direction, air, pressure; liveStations keeps
 * them), so that Live météo and the alerts have the past of the stations
 * where the boat is. It goes on while NavIn is in the background, as long as
 * the device lets it run. Nothing without a GPS position or network.
 */
export async function recordAround(): Promise<void> {
  const position = lastKnownPos();
  if (current || !position || !navigator.onLine) return;
  const reading = liveStations(
    { lat: position.lat, lon: position.lon },
    RECORD_RADIUS,
    windConfig().mfKey,
    null,
    { open: Infinity, mf: MF_MOST },
  ).finally(() => {
    current = null;
  });
  current = reading;
  await reading;
}
