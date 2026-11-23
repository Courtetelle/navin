import { effect } from '@preact/signals-react';
import type { Map as LeafletMap } from 'leaflet';

import { fmtTime, fr } from '../../lib/format.ts';
import { herePos } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { escapeHtml } from './escapeHtml.ts';
import { gotoTarget, setGoto } from './goto.ts';
import { leaflet } from './leaflet.ts';
import { isMapLive } from './mapExtras.ts';
import { marksMaps } from './marksDraw.ts';
import type { RoutingMark, ShownRouting } from './routingState.ts';
import {
  ROUTING_KEY,
  legTarget,
  routingLeg,
  shownRouting,
} from './routingState.ts';

/**
 * Show a routing on the map (kept on the device until erased).
 * @param shown - The routing.
 */
export function showRouting(shown: ShownRouting): void {
  shownRouting.value = shown;
  store.set(ROUTING_KEY, shown);
}

/** Erase the routing from the map, and its Go to. */
export function clearRouting(): void {
  if (gotoTarget.peek()?.leg !== undefined) setGoto(null);
  shownRouting.value = null;
  store.set(ROUTING_KEY, null);
}

/** Go to the routing: the turn of the leg the boat is on, then the next. */
export function gotoRouting(): void {
  const shown = shownRouting.peek();
  if (!shown || shown.turns.length < 2) return;
  const me = herePos();
  setGoto(legTarget(shown, me ? routingLeg(shown.turns, me) : 1));
}

function arrow(deg: number): string {
  return `<i class="rtm-arrow" style="transform:rotate(${Math.round(deg)}deg)">↑</i>`;
}

/** The wind, the current and the waves of a place, as a small card. */
function markHtml(mark: RoutingMark): string {
  const wind = `<span class="rtm-wind" title="Vent">${arrow(mark.twd + 180)}${fr(mark.tws, 0)} nd</span>`;
  const current =
    mark.driftKn > 0
      ? `<span class="rtm-current" title="Courant">${arrow(mark.setDeg)}${fr(mark.driftKn, 1)} nd</span>`
      : '';
  const waves =
    mark.waveM === null
      ? ''
      : `<span class="rtm-waves" title="Vagues">〰 ${fr(mark.waveM, 1)} m</span>`;
  return `<b>${escapeHtml(fmtTime(new Date(mark.ms)))}</b>${wind}${current}${waves}`;
}

const layers = new WeakMap<LeafletMap, { remove: () => void }>();

function routingPopup(shown: ShownRouting): HTMLElement {
  const box = document.createElement('div');
  box.className = 'lp-menu';
  box.innerHTML = `<b>⛵ ${escapeHtml(shown.name)}</b><div class="lp-btns"><button class="btn primary">🎯 Go to le long du routage</button><button class="btn">✕ Effacer le routage</button></div>`;
  const [gotoButton, eraseButton] = box.querySelectorAll('button');
  gotoButton?.addEventListener('click', gotoRouting);
  eraseButton?.addEventListener('click', clearRouting);
  return box;
}

/**
 * Draw the routing on a map: its way in yellow, its turns, and the wind,
 * current and waves along it.
 * @param map - Leaflet map.
 * @param shown - The routing.
 */
export function drawRouting(
  map: LeafletMap,
  shown: ShownRouting | null = shownRouting.peek(),
): void {
  watchRouting();
  layers.get(map)?.remove();
  layers.delete(map);
  if (!shown || !isMapLive(map)) return;
  const L = leaflet();
  const line = L.polyline(shown.track, {
    color: '#f5b800',
    weight: 5,
    opacity: 0.9,
  }).bindPopup(() => routingPopup(shown));
  const turns = shown.turns.map((turn) =>
    L.circleMarker([turn.lat, turn.lon], {
      radius: 5,
      color: '#b37f00',
      weight: 2,
      fillColor: '#f5b800',
      fillOpacity: 1,
    }).bindPopup(() => routingPopup(shown)),
  );
  const marks = shown.marks.map((mark) =>
    L.marker([mark.lat, mark.lon], {
      interactive: false,
      icon: L.divIcon({
        className: 'rtm',
        html: markHtml(mark),
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
    }),
  );
  const group = L.layerGroup([line, ...turns, ...marks]).addTo(map);
  layers.set(map, group);
}

/**
 * Show the whole routing on a map.
 * @param map - Leaflet map.
 */
export function fitRouting(map: LeafletMap): void {
  const shown = shownRouting.peek();
  if (!shown || shown.track.length === 0) return;
  map.fitBounds(shown.track, { padding: [60, 60], maxZoom: 15 });
}

let watching = false;

/** Redraw the maps when the routing changes (from the first map drawn on). */
function watchRouting(): void {
  if (watching) return;
  watching = true;
  effect(() => {
    const shown = shownRouting.value;
    for (const map of marksMaps) drawRouting(map, shown);
  });
}
