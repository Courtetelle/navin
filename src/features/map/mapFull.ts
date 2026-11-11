import type { Map as LeafletMap } from 'leaflet';

import { hasBodyClass, setBodyClass } from '../../shell/bodyClass.ts';

import { isMapLive } from './mapExtras.ts';

/** The map on screen, so the browser leaving full screen can restore it. */
const shown: { map: LeafletMap | null } = { map: null };

/**
 * Remember the map on screen.
 * @param map - Leaflet map, or `null` when it leaves the screen.
 */
export function setShownMap(map: LeafletMap | null): void {
  shown.map = map;
}

/**
 * The map on screen, if any.
 * @returns The Leaflet map, or `null`.
 */
export function shownMap(): LeafletMap | null {
  return shown.map;
}

/**
 * Switch a map to full screen and back (legacy `setMapFull`); on tablets the
 * browser goes full screen too.
 * @param map - Leaflet map.
 * @param on - Full screen.
 */
export function setMapFull(map: LeafletMap, on: boolean): void {
  const container = map.getContainer();
  setBodyClass('map-full', on);
  container.classList.toggle('map-full-box', on);
  const button = container.querySelector<HTMLElement>('.map-full-toggle');
  if (button) {
    button.textContent = on ? '✕' : '⛶';
    button.title = on ? 'Revenir au mode normal' : 'Plein écran';
  }
  try {
    const root = document.documentElement;
    if (on && !document.fullscreenElement) {
      root.requestFullscreen?.().catch(ignore);
    }
    if (!on && document.fullscreenElement) {
      document.exitFullscreen?.().catch(ignore);
    }
  } catch {
    // Full screen refused: the map still fills the page.
  }
  const fit = () => {
    if (isMapLive(map)) map.invalidateSize();
  };
  setTimeout(fit, 60);
  setTimeout(fit, 400);
}

/** Back to the normal mode when leaving the screen (legacy `exitMapFull`). */
export function exitMapFull(): void {
  setBodyClass('map-full', false);
  for (const box of document.querySelectorAll('.map-full-box')) {
    box.classList.remove('map-full-box');
  }
  try {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(ignore);
  } catch {
    // Already out of full screen.
  }
}

/** The browser left full screen by itself (Escape, system gesture). */
export function onFullscreenChange(): void {
  if (document.fullscreenElement || !hasBodyClass('map-full')) return;
  if (shown.map) setMapFull(shown.map, false);
  else exitMapFull();
}

function ignore(): void {
  // Full screen is a bonus: a refusal changes nothing.
}
