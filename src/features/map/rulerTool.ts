import { signal } from '@preact/signals-react';
import type {
  Control,
  LatLng,
  Map as LeafletMap,
  Marker,
  Polyline,
} from 'leaflet';

import { buzz } from '../../lib/dom.ts';
import { bearing, destination, distNM } from '../../lib/geo.ts';
import { state } from '../../state/index.ts';

import { leaflet } from './leaflet.ts';
import { openRulerEditor } from './rulerEditor.ts';
import { rulerText } from './rulerText.ts';
import { tracker } from './trackerState.ts';

/** How often a point stuck to the boat looks where the boat is. */
const FOLLOW_MS = 1000;

/** A point dropped this close to the boat (screen pixels) sticks to it. */
export const SNAP_PX = 40;

/** The dividers are laid on a map, for the button of the tablet column. */
export const rulerOn = signal(false);

/** Turns about the arrow of the dividers laid, if any. */
let flipLaid: (() => void) | null = null;

/**
 * The arrow of the dividers laid goes to the other point.
 * @returns Whether dividers were laid to turn.
 */
export function flipRuler(): boolean {
  if (!flipLaid) return false;
  buzz();
  flipLaid();
  return true;
}

/** The dividers of each map, laid from the boat to a point. */
const toPoint = new WeakMap<LeafletMap, (to: LatLng) => void>();

/**
 * The dividers laid from the boat (stuck to it) to a point, the arrow on the
 * point: the course and the distance to go there.
 * @param map - The map.
 * @param to - The point.
 */
export function rulerToPoint(map: LeafletMap, to: LatLng): void {
  toPoint.get(map)?.(to);
}

/** The drawing of the dividers. */
export const DIVIDERS_ICON =
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="4" r="2.2" fill="currentColor"/><path d="M12 5.5 6 21M12 5.5 18 21" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M8.2 14.5h7.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

interface End {
  marker: Marker;
  /** Stuck to the boat: follows it until moved by hand. */
  onBoat: boolean;
}

function boatLatLng(): LatLng | null {
  const me = tracker.current?.me?.getLatLng();
  if (me) return me;
  const fix = state.view.lastFix.peek();
  return fix ? leaflet().latLng(fix.lat, fix.lon) : null;
}

const ARROW =
  '<svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true"><path d="M17 2 29 30 17 23 5 30z"/></svg>';

function endIcon(onBoat: boolean, arrow: number | null) {
  const classes = ['ruler-end'];
  if (onBoat) classes.push('on-boat');
  if (arrow !== null) classes.push('ruler-arrow');
  return leaflet().divIcon({
    className: classes.join(' '),
    html:
      arrow === null
        ? ''
        : `<span style="transform: rotate(${Math.round(arrow)}deg)">${ARROW}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

/**
 * Dividers on a map: a button shows two points joined by a line; each point
 * moves with one finger. The point touched last is an arrow, and the label
 * gives the distance and the course from the other point towards it. A point
 * dropped near the boat sticks to it and follows it.
 * @param map - Leaflet map.
 */
export function addRulerControl(map: LeafletMap): void {
  const L = leaflet();
  let ends: [End, End] | null = null;
  /** Rank of the arrow, the point the course leads to. */
  let target = 1;
  let line: Polyline | null = null;
  let label: Marker | null = null;
  let stopFollow: (() => void) | null = null;

  const redraw = () => {
    if (!ends || !line || !label) return;
    const from = ends[1 - target]?.marker.getLatLng();
    const to = ends[target]?.marker.getLatLng();
    if (!from || !to) return;
    line.setLatLngs([from, to]);
    label.setLatLng(L.latLng((from.lat + to.lat) / 2, (from.lng + to.lng) / 2));
    const text = rulerText(
      { lat: from.lat, lon: from.lng },
      { lat: to.lat, lon: to.lng },
    );
    label.setIcon(
      L.divIcon({
        className: 'ruler-label',
        html: `<span>${text}</span>`,
        iconSize: [0, 0],
      }),
    );
    const a = map.latLngToContainerPoint(from);
    const b = map.latLngToContainerPoint(to);
    const screenAngle = (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
    for (const [rank, end] of ends.entries()) {
      end.marker.setIcon(
        endIcon(end.onBoat, rank === target ? screenAngle : null),
      );
      bindDrag(end, rank);
    }
  };

  /** A finger on a point moves it; the map stays still meanwhile. */
  const bindDrag = (end: End, rank: number) => {
    const element = end.marker.getElement();
    if (!element || element.dataset.ruler === '1') return;
    element.dataset.ruler = '1';
    element.style.touchAction = 'none';
    element.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      element.setPointerCapture(event.pointerId);
      map.dragging.disable();
      end.onBoat = false;
      target = rank;
      const box = map.getContainer().getBoundingClientRect();
      const move = (next: PointerEvent) => {
        next.preventDefault();
        end.marker.setLatLng(
          map.containerPointToLatLng(
            L.point(next.clientX - box.left, next.clientY - box.top),
          ),
        );
        redraw();
      };
      const up = () => {
        element.removeEventListener('pointermove', move);
        element.removeEventListener('pointerup', up);
        element.removeEventListener('pointercancel', up);
        map.dragging.enable();
        const boat = boatLatLng();
        if (boat) {
          const gap = map
            .latLngToContainerPoint(boat)
            .distanceTo(map.latLngToContainerPoint(end.marker.getLatLng()));
          if (gap <= SNAP_PX) {
            end.marker.setLatLng(boat);
            end.onBoat = true;
            buzz();
          }
        }
        redraw();
      };
      element.addEventListener('pointermove', move);
      element.addEventListener('pointerup', up);
      element.addEventListener('pointercancel', up);
      redraw();
    });
  };

  const makeEnd = (at: LatLng, onBoat: boolean): End => {
    const marker = L.marker(at, {
      icon: endIcon(onBoat, null),
      zIndexOffset: 2000,
      bubblingMouseEvents: false,
    }).addTo(map);
    return { marker, onBoat };
  };

  /** A touch on the label: type the course and the distance of the arrow. */
  /** The two points as the course reads: from the other point to the arrow. */
  const course = () => {
    const from = ends?.[1 - target]?.marker.getLatLng();
    const arrow = ends?.[target];
    const to = arrow?.marker.getLatLng();
    if (!from || !to || !arrow) return null;
    return {
      from,
      arrow,
      start: { lat: from.lat, lon: from.lng },
      end: { lat: to.lat, lon: to.lng },
    };
  };

  const editCourse = () => {
    const shown = course();
    if (!shown) return;
    buzz();
    openRulerEditor(
      Math.round(bearing(shown.start, shown.end)) % 360,
      distNM(shown.start, shown.end),
      (chosen, nm) => {
        const now = course();
        if (!now) return;
        const reached = destination(now.start, chosen, nm);
        now.arrow.marker.setLatLng(L.latLng(reached.lat, reached.lon));
        now.arrow.onBoat = false;
        redraw();
        if (!map.getBounds().contains([reached.lat, reached.lon])) {
          map.fitBounds(
            L.latLngBounds([now.from, [reached.lat, reached.lon]]),
            { padding: [60, 60] },
          );
        }
      },
      () => flipLaid?.(),
    );
  };

  let button: HTMLElement | null = null;
  const show = (to?: LatLng) => {
    rulerOn.value = true;
    button?.classList.add('on');
    flipLaid = () => {
      target = 1 - target;
      redraw();
    };
    const boat = boatLatLng();
    // Towards a point: from the boat wherever it is; otherwise from the boat
    // when it is on screen.
    const boatSeen =
      boat !== null && (to !== undefined || map.getBounds().contains(boat));
    const first = boatSeen ? boat : map.getCenter();
    const size = map.getSize();
    const second =
      to ??
      map.containerPointToLatLng(
        map.latLngToContainerPoint(first).add([size.x * 0.22, -size.y * 0.18]),
      );
    line = L.polyline([first, second], {
      color: '#e6007e',
      weight: 3,
      dashArray: '8 6',
      interactive: false,
    }).addTo(map);
    label = L.marker(first, {
      keyboard: false,
      zIndexOffset: 2100,
      bubblingMouseEvents: false,
    }).addTo(map);
    label.on('click', () => editCourse());
    target = 1;
    ends = [makeEnd(first, boatSeen), makeEnd(second, false)];
    redraw();
    map.on('rotate zoomend', redraw);
    // The boat marker moves with every GPS position, recorded or not.
    const timer = setInterval(() => {
      const here = boatLatLng();
      if (!ends || !here) return;
      let moved = false;
      for (const end of ends) {
        if (end.onBoat && !end.marker.getLatLng().equals(here)) {
          end.marker.setLatLng(here);
          moved = true;
        }
      }
      if (moved) redraw();
    }, FOLLOW_MS);
    stopFollow = () => clearInterval(timer);
  };

  const hide = () => {
    button?.classList.remove('on');
    if (ends) {
      rulerOn.value = false;
      flipLaid = null;
    }
    stopFollow?.();
    stopFollow = null;
    map.off('rotate zoomend', redraw);
    for (const end of ends ?? []) end.marker.remove();
    line?.remove();
    label?.remove();
    ends = null;
    line = null;
    label = null;
  };

  const control = new L.Control({ position: 'topleft' }) as Control;
  control.onAdd = () => {
    const created = L.DomUtil.create('a', 'leaflet-bar map-full-btn ruler-btn');
    button = created;
    created.href = '#';
    created.setAttribute('role', 'button');
    created.title = 'Compas : distance et cap';
    created.innerHTML = DIVIDERS_ICON;
    L.DomEvent.on(created, 'click', (event) => {
      L.DomEvent.stop(event);
      buzz();
      if (ends) hide();
      else show();
    });
    L.DomEvent.disableClickPropagation(created);
    return created;
  };
  map.addControl(control);
  toPoint.set(map, (to) => {
    hide();
    show(to);
    const shown = ends?.map((end) => end.marker.getLatLng()) ?? [];
    if (!shown.every((at) => map.getBounds().contains(at))) {
      map.fitBounds(L.latLngBounds(shown), { padding: [60, 60] });
    }
  });
  map.on('unload', hide);
}
