import { signal } from '@preact/signals-react';

/** ＋ and − stay fully shown this long after a touch… */
const SOLID_MS = 2000;
/** …then fade out over this long before they go. */
export const FADE_MS = 3000;
/** A record shown from its list: the map opens first. */
const MAP_OPENS_MS = 600;

/** ＋ and − are shown (for a moment after the arrow). */
export const zoomShown = signal(false);
/** ＋ and − are fading out. */
export const zoomFading = signal(false);
let fadeTimer: ReturnType<typeof setTimeout> | undefined;
let zoomTimer: ReturnType<typeof setTimeout> | undefined;

/** Show ＋ and −: 2 s fully, then 3 s fading out; a touch starts again. */
export function showZoom(): void {
  zoomShown.value = true;
  zoomFading.value = false;
  clearTimeout(fadeTimer);
  clearTimeout(zoomTimer);
  fadeTimer = setTimeout(() => {
    zoomFading.value = true;
  }, SOLID_MS);
  zoomTimer = setTimeout(() => {
    zoomShown.value = false;
    zoomFading.value = false;
  }, SOLID_MS + FADE_MS);
}

/** A mark or a trace shown on the map: ＋ and − for 3 s once it is there. */
export function showZoomOnMap(): void {
  setTimeout(showZoom, MAP_OPENS_MS);
}
