/**
 * The fetch: the length of water over which the wind blows before reaching a
 * point, and the sea it raises there (Young and Verhagen 1996, deep water).
 * The rays walk up the wind over a land mask; they stop on land.
 */

/** Earth radius, km. */
const EARTH_KM = 6371;
/** Step of a ray, km (the land grid of NavIn is about 0.5 km). */
const STEP_KM = 0.25;
/** Beyond this, the fetch is the open sea: the sea is the one of the wind alone. */
export const OPEN_FETCH_KM = 500;
/** The land mask says « land » 1 km inside the shore: taken off each ray. */
const SHORE_KM = 1;
/** Rays every 6° over ±24° around the wind, weighted by their cosine. */
const SPREAD = [-24, -18, -12, -6, 0, 6, 12, 18, 24];
const G = 9.81;
const KN_MS = 1852 / 3600;

/** The fetch at a point for one wind. */
export interface Fetch {
  /** Effective fetch, km (weighted over the rays). */
  km: number;
  /** Fetch straight up the wind, km. */
  straightKm: number;
  /** Whether the rays reach the open sea (no land within {@link OPEN_FETCH_KM}). */
  open: boolean;
}

/**
 * A point a distance along a bearing (great circle).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param bearing - Bearing, degrees.
 * @param km - Distance.
 * @returns The point.
 */
export function pointAlong(
  lat: number,
  lon: number,
  bearing: number,
  km: number,
): { lat: number; lon: number } {
  const rad = Math.PI / 180;
  const angle = km / EARTH_KM;
  const phi = lat * rad;
  const theta = bearing * rad;
  const phi2 = Math.asin(
    Math.sin(phi) * Math.cos(angle) +
      Math.cos(phi) * Math.sin(angle) * Math.cos(theta),
  );
  const lambda2 =
    lon * rad +
    Math.atan2(
      Math.sin(theta) * Math.sin(angle) * Math.cos(phi),
      Math.cos(angle) - Math.sin(phi) * Math.sin(phi2),
    );
  return { lat: phi2 / rad, lon: lambda2 / rad };
}

/**
 * Length of one ray up the wind until land.
 * @param isLand - Whether a place is land.
 * @param lat - Latitude of the point.
 * @param lon - Longitude of the point.
 * @param bearing - Bearing the ray goes to, degrees.
 * @returns The length, km, {@link OPEN_FETCH_KM} at most.
 */
function ray(
  isLand: (lat: number, lon: number) => boolean,
  lat: number,
  lon: number,
  bearing: number,
): number {
  for (let km = STEP_KM; km <= OPEN_FETCH_KM; km += STEP_KM) {
    const at = pointAlong(lat, lon, bearing, km);
    if (isLand(at.lat, at.lon)) return Math.max(0, km - SHORE_KM);
  }
  return OPEN_FETCH_KM;
}

/**
 * The effective fetch of a wind at a point: rays every 6° over ±24° around
 * the direction the wind comes from, weighted by their cosine.
 * @param isLand - Whether a place is land (the land mask).
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param windFrom - Direction the wind comes from, degrees.
 * @returns The fetch, or null when the point itself is on land.
 */
export function fetchOf(
  isLand: (lat: number, lon: number) => boolean,
  lat: number,
  lon: number,
  windFrom: number,
): Fetch | null {
  if (isLand(lat, lon)) return null;
  let sum = 0;
  let weights = 0;
  let straightKm = 0;
  let open = true;
  for (const offset of SPREAD) {
    const length = ray(isLand, lat, lon, windFrom + offset);
    const weight = Math.cos((offset * Math.PI) / 180);
    sum += length * weight;
    weights += weight;
    if (offset === 0) straightKm = length;
    if (length < OPEN_FETCH_KM) open = false;
  }
  return { km: open ? OPEN_FETCH_KM : sum / weights, straightKm, open };
}

/**
 * The sea a wind raises over a fetch, in deep water, wind established
 * (Young and Verhagen 1996; tends to the fully developed sea).
 * @param windKn - Wind, knots.
 * @param fetchKm - Fetch, km.
 * @returns Significant height (m) and peak period (s), null without wind.
 */
export function fetchSea(
  windKn: number,
  fetchKm: number,
): { hs: number; period: number } | null {
  const wind = windKn * KN_MS;
  if (!(wind > 0) || !(fetchKm > 0)) return null;
  const fetch = (G * fetchKm * 1000) / wind ** 2;
  const height = 0.2413 * Math.tanh(0.00313 * fetch ** 0.57) ** 0.87;
  const period = 7.519 * Math.tanh(0.0005215 * fetch ** 0.73) ** 0.387;
  return { hs: (height * wind ** 2) / G, period: (period * wind) / G };
}
