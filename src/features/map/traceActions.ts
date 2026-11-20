import { buzz } from '../../lib/dom.ts';
import { lightBand } from '../../shell/lightBand.ts';
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
  const smooth = smoothLine(line);
  const others = leaflet()
    .polyline(smooth, {
      color: '#7b2cbf',
      weight: 4,
      opacity: 0.85,
      bubblingMouseEvents: false,
    })
    .addTo(map);
  // A wider line, unseen, to be pressed with a finger; gone with the trace.
  const hit = leaflet()
    .polyline(smooth, {
      color: '#7b2cbf',
      weight: 22,
      opacity: 0,
      bubblingMouseEvents: false,
    })
    .addTo(map);
  others.on('remove', () => hit.remove());
  for (const path of [others.getElement(), hit.getElement()]) {
    if (path) pressBackToList(path, track.id);
  }
  handle.others = others;
  setFollow(false);
  map.fitBounds(others.getBounds(), { padding: [30, 30], maxZoom: 15 });
  globalThis.scrollTo(0, 0);
  toast(`Trace « ${track.name} » en violet`);
}

/** A press this long on a trace opens its band in the list of the traces. */
const LONG_MS = 600;
/** Moved this far, the finger drags the map. */
const MOVE_PX = 10;

/**
 * A long press on the trace drawn on the map opens the list of the traces,
 * its band blinking three times (as a mark in its list).
 * @param path - The drawn line.
 * @param id - The id of the trace.
 */
function pressBackToList(path: Element, id: string): void {
  let pressing: ReturnType<typeof setTimeout> | undefined;
  let from = { x: 0, y: 0 };
  path.addEventListener('pointerdown', (event) => {
    const { clientX, clientY } = event as PointerEvent;
    from = { x: clientX, y: clientY };
    clearTimeout(pressing);
    pressing = setTimeout(() => {
      buzz();
      go('traces');
      lightBand(id, true);
    }, LONG_MS);
  });
  const release = () => clearTimeout(pressing);
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) {
    path.addEventListener(name, release);
  }
  // The map dragged from the trace: no long press.
  path.addEventListener('pointermove', (event) => {
    const { clientX, clientY } = event as PointerEvent;
    if (Math.hypot(clientX - from.x, clientY - from.y) > MOVE_PX) release();
  });
}
