import { autoAdd, marginVal, roundStep } from '../../lib/boatValues.ts';
import { num } from '../../lib/format.ts';
import { state } from '../../state/index.ts';

/** One depth contour: bounding box `[south, west, north, east]`, level and `[lat, lon]` points. */
export interface DepthContour {
  bb: readonly [number, number, number, number];
  /** Depth of the contour (m). */
  d: number;
  pts: ReadonlyArray<readonly [number, number]>;
}

// Search radius of the contours (m).
const SEARCH_RADIUS = 250;
const METRES_PER_LAT = 110_540;
const ON_CONTOUR_M = 15;

/**
 * Distance from a point to a segment, in metres (legacy `segDist`).
 * @param lat - Latitude of the point.
 * @param lon - Longitude of the point.
 * @param start - First end, `[lat, lon]`.
 * @param end - Second end, `[lat, lon]`.
 * @returns The distance.
 */
export function segmentDistance(
  lat: number,
  lon: number,
  start: readonly [number, number],
  end: readonly [number, number],
): number {
  const metresPerLon = metresPerLongitude(lat);
  const ax = (start[1] - lon) * metresPerLon;
  const ay = (start[0] - lat) * METRES_PER_LAT;
  const bx = (end[1] - lon) * metresPerLon;
  const by = (end[0] - lat) * METRES_PER_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const squared = dx * dx + dy * dy;
  const along = squared ? -(ax * dx + ay * dy) / squared : 0;
  const clamped = Math.max(0, Math.min(1, along));
  return Math.hypot(ax + clamped * dx, ay + clamped * dy);
}

/**
 * Depth under a position, from the contours (legacy `depthEstimate`): between
 * the two closest contours of different levels, interpolated by distance. It
 * is an aid, not a sounder.
 * @param contours - Depth contours.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The estimate (m); `null` without contour nearby (deep water or no
 * data), or with a single contour not under the boat.
 */
export function estimateDepth(
  contours: readonly DepthContour[],
  lat: number,
  lon: number,
): number | null {
  const closest = closestLevels(contours, lat, lon);
  const levels = [...closest.keys()].toSorted(
    (first, second) => (closest.get(first) ?? 0) - (closest.get(second) ?? 0),
  );
  const [nearest] = levels;
  if (nearest === undefined) return null;
  const nearestDistance = closest.get(nearest) ?? 0;
  const other = levels.find((level) => level !== nearest);
  if (other === undefined) {
    return nearestDistance < ON_CONTOUR_M ? nearest : null;
  }
  const otherDistance = closest.get(other) ?? 0;
  const interpolated =
    (nearest * otherDistance + other * nearestDistance) /
    (nearestDistance + otherDistance);
  return Math.round(interpolated * 10) / 10;
}

/**
 * Minimum sounding of the plotter: the boat value, else the draft plus the
 * pilot foot (legacy `sondeMin`). Uses the open cruise, else the first boat.
 * @returns The sounding (m), or `null`.
 */
export function sondeMin(): number | null {
  const info: Record<string, unknown> =
    state.data.cruise.value?.info ?? state.data.boats.value[0]?.info ?? {};
  const stored = num(info.draftPilot);
  if (stored !== null) return stored;
  const settings = state.preferences.settings.value;
  return num(
    autoAdd(
      info.draft,
      marginVal(settings, 'piedPilote'),
      roundStep(settings, 'arrProf'),
    ),
  );
}

/**
 * Alarm intensity (legacy `depthK`).
 * @param depth - Water under the boat (m).
 * @param minimum - Minimum sounding (m).
 * @param start - Margin above the sounding where the alarm starts (m).
 * @returns 0 (nothing) to 1 (maximum).
 */
export function depthIntensity(
  depth: number | null,
  minimum: number | null,
  start: number,
): number {
  if (depth === null || minimum === null || depth >= minimum + start) return 0;
  return Math.min(1, (minimum + start - depth) / start);
}

function metresPerLongitude(lat: number): number {
  return 111_320 * Math.cos((lat * Math.PI) / 180);
}

function closestLevels(
  contours: readonly DepthContour[],
  lat: number,
  lon: number,
): Map<number, number> {
  const latMargin = SEARCH_RADIUS / METRES_PER_LAT;
  const lonMargin = SEARCH_RADIUS / metresPerLongitude(lat);
  const closest = new Map<number, number>();
  for (const contour of contours) {
    const [south, west, north, east] = contour.bb;
    if (
      lat < south - latMargin ||
      lat > north + latMargin ||
      lon < west - lonMargin ||
      lon > east + lonMargin
    ) {
      continue;
    }
    for (let index = 1; index < contour.pts.length; index++) {
      const start = contour.pts[index - 1];
      const end = contour.pts[index];
      if (!start || !end) continue;
      const distance = segmentDistance(lat, lon, start, end);
      const best = closest.get(contour.d);
      if (
        distance <= SEARCH_RADIUS &&
        (best === undefined || distance < best)
      ) {
        closest.set(contour.d, distance);
      }
    }
  }
  return closest;
}
