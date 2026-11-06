import type { LatLngPair } from './constants.ts';
import ports from './lemanPorts.json' with { type: 'json' };

/** A port known only as a point covers this far around it, in metres. */
const POINT_RADIUS_M = 100;
const METRES_PER_LAT = 111_320;

const RINGS = ports.rings as LatLngPair[][];
const POINTS = ports.points as LatLngPair[];

function inRing(
  ring: readonly LatLngPair[],
  lat: number,
  lon: number,
): boolean {
  let inside = false;
  let previous = ring.at(-1) as LatLngPair;
  for (const point of ring) {
    const [lat1, lon1] = previous;
    const [lat2, lon2] = point;
    if (
      lat1 > lat !== lat2 > lat &&
      lon < lon1 + ((lat - lat1) * (lon2 - lon1)) / (lat2 - lat1)
    ) {
      inside = !inside;
    }
    previous = point;
  }
  return inside;
}

/**
 * Whether a position lies in a port of Lake Geneva (OpenStreetMap outlines).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns `true` in a port.
 */
export function inLemanPort(lat: number, lon: number): boolean {
  if (RINGS.some((ring) => inRing(ring, lat, lon))) return true;
  const metresPerLon = METRES_PER_LAT * Math.cos((lat * Math.PI) / 180);
  return POINTS.some(
    ([portLat, portLon]) =>
      Math.hypot(
        (portLat - lat) * METRES_PER_LAT,
        (portLon - lon) * metresPerLon,
      ) <= POINT_RADIUS_M,
  );
}
