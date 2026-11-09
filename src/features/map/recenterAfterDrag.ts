import type { Map as LeafletMap } from 'leaflet';

import { state } from '../../state/index.ts';

import { isMapLive } from './mapExtras.ts';
import type { TrackerHandle } from './trackerState.ts';
import { setFollow } from './trackerState.ts';

/** How long the map stays where the finger left it while a track is recorded. */
export const RECENTER_DELAY_MS = 7000;
/** How long it stays there without a track being recorded. */
export const RECENTER_IDLE_DELAY_MS = 20_000;

/**
 * How long the map stays where the finger left it: 7 s while a track is
 * recorded, 20 s otherwise.
 * @returns Milliseconds.
 */
export function recenterDelay(): number {
  return state.view.tracking.peek()
    ? RECENTER_DELAY_MS
    : RECENTER_IDLE_DELAY_MS;
}

/**
 * Moving the map by hand stops following the boat, for a moment: the map comes
 * back to the boat once left alone (7 s while recording a track, else 20 s). A place or a track asked for stays on
 * screen, even when moved, until the blue arrow is touched.
 * @param map - Map of the tracker.
 * @param handle - Tracker handle of the screen.
 */
export function recenterAfterDrag(
  map: LeafletMap,
  handle: TrackerHandle,
): void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let popupOpen = false;
  const recenter = () => {
    if (!handle.drifted || !isMapLive(map)) return;
    setFollow(true);
    const boat = handle.me?.getLatLng();
    if (boat) map.setView(boat, map.getZoom());
  };
  const wait = () => {
    clearTimeout(timer);
    if (handle.drifted && !popupOpen) {
      timer = setTimeout(recenter, recenterDelay());
    }
  };
  map.on('dragstart', () => {
    clearTimeout(timer);
    const drifted = handle.follow || handle.drifted;
    setFollow(false);
    handle.drifted = drifted;
  });
  map.on('dragend zoomend', wait);
  map.on('zoomstart', () => clearTimeout(timer));
  map.on('popupopen', () => {
    popupOpen = true;
    clearTimeout(timer);
  });
  map.on('popupclose', () => {
    popupOpen = false;
    wait();
  });
}
