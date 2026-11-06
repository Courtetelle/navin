import { go } from '../../shell/router.ts';
import { deliver, state, toast, trackToGpx } from '../../state/index.ts';

import type { LatLngPair } from './constants.ts';
import { leaflet } from './leaflet.ts';
import { smoothLine } from './smoothLine.ts';
import type { LakeTrack } from './trackStats.ts';
import { allLakeTracks } from './trackStats.ts';
import { setFollow, tracker } from './trackerState.ts';

let pendingTrace: string | null = null;

/**
 * Export a track as a GPX file.
 * @param track - The track.
 */
export function exportTrace(track: LakeTrack): void {
  const slug = track.name
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .replaceAll(/[^a-z0-9]+/gi, '-')
    .replaceAll(/^-|-$/g, '')
    .toLowerCase();
  void deliver(
    trackToGpx(track.track, track.name),
    `${slug}-trace.gpx`,
    'application/gpx+xml',
  );
}

/**
 * Show a track in purple on the tracker, opening it if needed (legacy `trkShowTrack`).
 * @param track - The track.
 */
export function showTrace(track: LakeTrack): void {
  if (state.view.currentView.value !== 'tracker' || !tracker.current?.map) {
    pendingTrace = track.id;
    go('tracker');
    return;
  }
  drawTrace(track);
}

/**
 * The track waiting for the tracker to open.
 * @returns The track, once.
 */
export function takePendingTrace(): LakeTrack | undefined {
  const id = pendingTrace;
  pendingTrace = null;
  return id ? allLakeTracks().find((track) => track.id === id) : undefined;
}

/**
 * Draw a track on the open tracker.
 * @param track - The track.
 */
export function drawTrace(track: LakeTrack): void {
  const handle = tracker.current;
  const map = handle?.map;
  if (!handle || !map) return;
  handle.others?.remove();
  const line: LatLngPair[] = [];
  for (const [, lat, lon] of track.track) line.push([lat, lon]);
  const others = leaflet()
    .polyline(smoothLine(line), { color: '#7b2cbf', weight: 4, opacity: 0.85 })
    .addTo(map);
  handle.others = others;
  setFollow(false);
  map.fitBounds(others.getBounds(), { padding: [30, 30], maxZoom: 15 });
  globalThis.scrollTo(0, 0);
  toast(`Trace « ${track.name} » en violet`);
}
