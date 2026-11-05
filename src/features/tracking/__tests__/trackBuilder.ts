import type { TrackSample } from '../detector.ts';

/** 2026-07-15 08:00:00 UTC. */
export const START = Date.UTC(2026, 6, 15, 8);

/** First point of the test tracks, in the middle of Lake Geneva. */
export const ORIGIN: TrackSample = { t: START, lat: 46.5, lon: 6.6 };

/** Wind added to the points of a leg. */
export interface TestWind {
  twd: number;
  tws: number;
}

/**
 * Points of a straight leg, one every 30 s.
 * @param from - Point the leg starts from (not included).
 * @param course - Course in degrees.
 * @param knots - Speed in knots.
 * @param count - Number of points.
 * @param wind - Wind of the points.
 * @returns The points.
 */
export function leg(
  from: TrackSample,
  course: number,
  knots: number,
  count: number,
  wind?: TestWind,
): TrackSample[] {
  const points: TrackSample[] = [];
  const radians = (course * Math.PI) / 180;
  const stepDegrees = (knots * 30) / 3600 / 60;
  const cosine = Math.cos((46.5 * Math.PI) / 180);
  let { t, lat, lon } = from;
  for (let index = 0; index < count; index++) {
    t += 30_000;
    lat += stepDegrees * Math.cos(radians);
    lon += (stepDegrees * Math.sin(radians)) / cosine;
    points.push({ t, lat, lon, sog: knots, cog: course, ...wind });
  }
  return points;
}

/**
 * Last point of a leg.
 * @param points - The leg.
 * @returns Its last point.
 */
export function lastOf(points: readonly TrackSample[]): TrackSample {
  const point = points.at(-1);
  if (!point) throw new Error('empty leg');
  return point;
}
