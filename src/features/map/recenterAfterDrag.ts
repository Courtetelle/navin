import type { Map as LeafletMap } from 'leaflet';

import { isMapLive } from './mapExtras.ts';
import type { TrackerHandle } from './trackerState.ts';
import { setFollow } from './trackerState.ts';

/** How long the map stays where the finger left it. */
export const RECENTER_DELAY_MS = 7000;

/**
 * Moving the map by hand stops following the boat, for a moment: the map comes
 * back to the boat once left alone. A place or a track asked for stays on
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
      timer = setTimeout(recenter, RECENTER_DELAY_MS);
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
