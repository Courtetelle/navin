import { fmtTime } from '../../lib/format.ts';
import { state, toast, updateCruise } from '../../state/index.ts';
import type { TrackEvent } from '../tracking/index.ts';

import type { LatLngPair } from './constants.ts';
import { addAutoEntry } from './external.ts';
import { currentTrack } from './trackStats.ts';
import { simulatedPins, tracker, trkPin } from './trackerState.ts';

/** A logbook point at the last GPS point of the recording. */
export interface LastPoint {
  point: { lat: number; lon: number };
  lochBase: number;
  event: TrackEvent;
}

/**
 * The event of a logbook point at the last GPS point of the recording.
 * @returns The event, or `null` before the first GPS point.
 */
export function lastPointEvent(): LastPoint | null {
  const trip = state.view.trip.value;
  const point = trip?.det.lastPt as { lat: number; lon: number } | undefined;
  if (!trip || !point) return null;
  return {
    point,
    lochBase: trip.lochBase,
    event: {
      kind: null,
      t: Date.now(),
      lat: point.lat,
      lon: point.lon,
      cog: trip.det.lastCog as number | null,
      sog: trip.det.lastSog as number | null,
      dist: trip.det.dist as number,
    },
  };
}

/**
 * Note a point on the track (legacy `trkPointNow`): red pin and logbook entry;
 * without GPS, a simulated pin that writes nothing in the logbook.
 */
export async function trkPointNow(): Promise<void> {
  const last = lastPointEvent();
  if (last) {
    const { lat, lon } = last.point;
    const entry = await addAutoEntry(last.event, last.lochBase);
    if (entry) markAsPoint(entry.id);
    if (state.view.currentView.value === 'tracker') {
      trkPin([lat, lon], false, `📌 Point · ${fmtTime(new Date())}`);
    }
    toast('📌 Point enregistré');
    return;
  }
  const map = tracker.current?.map;
  if (!map || state.view.currentView.value !== 'tracker') {
    toast('En attente du premier point GPS');
    return;
  }
  const track = currentTrack();
  const lastPoint = track.at(-1);
  const fix = state.view.lastFix.value;
  const center = map.getCenter();
  let position: LatLngPair = [center.lat, center.lng];
  if (lastPoint) position = [lastPoint[1], lastPoint[2]];
  else if (fix) position = [fix.lat, fix.lon];
  simulatedPins.push({ ll: position, t: Date.now() });
  const marker = trkPin(
    position,
    true,
    `📌 Point simulé · ${fmtTime(new Date())}`,
  );
  if (marker && !map.getBounds().contains(marker.getLatLng())) {
    map.panTo(position);
  }
  toast(
    '📌 Point simulé sur la trace · pas encore de GPS, rien n’est écrit au journal',
  );
}

function markAsPoint(entryId: string): void {
  updateCruise((cruise) => {
    const entry = cruise.entries.find((item) => item.id === entryId);
    if (entry) entry.pt = true;
  });
}
