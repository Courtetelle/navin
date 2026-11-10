import type { LatLon } from '../../lib/geo.ts';
import { bearing, distNM } from '../../lib/geo.ts';

/** Below this, the distance is also given in metres. */
const METRES_BELOW_NM = 1;
const METRES_PER_NM = 1852;

/**
 * What the dividers read between their two points: distance and course
 * from the first to the second.
 * @param from - First point.
 * @param to - Second point.
 * @returns For example « 0,42 NM (778 m) · cap 047° ».
 */
export function rulerText(from: LatLon, to: LatLon): string {
  const nm = distNM(from, to);
  const shown = nm.toFixed(nm < 10 ? 2 : 1).replace('.', ',');
  const metres =
    nm < METRES_BELOW_NM ? ` (${Math.round(nm * METRES_PER_NM)} m)` : '';
  const course = String(Math.round(bearing(from, to)) % 360).padStart(3, '0');
  return `${shown} NM${metres} · cap ${course}°`;
}
