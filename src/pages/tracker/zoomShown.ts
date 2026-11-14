import { signal } from '@preact/signals-react';

/** ＋ and − are shown this long after a touch on the arrow, or on them. */
const ZOOM_MS = 3000;
/** A record shown from its list: the map opens first. */
const MAP_OPENS_MS = 600;

/** ＋ and − are shown (for a moment after the arrow). */
export const zoomShown = signal(false);
let zoomTimer: ReturnType<typeof setTimeout> | undefined;

/** Show ＋ and − for 3 s. */
export function showZoom(): void {
  zoomShown.value = true;
  clearTimeout(zoomTimer);
  zoomTimer = setTimeout(() => {
    zoomShown.value = false;
  }, ZOOM_MS);
}

/** A mark or a trace shown on the map: ＋ and − for 3 s once it is there. */
export function showZoomOnMap(): void {
  setTimeout(showZoom, MAP_OPENS_MS);
}
