import { store } from '../storage/store.ts';

import { data } from './data.ts';
import type { TrackPoint } from './view.ts';
import { view } from './view.ts';

/**
 * Storage key of the track of a cruise (legacy `trackKey`).
 * @param id - Cruise id (the open one by default).
 * @returns `ldb.track.<id>`.
 */
export function trackKey(
  id: string | undefined = data.cruise.value?.id,
): string {
  return `ldb.track.${id}`;
}

/**
 * Recorded track of the open cruise (legacy `loadTrack`).
 * @returns `[epoch ms, lat, lon]` points, empty without open cruise.
 */
export function loadTrack(): TrackPoint[] {
  return data.cruise.value ? store.get<TrackPoint[]>(trackKey(), []) : [];
}

/**
 * Persist the track of the open cruise (legacy `saveTrack`).
 * @param track - Points.
 * @returns `true` when written.
 */
export function saveTrack(track: readonly TrackPoint[]): boolean {
  return store.set(trackKey(), track);
}

/**
 * Storage key of the recording in progress (legacy `tripKey`).
 * @param id - Cruise id (the open one by default).
 * @returns `ldb.trip.<id>`.
 */
export function tripKey(
  id: string | undefined = data.cruise.value?.id,
): string {
  return `ldb.trip.${id}`;
}

/**
 * Storage key of the last finished recording, which can be extended (legacy `lastTripKey`).
 * @param id - Cruise id (the open one by default).
 * @returns `ldb.lastTrip.<id>`.
 */
export function lastTripKey(
  id: string | undefined = data.cruise.value?.id,
): string {
  return `ldb.lastTrip.${id}`;
}

/**
 * Persist the recording in progress (legacy `saveTrip`).
 * @returns `true` when written.
 */
export function saveTrip(): boolean {
  return store.set(tripKey(), view.trip.value);
}

/**
 * Storage key of the segment starts of a track (`ldb.trkSegs.<id>`).
 * @param id - Cruise id (the open one by default).
 * @returns The key.
 */
export function trackSegmentsKey(
  id: string | undefined = data.cruise.value?.id,
): string {
  return `ldb.trkSegs.${id}`;
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * GPX file of a track (legacy `trackToGpx`).
 * @param track - `[epoch ms, lat, lon]` points.
 * @param name - Track name (the open cruise name, else `NavIn`).
 * @returns The GPX text.
 */
export function trackToGpx(
  track: readonly TrackPoint[],
  name?: string,
): string {
  const points: string[] = [];
  for (const [time, lat, lon] of track) {
    points.push(
      `<trkpt lat="${lat}" lon="${lon}"><time>${new Date(time).toISOString()}</time></trkpt>`,
    );
  }
  const title = (name || data.cruise.value?.info.name || 'NavIn').replaceAll(
    /[&<>"']/g,
    (character) => XML_ENTITIES[character] ?? character,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NavIn" xmlns="http://www.topografix.com/GPX/1/1">
<trk><name>${title}</name><trkseg>
${points.join('\n')}
</trkseg></trk></gpx>`;
}
