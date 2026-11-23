import { effect } from '@preact/signals-react';
import type { Map as LeafletMap } from 'leaflet';

import { fmtTime, fr } from '../../lib/format.ts';
import { herePos } from '../../state/index.ts';
import { store } from '../../storage/store.ts';
import {
  SLACK_KN,
  arrowSvg,
  barbSvg,
  slackSvg,
  waveLabelHtml,
  windColor,
} from '../onwater/mapWeather.ts';
import { steepnessOf } from '../onwater/steepness.ts';

import { escapeHtml } from './escapeHtml.ts';
import { gotoTarget, setGoto } from './goto.ts';
import { leaflet } from './leaflet.ts';
import { isMapLive } from './mapExtras.ts';
import { mapBearing } from './mapOrientation.ts';
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

/** An arrow is full at this wave height, metres (as LiveMétéo). */
const WAVE_FULL_M = 4;
/** An arrow is full at this current, knots (as LiveMétéo). */
const CURRENT_FULL_KN = 3;
const WAVE_COLOR = '#0a4c8c';
const CURRENT_COLOR = '#000';

function symbol(svg: string, label: string): string {
  return `<span class="rtm-sym">${svg}${label}</span>`;
}

/**
 * The wind, the current and the waves of a place, with the symbols and the
 * colours of LiveMétéo (wind barb by Beaufort, waves in the colour of their
 * steepness with their Douglas degree, current in black), and the angle of
 * the boat to the apparent wind.
 * @param mark - The place.
 * @param turn - Bearing of the map, degrees.
 * @returns The HTML.
 */
export function markHtml(mark: RoutingMark, turn = 0): string {
  const color = windColor(mark.tws);
  const parts = [
    `<b class="rtm-time">${escapeHtml(fmtTime(new Date(mark.ms)))}</b>`,
    symbol(
      barbSvg(mark.tws, mark.twd + turn, color),
      `<span class="wx-lbl" style="color:${color}">${Math.round(mark.tws)} nd</span>`,
    ),
  ];
  if (mark.waveM !== null && Number.isFinite(mark.waveM)) {
    const steep = steepnessOf(mark.waveM, mark.wavePeriod ?? null);
    const from = mark.waveFrom;
    const arrow =
      from === null || from === undefined || !Number.isFinite(from)
        ? ''
        : arrowSvg(
            from + 180 + turn,
            mark.waveM / WAVE_FULL_M,
            steep?.steep.color ?? WAVE_COLOR,
            true,
          );
    parts.push(symbol(arrow, waveLabelHtml(mark.waveM)));
  }
  if (mark.driftKn > 0) {
    parts.push(
      mark.driftKn < SLACK_KN
        ? symbol(
            slackSvg(CURRENT_COLOR),
            '<span class="wx-lbl wx-cur wx-slack">étale</span>',
          )
        : symbol(
            arrowSvg(
              mark.setDeg + turn,
              mark.driftKn / CURRENT_FULL_KN,
              CURRENT_COLOR,
              false,
            ),
            `<span class="wx-lbl wx-cur">${fr(mark.driftKn, 1)} nd</span>`,
          ),
    );
  }
  if (mark.awa !== undefined && mark.aws !== undefined) {
    const side = mark.side === 'tribord' ? 'Td' : 'Bd';
    const motor = mark.mode === 'motor' ? ' · moteur' : '';
    parts.push(
      `<span class="rtm-aw" title="Angle du bateau au vent apparent">∡ ${mark.awa}° ${side} · app. ${fr(mark.aws, 0)} nd${motor}</span>`,
    );
  }
  return parts.join('');
}

const layers = new WeakMap<LeafletMap, { remove: () => void }>();
const turning = new WeakSet<LeafletMap>();

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
  // The symbols stay true to north when the map turns.
  if (!turning.has(map)) {
    turning.add(map);
    map.on('rotate', () => drawRouting(map));
  }
  const turn = mapBearing(map);
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
        html: markHtml(mark, turn),
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
