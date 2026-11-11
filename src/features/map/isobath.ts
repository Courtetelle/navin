import { fr } from '../../lib/format.ts';
import { rad } from '../../lib/geo.ts';

import { bathyAscGet } from './bathyStore.ts';
import type { LatLngPair } from './constants.ts';

/** A depth line. */
export interface IsobathLine {
  /** Depth in metres. */
  d: number;
  pts: LatLngPair[];
  /** Box: south, west, north, east. */
  bb: [number, number, number, number];
  /** Computed from swissBATHY3D on the device. @default undefined */
  b3d?: boolean;
}

/** Distance to a line in metres, and the depth of that line. */
type NearDepth = [number, number];

/** Beyond this distance in metres, a line says nothing about a point. */
const FAR_METRES = 400;

const loaded: { lines: IsobathLine[] | null } = { lines: null };

/**
 * The depth lines already loaded (legacy `isobathData`).
 * @returns The lines, or `null` before `isobathLoad`.
 */
export function isobathData(): IsobathLine[] | null {
  return loaded.lines;
}

/** Forget the lines: new ones were computed. */
export function resetIsobaths(): void {
  loaded.lines = null;
}

/**
 * Depth lines of the device, read once (legacy `isobathLoad`).
 * @returns The lines.
 */
export async function isobathLoad(): Promise<IsobathLine[]> {
  if (loaded.lines) return loaded.lines;
  const all: IsobathLine[] = [];
  const stored = await bathyAscGet();
  for (const record of stored?.lines ?? []) all.push(toLine(record));
  loaded.lines = all;
  return all;
}

/**
 * Convert a stored line `[depth, lat, lon, lat, lon, …]`.
 * @param record - Stored line.
 * @returns The line with its box.
 */
export function toLine(record: readonly number[]): IsobathLine {
  const pts: LatLngPair[] = [];
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (let index = 1; index < record.length; index += 2) {
    const lat = record[index] as number;
    const lon = record[index + 1] as number;
    pts.push([lat, lon]);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lon);
    east = Math.max(east, lon);
  }
  return {
    d: record[0] as number,
    pts,
    bb: [south, west, north, east],
    b3d: true,
  };
}

/**
 * The lines around a point, nearest first.
 * @param all - Depth lines.
 * @param lat - Latitude.
 * @param lng - Longitude.
 * @returns Distance and depth of each line in reach of its box.
 */
export function nearDepths(
  all: readonly IsobathLine[],
  lat: number,
  lng: number,
): NearDepth[] {
  const metresPerLat = 111_320;
  const metresPerLon = 111_320 * Math.cos(rad(lat));
  const near: NearDepth[] = [];
  for (const line of all) {
    const [south, west, north, east] = line.bb;
    if (
      lat < south - 0.01 ||
      lat > north + 0.01 ||
      lng < west - 0.015 ||
      lng > east + 0.015
    ) {
      continue;
    }
    let distance = Infinity;
    for (let index = 1; index < line.pts.length; index++) {
      const [fromLat, fromLon] = line.pts[index - 1] as LatLngPair;
      const [toLat, toLon] = line.pts[index] as LatLngPair;
      const ax = (fromLon - lng) * metresPerLon;
      const ay = (fromLat - lat) * metresPerLat;
      const dx = (toLon - lng) * metresPerLon - ax;
      const dy = (toLat - lat) * metresPerLat - ay;
      const along = -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1e-9);
      const ratio = Math.max(0, Math.min(1, along));
      distance = Math.min(
        distance,
        Math.hypot(ax + ratio * dx, ay + ratio * dy),
      );
    }
    near.push([distance, line.d]);
  }
  return near.toSorted((first, second) => first[0] - second[0]);
}

/** Estimate from the two nearest lines of different depths. */
interface DepthEstimate {
  /** Nearest line. */
  first: NearDepth;
  /** Next line of another depth, when in reach. */
  second: NearDepth | null;
  /** Depth interpolated between both, when there are two. */
  depth: number | null;
}

/**
 * Depth at a point from the lines around it.
 * @param near - Result of {@link nearDepths}.
 * @returns The estimate, or `null` when no line is close enough.
 */
export function estimateDepth(
  near: readonly NearDepth[],
): DepthEstimate | null {
  const first = near[0];
  if (!first || first[0] > FAR_METRES) return null;
  const other = near.find((item) => item[1] !== first[1]);
  if (!other || other[0] >= FAR_METRES) {
    return { first, second: null, depth: null };
  }
  const depth =
    (first[1] * other[0] + other[1] * first[0]) / (first[0] + other[0]);
  return { first, second: other, depth };
}

/**
 * Depth at a point, from the swissBATHY3D lines computed on the device (legacy `depthAt`).
 * @param lat - Latitude.
 * @param lng - Longitude.
 * @returns A text like `≈ 3,2 m`, empty without line nearby.
 */
export function depthAt(lat: number, lng: number): string {
  const estimate = estimateDepth(nearDepths(loaded.lines ?? [], lat, lng));
  if (!estimate) return '';
  const { first, depth } = estimate;
  if (depth !== null) return `≈ ${fr(depth)} m`;
  return `≈ ${first[1]} m (courbe à ${Math.round(first[0])} m)`;
}
