/**
 * Routing of a sailing boat along a route drawn by hand: from point to point,
 * with the wind forecast where and when the boat is, its polar, the tacks
 * upwind and the gybes downwind, and the motor in a straight line when the
 * sails make too little.
 */

import type { LatLon } from '../lib/geo.ts';
import { angDiff, bearing, destination, distNM } from '../lib/geo.ts';

import type { Polar } from './polars.ts';
import { bestVmg, foldAngle } from './polars.ts';
import type { RoutePoint } from './routes.ts';

/** The wind at a place and time: direction it comes from and speed. */
export interface Wind {
  /** Degrees, where it comes from. */
  twd: number;
  /** Knots. */
  tws: number;
}

/** The speed of the boat under sail, and with which sails. */
export interface SailSpeed {
  kn: number;
  /** The sails that give it (« Polaire ORC… », « GV haute · Code 0 »). */
  sails: string;
}

/** What a routing needs. */
export interface RoutingAsk {
  points: readonly RoutePoint[];
  /** Departure, epoch ms. */
  departMs: number;
  /** The wind forecast, `null` where or when there is none. */
  windAt: (lat: number, lon: number, ms: number) => Wind | null;
  /** The speed of the boat under sail at an angle to the wind (degrees) and a wind (knots). */
  sailSpeed: (twa: number, tws: number) => SailSpeed;
  /** The polar, for the best angles upwind and downwind. */
  polar: Polar;
  /** Under this speed under sail, the motor (knots). */
  motorBelow: number;
  /** Speed under motor (knots). */
  motorKn: number;
  /** Step of the computation, minutes. @default 10 */
  stepMin?: number;
}

/** One moment of the routing. */
export interface RoutingStep {
  ms: number;
  lat: number;
  lon: number;
  mode: 'sail' | 'motor';
  /** Course steered, degrees. */
  course: number;
  /** Speed, knots. */
  kn: number;
  twd: number;
  tws: number;
  /** Angle to the wind, degrees from 0 to 180. */
  twa: number;
  /** The wind on the starboard (tribord) or port (bâbord) side. */
  side: 'tribord' | 'bâbord';
  sails: string;
  /** Rank of the point the boat sails to. */
  toPoint: number;
}

/** One leg of the routing, from a point of the route to the next. */
export interface RoutingLeg {
  from: number;
  to: number;
  /** Arrival at its end, epoch ms. */
  arriveMs: number;
  sailMin: number;
  motorMin: number;
  tacks: number;
  gybes: number;
  /** Distance sailed or motored, NM. */
  nm: number;
}

/** The routing, or why there is none. */
export type RoutingResult =
  | {
      kind: 'done';
      steps: RoutingStep[];
      legs: RoutingLeg[];
      arriveMs: number;
      nm: number;
      sailMin: number;
      motorMin: number;
      tacks: number;
      gybes: number;
    }
  | { kind: 'no-wind'; ms: number; lat: number; lon: number }
  | { kind: 'too-long' };

/** A tack or a gybe costs this much time, minutes. */
const MANOEUVRE_MIN = 0.5;
/** Within this distance of a point the boat is there, NM. */
const THERE_NM = 0.15;
/** The other tack is taken when it heads closer to the point by this much, degrees. */
const TACK_GAIN_DEG = 25;
/** At most this many days of routing. */
const MOST_DAYS = 14;

/**
 * Route the boat along the points, leg by leg.
 * @param ask - Points, departure, wind, polar, motor.
 * @returns The routing.
 */
export function routeSail(ask: RoutingAsk): RoutingResult {
  const stepMs = (ask.stepMin ?? 10) * 60_000;
  const endMs = ask.departMs + MOST_DAYS * 86_400_000;
  const steps: RoutingStep[] = [];
  const legs: RoutingLeg[] = [];
  let ms = ask.departMs;
  let here: LatLon = ask.points[0] ?? { lat: 0, lon: 0 };
  for (let to = 1; to < ask.points.length; to++) {
    const target = ask.points[to] as RoutePoint;
    const start = ask.points[to - 1] as RoutePoint;
    const legNm = distNM(start, target);
    const leg: RoutingLeg = {
      from: to - 1,
      to,
      arriveMs: ms,
      sailMin: 0,
      motorMin: 0,
      tacks: 0,
      gybes: 0,
      nm: 0,
    };
    let side: RoutingStep['side'] | null = null;
    let mode: 'beat' | 'run' | 'reach' | null = null;
    while (distNM(here, target) > THERE_NM) {
      if (ms > endMs) return { kind: 'too-long' };
      const wind = ask.windAt(here.lat, here.lon, ms);
      if (!wind) return { kind: 'no-wind', ms, lat: here.lat, lon: here.lon };
      const toTarget = bearing(here, target);
      const left = distNM(here, target);
      const plan = steer(
        ask,
        wind,
        toTarget,
        side,
        mode,
        here,
        start,
        target,
        legNm,
      );
      if (plan.manoeuvre && side !== null) {
        if (plan.mode === 'beat') leg.tacks++;
        else leg.gybes++;
        ms += MANOEUVRE_MIN * 60_000;
      }
      side = plan.side;
      mode = plan.mode;
      let { course, kn, sails } = plan;
      let motor = false;
      if (kn < ask.motorBelow) {
        motor = true;
        course = toTarget;
        kn = ask.motorKn;
        sails = 'Moteur';
        mode = null;
        side = null;
      }
      const straight = angDiff(course, toTarget) < 3;
      // Straight, up to the point; else in shorter steps close to it.
      const reachMs = (left / kn) * 3_600_000;
      const runMs = straight
        ? Math.min(stepMs, reachMs)
        : Math.min(stepMs, Math.max(60_000, reachMs / 2));
      const twa = foldAngle(wind.twd - course);
      steps.push({
        ms,
        lat: here.lat,
        lon: here.lon,
        mode: motor ? 'motor' : 'sail',
        course: Math.round(course),
        kn: Math.round(kn * 10) / 10,
        twd: Math.round(wind.twd),
        tws: Math.round(wind.tws * 10) / 10,
        twa: Math.round(twa),
        side: windSide(course, wind.twd),
        sails,
        toPoint: to,
      });
      const nm = (kn * runMs) / 3_600_000;
      here = straight && nm >= left ? target : destination(here, course, nm);
      ms += runMs;
      leg.nm += straight ? Math.min(nm, left) : nm;
      if (motor) leg.motorMin += runMs / 60_000;
      else leg.sailMin += runMs / 60_000;
    }
    here = target;
    leg.arriveMs = ms;
    leg.nm = Math.round(leg.nm * 10) / 10;
    leg.sailMin = Math.round(leg.sailMin);
    leg.motorMin = Math.round(leg.motorMin);
    legs.push(leg);
  }
  const sum = (key: 'sailMin' | 'motorMin' | 'tacks' | 'gybes' | 'nm') =>
    legs.reduce((total, leg) => total + leg[key], 0);
  return {
    kind: 'done',
    steps,
    legs,
    arriveMs: ms,
    nm: Math.round(sum('nm') * 10) / 10,
    sailMin: sum('sailMin'),
    motorMin: sum('motorMin'),
    tacks: sum('tacks'),
    gybes: sum('gybes'),
  };
}

interface Plan {
  course: number;
  kn: number;
  sails: string;
  side: RoutingStep['side'];
  mode: 'beat' | 'run' | 'reach';
  manoeuvre: boolean;
}

/**
 * The course to steer toward the point: straight when the sails carry the
 * boat there, else close-hauled or at the best angle downwind, on the tack
 * that heads closer to the point, keeping it while it still heads well and
 * the boat stays near the route.
 */
function steer(
  ask: RoutingAsk,
  wind: Wind,
  toTarget: number,
  side: RoutingStep['side'] | null,
  mode: Plan['mode'] | null,
  here: LatLon,
  start: LatLon,
  target: LatLon,
  legNm: number,
): Plan {
  const twaDirect = foldAngle(wind.twd - toTarget);
  const beat = bestVmg(ask.polar, wind.tws);
  const run = bestVmg(ask.polar, wind.tws, true);
  const upwind = twaDirect < beat.twa;
  const downwind = twaDirect > run.twa;
  if (!upwind && !downwind) {
    const speed = ask.sailSpeed(twaDirect, wind.tws);
    return {
      course: toTarget,
      kn: speed.kn,
      sails: speed.sails,
      side: windSide(toTarget, wind.twd),
      mode: 'reach',
      manoeuvre: false,
    };
  }
  const angle = upwind ? beat.twa : run.twa;
  // The two courses: the wind on starboard (tribord) or port (bâbord).
  const courses = {
    tribord: norm(wind.twd - angle),
    bâbord: norm(wind.twd + angle),
  };
  const off = (which: RoutingStep['side']) => angDiff(courses[which], toTarget);
  const better: RoutingStep['side'] =
    off('tribord') <= off('bâbord') ? 'tribord' : 'bâbord';
  const thisMode = upwind ? 'beat' : 'run';
  let chosen = better;
  if (side && mode === thisMode && side !== better) {
    const other = better;
    const keepGain = off(side) - off(other) < TACK_GAIN_DEG;
    const away = crossTrack(here, start, target);
    const corridor = Math.max(0.5, Math.min(3, legNm * 0.2));
    if (keepGain && away < corridor) chosen = side;
  }
  const speed = ask.sailSpeed(angle, wind.tws);
  return {
    course: courses[chosen],
    kn: speed.kn,
    sails: speed.sails,
    side: chosen,
    mode: thisMode,
    manoeuvre: mode === thisMode && side !== null && side !== chosen,
  };
}

function norm(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * The side the wind comes from.
 * @param course - Course, degrees.
 * @param twd - Wind from, degrees.
 * @returns `tribord` when it blows on the starboard side.
 */
export function windSide(course: number, twd: number): RoutingStep['side'] {
  const relative = norm(twd - course);
  return relative <= 180 ? 'tribord' : 'bâbord';
}

/**
 * How far from the line of the leg, NM.
 * @param here - The boat.
 * @param start - Start of the leg.
 * @param target - End of the leg.
 * @returns The distance across, NM.
 */
export function crossTrack(
  here: LatLon,
  start: LatLon,
  target: LatLon,
): number {
  const along = distNM(start, here);
  const angle =
    ((bearing(start, here) - bearing(start, target)) * Math.PI) / 180;
  return Math.abs(along * Math.sin(angle));
}

/**
 * The points where the course changes (start, tacks, gybes, motor, points
 * of the route, arrival): a route to keep and show on the map.
 * @param result - The routing.
 * @param points - The points of the route.
 * @returns The points.
 */
export function routingTurns(
  result: Extract<RoutingResult, { kind: 'done' }>,
  points: readonly RoutePoint[],
): RoutePoint[] {
  const turns: RoutePoint[] = [];
  let last: RoutingStep | null = null;
  for (const step of result.steps) {
    const changed =
      last?.toPoint !== step.toPoint ||
      last.mode !== step.mode ||
      angDiff(last.course, step.course) > 20;
    if (changed) {
      if (last !== null && last.toPoint !== step.toPoint) {
        const reached = points[last.toPoint];
        if (reached) turns.push({ ...reached });
      }
      turns.push({ lat: step.lat, lon: step.lon });
    }
    last = step;
  }
  const end = points.at(-1);
  if (end) turns.push({ ...end });
  return turns.filter(
    (point, rank) =>
      rank === 0 || distNM(point, turns[rank - 1] as LatLon) > 0.02,
  );
}
