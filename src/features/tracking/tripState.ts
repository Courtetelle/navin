import type { Trip } from '../../state/index.ts';
import { state } from '../../state/index.ts';

import type { Detector, TrackEvent } from './detector.ts';
import { trackerTick } from './trackerLink.ts';

/** A recording: {@link Trip} with the detector and the key points of this domain. */
export interface LiveTrip extends Trip {
  det: Detector;
  dep: TrackEvent | null;
  cands: TrackEvent[];
}

/**
 * The recording in progress, typed for this domain.
 * @returns The trip, or `null`.
 */
export function liveTrip(): LiveTrip | null {
  return state.view.trip.peek() as LiveTrip | null;
}

/**
 * Hand a new reference to the subscribers: the detector changes in place and
 * `state.view.trip` is what the auto card and the tracker follow.
 */
export function publishTrip(): void {
  const trip = state.view.trip.peek();
  if (trip) state.view.trip.value = { ...trip };
  trackerTick();
}
