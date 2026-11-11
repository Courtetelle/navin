import type { Map as LeafletMap, MapOptions } from 'leaflet';

import { toast } from '../../state/index.ts';

import { stopGlide } from './boatFollow.ts';
import { tracker, trkShowCourse } from './trackerState.ts';

/** North up, or the course of the boat up. */
type MapOrientation = 'north' | 'course';

/** A map that can turn (leaflet-rotate). */
type TurningMap = LeafletMap & {
  getBearing: () => number;
  setBearing: (bearing: number) => void;
};

/**
 * The orientation chosen in this run of the app: every launch starts north
 * up (the blue arrow), then the last choice stays.
 */
let chosen: MapOrientation = 'north';
/** Below this speed in knots the course of a GPS means nothing. */
const MIN_SPEED_KN = 1;
/** A smaller change of course does not turn the map. */
const MIN_TURN_DEG = 1;

/** The options of a map that can turn, with gestures left as they are. */
export const TURNING_MAP_OPTIONS = {
  rotate: true,
  touchRotate: false,
  shiftKeyRotate: false,
  rotateControl: false,
} as MapOptions;

/**
 * The orientation chosen.
 * @returns North up unless the course was chosen since the launch.
 */
export function mapOrientation(): MapOrientation {
  return chosen;
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
 * Turn a map as the orientation asks.
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
}

/**
 * What a tap on the position button does: first bring the boat back to the
 * middle of the map; once it is there, change the orientation.
 * @param follows - The map follows the boat.
 * @param known - The position of the boat is known.
 * @returns The action.
 */
export function locateAction(
  follows: boolean,
  known: boolean,
): 'recenter' | 'orient' {
  return follows && known ? 'orient' : 'recenter';
}

/**
 * Change between north up and course up.
 * @param map - Leaflet map.
 */
export function toggleOrientation(map: LeafletMap): void {
  stopGlide();
  const next = mapOrientation() === 'course' ? 'north' : 'course';
  chosen = next;
  toast(next === 'course' ? 'Cap en haut' : 'Nord en haut');
  showOrientation(map);
  const handle = tracker.current;
  orientMap(map, handle?.lastCog, handle?.lastSog);
  trkShowCourse(handle?.lastCog);
}

function showOrientation(map: LeafletMap): void {
  const container = map.getContainer();
  container.classList.toggle('course-up', mapOrientation() === 'course');
  const button = container.querySelector('.map-locate-btn');
  if (button) {
    button.setAttribute(
      'title',
      mapOrientation() === 'course'
        ? 'Recentrer, puis nord en haut'
        : 'Recentrer, puis cap en haut',
    );
  }
}

/**
 * Show the orientation chosen on a map that has just opened.
 * @param map - Leaflet map.
 */
export function startOrientation(map: LeafletMap): void {
  showOrientation(map);
  orientMap(map, null, null);
}
