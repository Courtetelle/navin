import type { LatLon } from '../lib/geo.ts';
import { bearing, distNM } from '../lib/geo.ts';

/** A point of a route. */
export interface RoutePoint {
  lat: number;
  lon: number;
  /**
   * A name of its own (« Bouée du Rohein »); without one the point is read
   * by its rank (P1, P2…).
   * @default undefined
   */
  name?: string;
}

/** A route planned on the map (`ldb.routes[]`). */
export interface NavRoute {
  id: string;
  name: string;
  /** Created (ISO). */
  at: string;
  /** Last change (ISO): the newer one wins between devices. */
  mod: string;
  points: RoutePoint[];
  /** Speed planned over the ground, knots. */
  speed: number;
  /**
   * Departure planned (ISO); with it each point has its time of passage,
   * for the weather along the route.
   * @default undefined
   */
  depart?: string | null;
  /**
   * How it was drawn: by hand, or computed in the water then touched up.
   * @default 'manual'
   */
  how?: 'manual' | 'auto';
  [key: string]: unknown;
}

/** Speed planned by default: a Dufour 445 cruising under sail. */
export const DEFAULT_ROUTE_SPEED = 6.5;

/** One leg of a route, from a point to the next one. */
export interface RouteLeg {
  from: RoutePoint;
  to: RoutePoint;
  /** Nautical miles. */
  nm: number;
  /** True course, 0 to 359. */
  course: number;
  /** Distance from the start to the end of this leg. */
  totalNm: number;
}

/**
 * The legs of a route, each with its course and distance.
 * @param points - The points, in order.
 * @returns One leg per pair of points in a row.
 */
export function routeLegs(points: readonly RoutePoint[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  let totalNm = 0;
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1] as RoutePoint;
    const to = points[index] as RoutePoint;
    const nm = distNM(from, to);
    totalNm += nm;
    legs.push({
      from,
      to,
      nm,
      course: Math.round(bearing(from, to)) % 360,
      totalNm,
    });
  }
  return legs;
}

/**
 * The length of a route.
 * @param points - The points.
 * @returns Nautical miles.
 */
export function routeNm(points: readonly RoutePoint[]): number {
  return routeLegs(points).at(-1)?.totalNm ?? 0;
}

/**
 * The time of passage at each point, at the speed planned from the departure.
 * @param route - Points, speed and departure.
 * @returns Milliseconds since 1970 for each point, or `null` without a
 * departure or a speed.
 */
export function routeTimes(
  route: Pick<NavRoute, 'points' | 'speed' | 'depart'>,
): number[] | null {
  const start = route.depart ? Date.parse(route.depart) : Number.NaN;
  if (!Number.isFinite(start) || !(route.speed > 0)) return null;
  const times = [start];
  for (const leg of routeLegs(route.points)) {
    times.push(start + (leg.totalNm / route.speed) * 3_600_000);
  }
  return times.slice(0, route.points.length);
}

/**
 * How long the route takes at the speed planned.
 * @param route - Points and speed.
 * @returns Milliseconds, 0 without a speed.
 */
export function routeDuration(
  route: Pick<NavRoute, 'points' | 'speed'>,
): number {
  if (!(route.speed > 0)) return 0;
  return (routeNm(route.points) / route.speed) * 3_600_000;
}

/**
 * What a point is called: its own name, or its rank.
 * @param points - The points.
 * @param index - Its rank, from 0.
 * @returns For example « P3 ».
 */
export function pointName(
  points: readonly RoutePoint[],
  index: number,
): string {
  return points[index]?.name?.trim() || `P${index + 1}`;
}

/**
 * A point between two points, where a new one is put to bend a leg.
 * @param a - First point.
 * @param b - Second point.
 * @returns The middle.
 */
export function midpoint(a: LatLon, b: LatLon): RoutePoint {
  return { lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 };
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function xml(text: string): string {
  return text.replaceAll(
    /[&<>"']/g,
    (character) => XML_ENTITIES[character] ?? character,
  );
}

/**
 * A route as a GPX file (`<rte>`), read by plotters and other apps.
 * @param route - The route.
 * @returns The GPX text.
 */
export function routeToGpx(route: Pick<NavRoute, 'name' | 'points'>): string {
  const points = route.points.map(
    (point, index) =>
      `<rtept lat="${point.lat}" lon="${point.lon}"><name>${xml(pointName(route.points, index))}</name></rtept>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="NavIn" xmlns="http://www.topografix.com/GPX/1/1">
<rte><name>${xml(route.name || 'Route')}</name>
${points.join('\n')}
</rte></gpx>`;
}

/**
 * Whether a stored value is a usable route.
 * @param value - Untrusted value (backup, other device).
 * @returns It has an id and points with numbers.
 */
export function isRoute(value: unknown): value is NavRoute {
  const route = value as NavRoute | null;
  return (
    typeof route?.id === 'string' &&
    route.id !== '' &&
    Array.isArray(route.points) &&
    route.points.every(
      (point) =>
        Number.isFinite(point?.lat) &&
        Number.isFinite(point?.lon) &&
        Math.abs(point.lat) <= 90 &&
        Math.abs(point.lon) <= 180,
    )
  );
}

/**
 * The route as said in a routing: its number and its name, without the date
 * and hour some names carry.
 * @param route - The route.
 * @param routes - All the routes, in the order they were made.
 * @returns « Route 2 » or « Route 3 · Portrieux → Bréhat ».
 */
export function routeLabel(
  route: NavRoute,
  routes: readonly NavRoute[],
): string {
  const name = route.name
    .replaceAll(
      /\s*·?\s*(?:routage\s*)?\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+\d{1,2}[:h]\d{2}/giu,
      '',
    )
    .replace(/\s*·\s*$/u, '')
    .trim();
  if (/^Route \d+\b/u.test(name)) return name;
  const rank = routes.findIndex((item) => item.id === route.id) + 1;
  return rank > 0 ? `Route ${rank} · ${name || 'sans nom'}` : name;
}
