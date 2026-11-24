import { effect } from '@preact/signals-react';
import type { Map as LeafletMap } from 'leaflet';

import { fmtShortDate, fmtTime, fr } from '../../lib/format.ts';
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
 * The wind, the waves and the current where and when the boat passes, with
 * the symbols and the colours of LiveMétéo (wind barb by Beaufort, waves in
 * the colour of their steepness with their Douglas degree, current in
 * black), and below a short tag: the hour and the angle of the boat to the
 * apparent wind.
 * @param mark - The place.
 * @param turn - Bearing of the map, degrees.
 * @returns The HTML.
 */
export function markHtml(mark: RoutingMark, turn = 0): string {
  const color = windColor(mark.tws);
  const symbols = [
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
    symbols.push(symbol(arrow, waveLabelHtml(mark.waveM)));
  }
  if (mark.driftKn > 0) {
    symbols.push(
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
  const tag = [`<b>${escapeHtml(fmtTime(new Date(mark.ms)))}</b>`];
  const speed = mark.sog ?? mark.kn;
  if (speed !== undefined) {
    tag.push(
      `<span class="rtm-kn" title="Vitesse estimée du bateau (fond)">⛵ ${fr(speed, 1)} nd</span>`,
    );
  }
  if (mark.awa !== undefined && mark.aws !== undefined) {
    const side = mark.side === 'tribord' ? 'Td' : 'Bd';
    tag.push(
      `<span class="rtm-aw" title="Angle du bateau au vent apparent">∡ ${mark.awa}° ${side} · app. ${fr(mark.aws, 0)} nd</span>`,
    );
  }
  if (mark.mode === 'motor') tag.push('moteur');
  return `<div class="rtm-syms">${symbols.join('')}</div><div class="rtm-tag">${tag.join(' · ')}</div>`;
}

/** Size of the symbols of a place on the screen, pixels. */
const BOX_W = 236;
const BOX_H = 100;
/** Room between the route and the symbols, pixels. */
const ROUTE_GAP = 12;

/** A place of the routing on the screen. */
export interface ScreenMark {
  x: number;
  y: number;
}

/** Where the symbols of a place go: its rank and their offset from it. */
export interface PlacedMark {
  rank: number;
  dx: number;
  dy: number;
}

/**
 * Where to put the symbols along the route on the screen: as many places as
 * fit without the symbols touching, on one side of the route then the
 * other, set off from the line so that it stays seen.
 * @param points - The places, in order along the route, pixels.
 * @returns The places kept and their offsets.
 */
export function placeMarks(points: readonly ScreenMark[]): PlacedMark[] {
  const placed: PlacedMark[] = [];
  let last: ScreenMark | null = null;
  let side = 1;
  for (const [rank, point] of points.entries()) {
    const before = points[rank - 1] ?? point;
    const after = points[rank + 1] ?? point;
    let ux = after.x - before.x;
    let uy = after.y - before.y;
    const length = Math.hypot(ux, uy) || 1;
    ux /= length;
    uy /= length;
    // Along the route, the symbols take this room (half: one side then the
    // other).
    const along = (Math.abs(ux) * BOX_W + Math.abs(uy) * BOX_H) / 2 + 8;
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < along) {
      continue;
    }
    // Across the route, far enough for the box to clear the line.
    const nx = -uy * side;
    const ny = ux * side;
    const away = (Math.abs(nx) * BOX_W + Math.abs(ny) * BOX_H) / 2 + ROUTE_GAP;
    placed.push({
      rank,
      dx: Math.round(nx * away),
      dy: Math.round(ny * away),
    });
    last = point;
    side = -side;
  }
  return placed;
}

/**
 * Where a line from the point of the route meets the circle of its symbols,
 * from that point.
 * @param dx - Offset of the middle of the symbols, pixels.
 * @param dy - Offset of the middle of the symbols, pixels.
 * @returns The point, pixels from the point of the route.
 */
export function boxEdge(dx: number, dy: number): { x: number; y: number } {
  const across = Math.min(
    dx === 0 ? Infinity : BOX_W / 2 / Math.abs(dx),
    dy === 0 ? Infinity : BOX_H / 2 / Math.abs(dy),
  );
  const share = Math.max(0, 1 - Math.min(1, across));
  return { x: Math.round(dx * share), y: Math.round(dy * share) };
}

function day(ms: number): string {
  const date = new Date(ms);
  return `${fmtShortDate(date)} ${fmtTime(date)}`;
}

/**
 * The ETD on the point of departure and the ETA on the point of arrival.
 * @param shown - The routing.
 * @returns Where and what.
 */
function endTags(
  shown: ShownRouting,
): Array<{ at: [number, number]; html: string; blink: boolean }> {
  const first = shown.track[0];
  const last = shown.track.at(-1);
  const tags: Array<{ at: [number, number]; html: string; blink: boolean }> =
    [];
  if (first && shown.departMs !== undefined) {
    tags.push({
      at: first,
      html: `<b>ETD</b> ${escapeHtml(day(shown.departMs))}`,
      blink:
        seenTimes.departMs !== null && seenTimes.departMs !== shown.departMs,
    });
  }
  if (last && shown.arriveMs !== undefined) {
    tags.push({
      at: last,
      html: `<b>ETA</b> ${escapeHtml(day(shown.arriveMs))}`,
      blink:
        seenTimes.arriveMs !== null && seenTimes.arriveMs !== shown.arriveMs,
    });
  }
  return tags;
}

/** The ETD and ETA drawn last: a change makes their tags blink. */
const seenTimes: {
  name: string;
  departMs: number | null;
  arriveMs: number | null;
} = {
  name: '',
  departMs: null,
  arriveMs: null,
};

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
    // Turned or zoomed: the symbols are set again (as many as fit).
    map.on('rotate zoomend', () => drawRouting(map));
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
  const screen = shown.marks.map((mark) =>
    map.latLngToContainerPoint([mark.lat, mark.lon]),
  );
  const marks = placeMarks(screen).flatMap(({ rank, dx, dy }) => {
    const mark = shown.marks[rank] as RoutingMark;
    const point = screen[rank] as { x: number; y: number };
    // A line from the point of the route to the edge of its circle.
    const edge = boxEdge(dx, dy);
    const end = map.containerPointToLatLng([
      point.x + edge.x,
      point.y + edge.y,
    ]);
    return [
      L.polyline(
        [
          [mark.lat, mark.lon],
          [end.lat, end.lng],
        ],
        {
          className: 'rtm-lead',
          color: '#1a1a1a',
          weight: 1.5,
          opacity: 0.7,
          interactive: false,
        },
      ),
      L.circleMarker([mark.lat, mark.lon], {
        radius: 4,
        color: '#1a1a1a',
        weight: 1.5,
        fillColor: '#fff',
        fillOpacity: 1,
        interactive: false,
      }),
      L.marker([mark.lat, mark.lon], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'rtm',
          html: markHtml(mark, turn),
          iconSize: [BOX_W, BOX_H],
          iconAnchor: [BOX_W / 2 - dx, BOX_H / 2 - dy],
        }),
      }),
    ];
  });
  // Another routing: nothing to blink.
  if (seenTimes.name !== shown.name) {
    seenTimes.name = shown.name;
    seenTimes.departMs = null;
    seenTimes.arriveMs = null;
  }
  const tags = endTags(shown);
  seenTimes.departMs = shown.departMs ?? null;
  seenTimes.arriveMs = shown.arriveMs ?? null;
  const ends = tags.map(({ at, html, blink }) =>
    L.marker(at, {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: blink ? 'rtm-end rtm-blink' : 'rtm-end',
        html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      }),
    }),
  );
  const group = L.layerGroup([line, ...turns, ...marks, ...ends]).addTo(map);
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
