import type { Map as LeafletMap, MapOptions } from 'leaflet';

import { buzz } from '../../lib/dom.ts';
import { toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { leaflet } from './leaflet.ts';
import { tracker, trkShowCourse } from './trackerState.ts';

/** North up, or the course of the boat up. */
export type MapOrientation = 'north' | 'course';

/** A map that can turn (leaflet-rotate). */
type TurningMap = LeafletMap & {
  getBearing: () => number;
  setBearing: (bearing: number) => void;
};

const KEY = 'ldb.mapOrientation';
/** Below this speed in knots the course of a GPS means nothing. */
const MIN_SPEED_KN = 1;
/** A smaller change of course does not turn the map, so that it stays calm. */
const MIN_TURN_DEG = 3;
const COMPASS_ICON =
  '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2 16 12H8Z" fill="#d00000"/><path d="M12 22 8 12h8Z" fill="#8a94a6"/></svg>';

/** The options of a map that can turn, with gestures left as they are. */
export const TURNING_MAP_OPTIONS = {
  rotate: true,
  touchRotate: false,
  shiftKeyRotate: false,
  rotateControl: false,
} as MapOptions;

/**
 * The orientation chosen.
 * @returns North up unless the course was chosen.
 */
export function mapOrientation(): MapOrientation {
  return store.raw(KEY) === 'course' ? 'course' : 'north';
}

/**
 * The bearing a map should take for a course, or `null` to leave it as it is.
 * @param orientation - Orientation chosen.
 * @param bearing - Present bearing of the map (degrees, clockwise).
 * @param course - Course of the boat (degrees), if known.
 * @param speed - Speed in knots, if known.
 * @returns The new bearing, or `null`.
 */
export function bearingFor(
  orientation: MapOrientation,
  bearing: number,
  course: number | null | undefined,
  speed: number | null | undefined,
): number | null {
  if (orientation === 'north') return bearing === 0 ? null : 0;
  if (course === null || course === undefined || Number.isNaN(course)) {
    return null;
  }
  if (speed !== null && speed !== undefined && speed < MIN_SPEED_KN) {
    return null;
  }
  const target = (360 - course) % 360;
  const turn = Math.abs(((target - bearing + 540) % 360) - 180);
  return turn < MIN_TURN_DEG ? null : target;
}

/**
 * The present bearing of a map.
 * @param map - Leaflet map.
 * @returns The bearing, 0 for a map that cannot turn.
 */
export function mapBearing(map: LeafletMap): number {
  return (map as Partial<TurningMap>).getBearing?.() ?? 0;
}

/**
 * Turn a map as the orientation asks, then show its bearing on the compass.
 * @param map - Leaflet map.
 * @param course - Course of the boat (degrees), if known.
 * @param speed - Speed in knots, if known.
 */
export function orientMap(
  map: LeafletMap,
  course: number | null | undefined,
  speed: number | null | undefined,
): void {
  const turning = map as TurningMap;
  if (typeof turning.setBearing !== 'function') return;
  const bearing = bearingFor(
    mapOrientation(),
    turning.getBearing(),
    course,
    speed,
  );
  if (bearing !== null) turning.setBearing(bearing);
  const needle = map
    .getContainer()
    .querySelector<HTMLElement>('.map-compass svg');
  if (needle) needle.style.transform = `rotate(${turning.getBearing()}deg)`;
}

/**
 * The compass of a map: it shows where north is; a tap changes between north up
 * and course up.
 * @param map - Leaflet map.
 */
export function addOrientationControl(map: LeafletMap): void {
  const L = leaflet();
  // Not a Leaflet control: those hide in the drawer, a compass must stay in view.
  const button = L.DomUtil.create('a', 'map-compass', map.getContainer());
  button.href = '#';
  button.setAttribute('role', 'button');
  button.innerHTML = COMPASS_ICON;
  const label = () => {
    button.title =
      mapOrientation() === 'course' ? 'Cap en haut' : 'Nord en haut';
    button.setAttribute('aria-label', button.title);
    button.classList.toggle('course-up', mapOrientation() === 'course');
  };
  label();
  L.DomEvent.on(button, 'click', (event) => {
    L.DomEvent.stop(event);
    buzz();
    const next = mapOrientation() === 'course' ? 'north' : 'course';
    store.setRaw(KEY, next);
    label();
    toast(next === 'course' ? 'Cap en haut' : 'Nord en haut');
    const handle = tracker.current;
    orientMap(map, handle?.lastCog, handle?.lastSog);
    trkShowCourse(handle?.lastCog);
  });
  L.DomEvent.disableClickPropagation(button);
  orientMap(map, null, null);
}
