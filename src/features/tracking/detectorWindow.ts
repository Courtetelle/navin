import { angDiff, bearing, distNM, rad } from '../../lib/geo.ts';

import type { Detector, TrackEvent, TrackSample } from './detector.ts';
import { allureFromTwa } from './seaState.ts';

const TURN_HOLD_MS = 120_000;
const ALLURE_HOLD_MS = 180_000;
const ALLURE_MIN_SPACING_MS = 600_000;

/**
 * Key point at a position; the course and the speed default to the last known.
 * @param detector - Detector state.
 * @param kind - Kind, null for a plain point.
 * @param point - Position.
 * @param cog - Course.
 * @param sog - Speed.
 * @returns The event.
 */
export function makeEvent(
  detector: Detector,
  kind: string | null,
  point: TrackSample,
  cog?: number | null,
  sog?: number | null,
): TrackEvent {
  return {
    kind,
    t: point.t,
    lat: point.lat,
    lon: point.lon,
    cog: cog ?? detector.lastCog,
    sog: sog ?? detector.lastSog,
    dist: detector.dist,
    twd: detector.lastTwd,
    tws: detector.lastTws,
  };
}

/**
 * Read the course and the speed over the window, then look for a lasting
 * course change or change of point of sail.
 * @param detector - Detector state.
 * @param oldest - First position of the window.
 * @param sample - Last position.
 * @param events - Receives the key points.
 */
export function analyseWindow(
  detector: Detector,
  oldest: TrackSample,
  sample: TrackSample,
  events: TrackEvent[],
): void {
  const moved = distNM(oldest, sample);
  const wind = windOf(detector.buf);
  if (wind) {
    detector.lastTwd = wind.twd;
    detector.lastTws = wind.tws;
  }
  if (moved < 0.04) {
    if (moved < 0.01) detector.lastSog = 0;
    return;
  }
  const course = bearing(oldest, sample);
  detector.lastCog = Math.round(course) % 360;
  detector.lastSog =
    Math.round((moved / ((sample.t - oldest.t) / 3_600_000)) * 10) / 10;
  const twa = wind ? twaSigned(wind.twd, course) : null;
  const side = twa === null ? 0 : Math.sign(twa);
  const allure =
    twa !== null && detector.lastSog > 1.5
      ? allureFromTwa(Math.abs(twa))
      : null;
  if (detector.ref == null) {
    detector.ref = course;
    detector.refSide = side;
    detector.refAllure = allure;
  } else if (angDiff(course, detector.ref) > detector.turn) {
    holdTurn(detector, sample, course, twa, side, allure, events);
  } else {
    detector.pendSince = null;
    holdAllure(detector, sample, course, side, allure, events);
  }
}

function holdTurn(
  detector: Detector,
  sample: TrackSample,
  course: number,
  twa: number | null,
  side: number,
  allure: string | null,
  events: TrackEvent[],
): void {
  if (detector.pendSince == null) {
    detector.pendSince = sample.t;
    return;
  }
  if (sample.t - detector.pendSince < TURN_HOLD_MS) return;
  // The wind changed side: a tack with the wind ahead, else a gybe.
  const windSideChanged =
    side !== 0 && detector.refSide !== 0 && side !== detector.refSide;
  const tack = Math.abs(twa ?? 0) < 100 ? 'Virement' : 'Empannage';
  events.push(
    makeEvent(detector, windSideChanged ? tack : 'Changement de cap', sample),
  );
  detector.ref = course;
  detector.refSide = side;
  detector.refAllure = allure;
  detector.pendSince = null;
  detector.allurePend = null;
  detector.lastEntryT = sample.t;
}

function holdAllure(
  detector: Detector,
  sample: TrackSample,
  course: number,
  side: number,
  allure: string | null,
  events: TrackEvent[],
): void {
  if (!allure || !detector.refAllure || allure === detector.refAllure) {
    detector.allurePend = null;
    if (allure && !detector.refAllure) detector.refAllure = allure;
    return;
  }
  if (detector.allurePend !== allure) {
    detector.allurePend = allure;
    detector.allureSince = sample.t;
    return;
  }
  if (
    sample.t - (detector.allureSince ?? 0) >= ALLURE_HOLD_MS &&
    sample.t - (detector.lastEntryT ?? 0) >= ALLURE_MIN_SPACING_MS
  ) {
    events.push(makeEvent(detector, 'Changement d’allure', sample));
    detector.refAllure = allure;
    detector.ref = course;
    detector.refSide = side;
    detector.allurePend = null;
    detector.lastEntryT = sample.t;
  }
}

/** Mean wind of the window, the direction by circular mean. */
function windOf(buffer: readonly TrackSample[]): {
  twd: number;
  tws: number;
} | null {
  let x = 0;
  let y = 0;
  let speed = 0;
  let count = 0;
  for (const point of buffer) {
    if (point.twd == null || point.tws == null) continue;
    x += Math.cos(rad(point.twd));
    y += Math.sin(rad(point.twd));
    speed += point.tws;
    count++;
  }
  if (!count) return null;
  return {
    twd: Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) % 360,
    tws: Math.round((speed / count) * 10) / 10,
  };
}

function twaSigned(twd: number, course: number): number {
  return ((twd - course + 540) % 360) - 180;
}
