import type { LatLng, LatLngExpression, Map as LeafletMap } from 'leaflet';

import { leaflet } from './leaflet.ts';
import { isMapLive } from './mapExtras.ts';
import { bearingFor, mapBearing, mapOrientation } from './mapOrientation.ts';

/** What a glide moves. */
export interface Glider {
  map: LeafletMap;
  /** Moves the boat and what goes with it. */
  place: (position: LatLng) => void;
  /** Turns the boat. */
  turnBoat: (course: number) => void;
  /** The map follows the boat. */
  follows: () => boolean;
}

/** One step from the boat as it is to the last GPS point. */
export interface GlideTarget {
  from: LatLng;
  to: LatLng;
  course: number | null | undefined;
  speed: number | null | undefined;
}

/** A glide takes about the time between two GPS points. */
const MIN_GLIDE_MS = 300;
const MAX_GLIDE_MS = 1200;

let frame: number | null = null;
let aimedBearing: number | null = null;
let shownCourse: number | null = null;
let lastTarget: LatLng | null = null;
let lastPointAt = 0;
let zooming = false;

/**
 * How long a glide lasts.
 * @param elapsed - Time since the last GPS point, in ms.
 * @returns The duration in ms.
 */
export function glideDuration(elapsed: number): number {
  return Math.min(MAX_GLIDE_MS, Math.max(MIN_GLIDE_MS, elapsed));
}

/**
 * An angle between two others, by the short way around.
 * @param from - First angle (degrees).
 * @param to - Second angle (degrees).
 * @param part - Part of the way, from 0 to 1.
 * @returns The angle, from 0 to 360.
 */
export function angleBetween(from: number, to: number, part: number): number {
  const turn = ((to - from + 540) % 360) - 180;
  return (from + turn * part + 360) % 360;
}

/** Stop the glide under way; the next GPS point starts another one. */
export function stopGlide(): void {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  aimedBearing = null;
}

function panToBoat(map: LeafletMap, position: LatLng): void {
  const offset = map
    .latLngToContainerPoint(position)
    .subtract(map.getSize().divideBy(2))
    .round();
  if (offset.x !== 0 || offset.y !== 0) {
    map.panBy(offset, { animate: false });
  }
}

function turnMap(map: LeafletMap, bearing: number): void {
  (map as LeafletMap & { setBearing?: (value: number) => void }).setBearing?.(
    bearing,
  );
}

/**
 * Move the boat and the map smoothly to a new GPS point, and turn the map to
 * the course: a jump at each point would make the map jerk.
 * @param glider - What moves.
 * @param target - Where to, with the course and the speed.
 */
export function glideBoat(glider: Glider, target: GlideTarget): void {
  const { map, place, turnBoat, follows } = glider;
  const { from, to, course, speed } = target;
  const startBearing = mapBearing(map);
  const known = course !== null && course !== undefined;
  const wanted =
    bearingFor(mapOrientation(), aimedBearing ?? startBearing, course, speed) ??
    aimedBearing;
  const samePoint = lastTarget?.equals(to) ?? false;
  if (
    samePoint &&
    wanted === aimedBearing &&
    (!known || course === shownCourse)
  ) {
    return;
  }
  const now = performance.now();
  const duration = glideDuration(samePoint ? MIN_GLIDE_MS : now - lastPointAt);
  if (!samePoint) lastPointAt = now;
  lastTarget = to;
  if (frame !== null) cancelAnimationFrame(frame);
  aimedBearing = wanted;
  const startCourse = shownCourse ?? (known ? course : null);
  const start = now;
  const step = (time: number) => {
    frame = null;
    if (!isMapLive(map)) {
      aimedBearing = null;
      return;
    }
    if (zooming) {
      frame = requestAnimationFrame(step);
      return;
    }
    const part = Math.min(1, (time - start) / duration);
    const position = leaflet().latLng(
      from.lat + (to.lat - from.lat) * part,
      from.lng + (to.lng - from.lng) * part,
    );
    place(position);
    if (wanted !== null) turnMap(map, angleBetween(startBearing, wanted, part));
    if (known && startCourse !== null) {
      shownCourse = angleBetween(startCourse, course, part);
      turnBoat(shownCourse);
    }
    if (follows()) panToBoat(map, position);
    if (part < 1) {
      frame = requestAnimationFrame(step);
    } else {
      aimedBearing = null;
      if (known) shownCourse = course;
    }
  };
  frame = requestAnimationFrame(step);
}

/**
 * Keep the boat in the middle when the map changes size (the phone turns, a bar
 * folds), and let a zoom finish before moving again.
 * @param map - Leaflet map.
 * @param boat - Where the boat is if the map follows it, otherwise `null`.
 */
export function keepBoatCentred(
  map: LeafletMap,
  boat: () => LatLngExpression | null,
): void {
  zooming = false;
  shownCourse = null;
  lastTarget = null;
  map.on('zoomstart', () => {
    zooming = true;
  });
  map.on('zoomend', () => {
    zooming = false;
  });
  let size = map.getSize();
  const observer = new ResizeObserver(() => {
    if (!isMapLive(map)) return;
    map.invalidateSize({ pan: false });
    const next = map.getSize();
    if (next.equals(size)) return;
    size = next;
    stopGlide();
    turnMap(map, mapBearing(map));
    const position = boat();
    if (position) map.setView(position, map.getZoom(), { animate: false });
  });
  observer.observe(map.getContainer());
  map.on('unload', () => {
    observer.disconnect();
    stopGlide();
  });
}
