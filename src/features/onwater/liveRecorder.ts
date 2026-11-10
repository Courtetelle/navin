import { lastKnownPos } from '../../state/index.ts';

import { liveStations } from './liveStations.ts';
import { windConfig } from './windWatch.ts';

/** Radius of the stations recorded around the boat, in km. */
const RECORD_RADIUS = 30;

/**
 * Read the stations around the GPS position and keep their measurements
 * (liveStations keeps them), so that Live météo has the past of the stations
 * where the boat is. Nothing without a GPS position, network, or when the app
 * is in the background.
 */
export async function recordAround(): Promise<void> {
  const position = lastKnownPos();
  if (!position || document.hidden || !navigator.onLine) return;
  await liveStations(
    { lat: position.lat, lon: position.lon },
    RECORD_RADIUS,
    windConfig().mfKey,
  );
}
