import type { Map as LeafletMap } from 'leaflet';

import { setNavinSpot, state } from '../../state/index.ts';

import { isMapLive } from './mapExtras.ts';
import type { TrackerHandle } from './trackerState.ts';
import { setFollow } from './trackerState.ts';

/** How long the map stays where the finger left it while a track is recorded. */
export const RECENTER_DELAY_MS = 7000;

/**
 * Moving the map by hand stops following the boat. While a track is recorded
 * the map comes back to the boat once left alone for 7 s; without a track it
 * stays where it was left until the blue arrow is touched. A place or a track
 * asked for stays on screen, even when moved, until the blue arrow is touched.
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
    if (!handle.drifted || !isMapLive(map) || !state.view.tracking.peek()) {
      return;
    }
    setFollow(true);
    const boat = handle.me?.getLatLng();
    if (boat) map.setView(boat, map.getZoom());
  };
  const wait = () => {
    clearTimeout(timer);
    if (handle.drifted && !popupOpen && state.view.tracking.peek()) {
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
  // Moved with the fingers: NavIn will come back exactly here.
  map.on('dragend', () => {
    const { lat, lng } = map.getCenter();
    setNavinSpot({ lat, lon: lng });
  });
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
