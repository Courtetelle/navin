import type { Map as LeafletMap } from 'leaflet';

import { buzz } from '../../lib/dom.ts';

import { extrasOf, whileMapLive } from './mapExtras.ts';

const HIDE_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
/** Moments, in ms after the map is created, when the controls added since are arranged. */
const ARRANGE_DELAYS = [0, 300, 1200];

/**
 * Put every map button in one column on the left, the layer selector included
 * (legacy `ctlArrange`).
 * @param map - Leaflet map.
 */
export function ctlArrange(map: LeafletMap): void {
  const container = map.getContainer();
  const left = container.querySelector('.leaflet-top.leaflet-left');
  if (!left) return;
  left.classList.add('ctl-col');
  const layers = container.querySelector(
    '.leaflet-top.leaflet-right .leaflet-control-layers',
  );
  if (layers) left.append(layers);
}

/**
 * Hide the map buttons: a swipe from the left edge shows them until the ‹
 * button puts them away (legacy `ctlAutoAttach`).
 * @param map - Leaflet map.
 */
export function ctlAutoAttach(map: LeafletMap): void {
  const container = map.getContainer();
  const { signal } = extrasOf(map).controller;
  for (const delay of ARRANGE_DELAYS) {
    whileMapLive(map, () => ctlArrange(map), delay);
  }
  container.classList.add('ctl-auto');
  const edge = document.createElement('div');
  edge.className = 'ctl-edge';
  container.append(edge);
  for (const name of [
    'mousedown',
    'touchstart',
    'dblclick',
    'click',
    'wheel',
  ]) {
    edge.addEventListener(name, stopEvent);
  }
  let start: { x: number; y: number } | null = null;
  edge.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    start = { x: event.clientX, y: event.clientY };
    try {
      edge.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone.
    }
  });
  edge.addEventListener('pointermove', (event) => {
    if (!start) return;
    event.stopPropagation();
    const moved = event.clientX - start.x;
    if (moved > 40 && Math.abs(event.clientY - start.y) < 90) {
      start = null;
      show(map);
    }
  });
  const release = () => {
    start = null;
  };
  edge.addEventListener('pointerup', release);
  edge.addEventListener('pointercancel', release);
  for (const delay of ARRANGE_DELAYS) {
    whileMapLive(map, () => addHideButton(map, signal), delay);
  }
}

function stopEvent(event: Event): void {
  event.stopPropagation();
}

function show(map: LeafletMap): void {
  const container = map.getContainer();
  ctlArrange(map);
  addHideButton(map, extrasOf(map).controller.signal);
  if (!container.classList.contains('ctl-show')) buzz();
  container.classList.add('ctl-show');
}

function hide(container: HTMLElement): void {
  container.classList.remove('ctl-show');
  container
    .querySelector('.leaflet-control-layers-expanded')
    ?.classList.remove('leaflet-control-layers-expanded');
}

function addHideButton(map: LeafletMap, signal: AbortSignal): void {
  const container = map.getContainer();
  const left = container.querySelector('.leaflet-top.leaflet-left');
  if (!left || left.querySelector('.ctl-hide-btn')) return;
  const button = document.createElement('a');
  button.href = '#';
  button.setAttribute('role', 'button');
  button.className = 'leaflet-control map-full-btn ctl-hide-btn';
  button.title = 'Ranger les boutons';
  button.setAttribute('aria-label', 'Ranger les boutons');
  button.innerHTML = HIDE_ICON;
  for (const name of [
    'mousedown',
    'touchstart',
    'dblclick',
    'pointerdown',
    'wheel',
  ]) {
    button.addEventListener(name, stopEvent, { signal });
  }
  button.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      hide(container);
    },
    { signal },
  );
  left.append(button);
}
