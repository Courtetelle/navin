import { toast } from '../../state/index.ts';

import { addAutoEntry } from './autoEntries.ts';
import type { TrackEvent, TrackSample } from './detector.ts';
import { selectLeg } from './entrySelection.ts';
import type { LiveTrip } from './tripState.ts';

/**
 * Write the entries of a finished navigation: the candidates kept, then the
 * arrival (part of legacy `stopTracking`).
 * @param trip - The recording.
 * @param departure - Its departure.
 * @param lastPoint - Last position received.
 * @returns Resolves once every entry is written.
 */
export async function addArrival(
  trip: LiveTrip,
  departure: TrackEvent,
  lastPoint: TrackSample,
): Promise<void> {
  const arrival: TrackEvent = {
    kind: 'Arrivée',
    t: Date.now(),
    lat: lastPoint.lat,
    lon: lastPoint.lon,
    cog: null,
    sog: 0,
    dist: trip.det.dist,
    twd: trip.det.lastTwd,
    tws: trip.det.lastTws,
  };
  const leg = selectLeg(departure, trip.cands ?? [], arrival).slice(1);
  /* eslint-disable no-await-in-loop -- entries are written in time order, each with its weather */
  for (const event of leg) await addAutoEntry(event, trip.lochBase);
  /* eslint-enable no-await-in-loop */
  toast(`Arrivée : ${arrival.note}`);
}
