import { pad, textOf } from './format.ts';

/** A point with latitude and longitude in degrees. */
export interface LatLon {
  lat: number;
  lon: number;
}

/** Earth radius in nautical miles. */
const R_NM = 3440.065;

/**
 * Degrees to radians (legacy `rad`).
 * @param degrees - Angle in degrees.
 * @returns Angle in radians.
 */
export function rad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance in nautical miles (legacy `distNM`).
 * @param a - From.
 * @param b - To.
 * @returns Distance in NM.
 */
export function distNM(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Initial true bearing from a to b, 0-360° (legacy `bearing`).
 * @param a - From.
 * @param b - To.
 * @returns Bearing in degrees.
 */
export function bearing(a: LatLon, b: LatLon): number {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * The point reached from a place on a course, over a distance.
 * @param from - Start.
 * @param course - True course, degrees.
 * @param nm - Distance, nautical miles.
 * @returns The point reached.
 */
export function destination(from: LatLon, course: number, nm: number): LatLon {
  const angle = nm / R_NM;
  const heading = rad(course);
  const lat1 = rad(from.lat);
  const lon1 = rad(from.lon);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angle) +
      Math.cos(lat1) * Math.sin(angle) * Math.cos(heading),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(heading) * Math.sin(angle) * Math.cos(lat1),
      Math.cos(angle) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: (lat2 * 180) / Math.PI, lon: (lon2 * 180) / Math.PI };
}

/**
 * Absolute difference between two bearings, 0-180° (legacy `angDiff`).
 * @param a - First bearing.
 * @param b - Second bearing.
 * @returns The difference.
 */
export function angDiff(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * Equirectangular distance in kilometres, for short ranges (legacy `distKm`).
 * @param lat1 - Latitude of the first point.
 * @param lon1 - Longitude of the first point.
 * @param lat2 - Latitude of the second point.
 * @param lon2 - Longitude of the second point.
 * @returns Distance in km.
 */
export function distKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radians = Math.PI / 180;
  const x = (lon2 - lon1) * radians * Math.cos(((lat1 + lat2) / 2) * radians);
  const y = (lat2 - lat1) * radians;
  return Math.hypot(x, y) * 6371;
}

/**
 * Coordinate in degrees and decimal minutes, e.g. `46°30,000' N` (legacy `fmtCoord`).
 * @param value - Latitude or longitude.
 * @param isLat - Latitude (N/S, 2 digits) or longitude (E/W, 3 digits).
 * @returns The formatted coordinate.
 */
export function fmtCoord(value: number, isLat: boolean): string {
  const hemisphere = isLat ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutes = ((absolute - degrees) * 60).toFixed(3).replace('.', ',');
  return `${pad(degrees, isLat ? 2 : 3)}°${minutes.padStart(6, '0')}' ${hemisphere}`;
}

/**
 * Position as text: typed text, or both coordinates separated by two spaces (legacy `fmtPos`).
 * @param position - Position.
 * @returns The text, `''` when absent.
 */
export function fmtPos(
  position: { lat: number; lon: number; text?: unknown } | null | undefined,
): string {
  if (!position) return '';
  if (position.text) return textOf(position.text);
  return `${fmtCoord(position.lat, true)}  ${fmtCoord(position.lon, false)}`;
}
