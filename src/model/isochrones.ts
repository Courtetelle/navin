/**
 * Routing of a sailing boat by isochrones, leg by leg along the points of
 * a route: every step, from each place reached, the boat may steer any
 * course but backward; its speed comes from its polar in the wind of that
 * place and hour, slowed by the waves, and the current carries it. The
 * farthest place of each sector around the start makes the next isochrone;
 * the first place from which the point is reached gives the way, traced
 * back. When the sails make too little toward the point the motor takes
 * over (or helps the sails), and a step that would cross the land is left
 * out.
 */

import type { LatLon } from '../lib/geo.ts';

import type { RoutePoint } from './routes.ts';
import type {
  RoutingAsk,
  RoutingLeg,
  RoutingResult,
  RoutingStep,
  SailSpeed,
  Sea,
  Wind,
} from './sailRouting.ts';
import {
  apparentWind,
  crabInto,
  groundOf,
  motorWaveShare,
  waveShare,
  windSide,
} from './sailRouting.ts';

/** A tack or a gybe costs this much time, minutes. */
const MANOEUVRE_MIN = 1;
/** Within this distance of a point the boat is there, NM. */
const THERE_NM = 0.15;
/** At most this many days of routing. */
const MOST_DAYS = 14;
/** The courses tried from each place, degrees apart. */
const COURSE_STEP = 5;
/** The courses tried, at most this far either side of the point, degrees. */
const COURSE_SPAN = 132;
/** Under motor, the courses tried either side of the point, degrees. */
const MOTOR_SPAN = 40;
/** The isochrone keeps one place per sector of this many degrees. */
const SECTOR_DEG = 2.5;
/** Straight to the point is tried from this many steps away. */
const FINISH_STEPS = 3;
/** A leg is given up past its length at this speed and some hours, knots. */
const SLOWEST_KN = 1;
const GIVE_UP_H = 12;
/** Each sector keeps this many places, for when the farthest is on land. */
const KEEP = 3;
/** A place farther from the point than this share of the leg is dropped. */
const TOO_FAR = 1.6;

/** A sea with no waves known and no current. */
const FLAT: Sea = { waveM: Number.NaN, driftKn: 0, setDeg: 0 };

const RAD = Math.PI / 180;

function norm(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function foldTwa(twd: number, course: number): number {
  const angle = norm(twd - course);
  return angle > 180 ? 360 - angle : angle;
}

/**
 * A flat chart around the start of a leg, in NM east and north of it: fine
 * over the few tens of miles of a leg, and fast.
 */
interface Chart {
  lat0: number;
  lon0: number;
  /** NM per degree of longitude there. */
  lonNm: number;
}

function chartAt(start: LatLon): Chart {
  return {
    lat0: start.lat,
    lon0: start.lon,
    lonNm: 60 * Math.cos(start.lat * RAD),
  };
}

function onChart(chart: Chart, at: LatLon): { x: number; y: number } {
  return {
    x: (at.lon - chart.lon0) * chart.lonNm,
    y: (at.lat - chart.lat0) * 60,
  };
}

function offChart(chart: Chart, x: number, y: number): LatLon {
  return { lat: chart.lat0 + y / 60, lon: chart.lon0 + x / chart.lonNm };
}

/** Bearing from one place of the chart to another, degrees. */
function course(dx: number, dy: number): number {
  return norm(Math.atan2(dx, dy) / RAD);
}

/** What the boat does over a step. */
interface Doing {
  course: number;
  kn: number;
  sails: string;
  motor: boolean;
  cog: number;
  sog: number;
}

/** What it met over the step. */
interface Met {
  ms: number;
  wind: Wind;
  sea: Sea;
}

/** A place of an isochrone, and how the boat got there. */
interface Node {
  x: number;
  y: number;
  lat: number;
  lon: number;
  /** What the boat did to come here from the place before. */
  doing: Doing | null;
  met: Met | null;
  parent: Node | null;
  motorMin: number;
  sailMin: number;
  nm: number;
}

/** The speed through the water at a course, under sail or under motor. */
function speedAt(
  ask: RoutingAsk,
  wind: Wind,
  sea: Sea,
  heading: number,
  motor: boolean,
): { kn: number; sails: string } {
  const twa = foldTwa(wind.twd, heading);
  const sail = sailMemo(ask, Math.round(twa), wind.tws);
  const kn = sail.kn * waveShare(sea.waveM, twa);
  if (!motor) return { kn, sails: sail.sails };
  const motorKn = ask.motorKn * motorWaveShare(sea.waveM);
  if (ask.motorAssist) {
    return { kn: Math.max(kn, motorKn), sails: 'Voiles + moteur' };
  }
  return { kn: motorKn, sails: 'Moteur' };
}

/** The speeds under sail already asked, by routing: the angle and the wind rounded. */
const sailMemos = new WeakMap<RoutingAsk, Map<number, SailSpeed>>();

function sailMemo(ask: RoutingAsk, twa: number, tws: number): SailSpeed {
  let memo = sailMemos.get(ask);
  if (!memo) {
    memo = new Map();
    sailMemos.set(ask, memo);
  }
  const key = Math.round(tws * 4) * 1000 + twa;
  let speed = memo.get(key);
  if (!speed) {
    speed = ask.sailSpeed(twa, Math.round(tws * 4) / 4);
    memo.set(key, speed);
  }
  return speed;
}

/**
 * The motor takes over when the sails make too little on the course that
 * gains the most toward the point (as the routing point to point).
 */
function motorHere(
  ask: RoutingAsk,
  wind: Wind,
  sea: Sea,
  toTarget: number,
): boolean {
  let best = { gain: Number.NEGATIVE_INFINITY, kn: 0 };
  for (let off = -180; off < 180; off += COURSE_STEP) {
    const { kn } = speedAt(ask, wind, sea, toTarget + off, false);
    const gain = kn * Math.cos(off * RAD);
    if (gain > best.gain) best = { gain, kn };
  }
  return best.kn < ask.motorBelow;
}

/** The boat changes side under sail: a tack or a gybe. */
function turned(before: Node, doing: Doing, wind: Wind): boolean {
  const was = before.doing;
  if (!was || was.motor || doing.motor || !before.met) return false;
  return (
    windSide(was.course, before.met.wind.twd) !==
    windSide(doing.course, wind.twd)
  );
}

function stepOf(node: Node, to: number): RoutingStep | null {
  const { doing, met, parent } = node;
  if (!doing || !met || !parent) return null;
  const { wind, sea, ms } = met;
  const twa = foldTwa(wind.twd, doing.course);
  return {
    ms,
    lat: parent.lat,
    lon: parent.lon,
    mode: doing.motor ? 'motor' : 'sail',
    course: Math.round(norm(doing.course)),
    kn: Math.round(doing.kn * 10) / 10,
    twd: Math.round(wind.twd),
    tws: Math.round(wind.tws * 10) / 10,
    twa: Math.round(twa),
    side: windSide(doing.course, wind.twd),
    sails: doing.sails,
    toPoint: to,
    sog: Math.round(doing.sog * 10) / 10,
    cog: Math.round(norm(doing.cog)),
    driftKn: Math.round(sea.driftKn * 10) / 10,
    setDeg: Math.round(sea.setDeg),
    waveM: Math.round(sea.waveM * 10) / 10,
    waveFrom: Math.round(sea.waveFrom ?? Number.NaN),
    wavePeriod: Math.round((sea.wavePeriod ?? Number.NaN) * 10) / 10,
    ...apparentWind(twa, wind.tws, doing.kn),
    ...(wind.gust === undefined
      ? {}
      : { gust: Math.round(wind.gust * 10) / 10 }),
    ...(wind.cape === undefined ? {} : { cape: Math.round(wind.cape) }),
  };
}

function childOf(
  chart: Chart,
  node: Node,
  doing: Doing,
  met: Met,
  runMin: number,
  x: number,
  y: number,
): Node {
  const nm = Math.hypot(x - node.x, y - node.y);
  const place = offChart(chart, x, y);
  return {
    x,
    y,
    lat: place.lat,
    lon: place.lon,
    doing,
    met,
    parent: node,
    motorMin: node.motorMin + (doing.motor ? runMin : 0),
    sailMin: node.sailMin + (doing.motor ? 0 : runMin),
    nm: node.nm + nm,
  };
}

type LegResult =
  | { kind: 'done'; steps: RoutingStep[]; leg: RoutingLeg }
  | { kind: 'no-wind'; ms: number; lat: number; lon: number }
  | { kind: 'too-long' };

/** The leg traced back from the place of arrival. */
function legDone(end: Node, to: number, arriveMs: number): LegResult {
  const steps: RoutingStep[] = [];
  for (let at: Node | null = end; at; at = at.parent) {
    const step = stepOf(at, to);
    if (step) steps.push(step);
  }
  steps.reverse();
  let tacks = 0;
  let gybes = 0;
  for (let rank = 1; rank < steps.length; rank++) {
    const before = steps[rank - 1] as RoutingStep;
    const step = steps[rank] as RoutingStep;
    if (
      before.mode === 'sail' &&
      step.mode === 'sail' &&
      before.side !== step.side
    ) {
      if (step.twa < 90) tacks++;
      else gybes++;
    }
  }
  return {
    kind: 'done',
    steps,
    leg: {
      from: to - 1,
      to,
      arriveMs,
      sailMin: Math.round(end.sailMin),
      motorMin: Math.round(end.motorMin),
      tacks,
      gybes,
      nm: Math.round(end.nm * 10) / 10,
    },
  };
}

/** A way out of a place over one step, kept for its sector. */
interface Candidate {
  node: Node;
  doing: Doing;
  met: Met;
  x: number;
  y: number;
  away: number;
}

/** One leg by isochrones, from a place at a time to a point. */
function routeLeg(
  ask: RoutingAsk,
  start: LatLon,
  startMs: number,
  to: number,
  target: LatLon,
  endMs: number,
): LegResult {
  const stepMin = ask.stepMin ?? 10;
  const chart = chartAt(start);
  const goal = onChart(chart, target);
  const legNm = Math.hypot(goal.x, goal.y);
  const first: Node = {
    x: 0,
    y: 0,
    lat: start.lat,
    lon: start.lon,
    doing: null,
    met: null,
    parent: null,
    motorMin: 0,
    sailMin: 0,
    nm: 0,
  };
  if (legNm <= THERE_NM) return legDone(first, to, startMs);
  let front: Node[] = [first];
  let ms = startMs;
  let closest: Node = first;
  // A leg not reached by then is left to the routing point to point.
  const lastMs = Math.min(
    endMs,
    startMs + (legNm / SLOWEST_KN + GIVE_UP_H) * 3_600_000,
  );
  // The earliest arrival found yet, straight from a place of an isochrone.
  let best: { end: Node; arriveMs: number } | null = null;
  while (ms <= lastMs) {
    if (best && best.arriveMs <= ms) {
      return legDone(best.end, to, Math.round(best.arriveMs));
    }
    const sectors = new Map<number, Candidate[]>();
    let windKnown = false;
    for (const node of front) {
      const wind = ask.windAt(node.lat, node.lon, ms);
      if (!wind) continue;
      windKnown = true;
      const sea = ask.seaAt?.(node.lat, node.lon, ms) ?? FLAT;
      const met: Met = { ms, wind, sea };
      const dx = goal.x - node.x;
      const dy = goal.y - node.y;
      const left = Math.hypot(dx, dy);
      const toTarget = course(dx, dy);
      const motor = motorHere(ask, wind, sea, toTarget);
      // Straight to the point, up into the current, from a few steps away.
      let speed = speedAt(ask, wind, sea, toTarget, motor);
      let crab = crabInto(toTarget, speed.kn, sea);
      speed = speedAt(ask, wind, sea, crab.steer, motor);
      crab = crabInto(toTarget, speed.kn, sea);
      const straight: Doing = {
        course: crab.steer,
        kn: speed.kn,
        sails: speed.sails,
        motor,
        cog: toTarget,
        sog: crab.sog,
      };
      const finishMin =
        (left / crab.sog) * 60 +
        (turned(node, straight, wind) ? MANOEUVRE_MIN : 0);
      if (
        finishMin <= FINISH_STEPS * stepMin &&
        (motor || foldTwa(wind.twd, crab.steer) >= 30) &&
        (!best || ms + finishMin * 60_000 < best.arriveMs) &&
        (!ask.navigable || ask.navigable(node, target))
      ) {
        best = {
          end: childOf(chart, node, straight, met, finishMin, goal.x, goal.y),
          arriveMs: ms + finishMin * 60_000,
        };
      }
      const widest = motor ? MOTOR_SPAN : COURSE_SPAN;
      // The side of the wind before: changing it costs a tack or a gybe.
      const wasSide =
        node.doing && !node.doing.motor && node.met
          ? windSide(node.doing.course, node.met.wind.twd)
          : null;
      for (let off = -widest; off <= widest; off += COURSE_STEP) {
        const heading = norm(toTarget + off);
        const { kn, sails } = speedAt(ask, wind, sea, heading, motor);
        const ground = groundOf(heading, kn, sea);
        const runMin =
          stepMin -
          (!motor && wasSide !== null && wasSide !== windSide(heading, wind.twd)
            ? MANOEUVRE_MIN
            : 0);
        const nm = (ground.sog * runMin) / 60;
        const x = node.x + nm * Math.sin(ground.cog * RAD);
        const y = node.y + nm * Math.cos(ground.cog * RAD);
        if (Math.hypot(goal.x - x, goal.y - y) > legNm * TOO_FAR + 1) {
          continue;
        }
        // Farthest from the start, but not past the point.
        const fromStart = Math.hypot(x, y);
        const away = fromStart <= legNm ? fromStart : 2 * legNm - fromStart;
        const sector = Math.round(course(x, y) / SECTOR_DEG);
        const list = sectors.get(sector);
        if (
          list &&
          list.length >= KEEP &&
          (list.at(-1) as Candidate).away >= away
        ) {
          continue;
        }
        const doing: Doing = {
          course: heading,
          kn,
          sails,
          motor,
          cog: ground.cog,
          sog: ground.sog,
        };
        if (!list) {
          sectors.set(sector, [{ node, doing, met, x, y, away }]);
          continue;
        }
        // The few farthest of the sector, farthest first.
        let rank = list.length;
        while (rank > 0 && (list[rank - 1] as Candidate).away < away) rank--;
        list.splice(rank, 0, { node, doing, met, x, y, away });
        if (list.length > KEEP) list.pop();
      }
    }
    if (!windKnown) {
      if (best) return legDone(best.end, to, Math.round(best.arriveMs));
      return { kind: 'no-wind', ms, lat: closest.lat, lon: closest.lon };
    }
    const next: Node[] = [];
    for (const list of sectors.values()) {
      // The farthest of the sector that stays in the water.
      for (const { node, doing, met, x, y } of list) {
        const child = childOf(chart, node, doing, met, stepMin, x, y);
        if (!ask.navigable || ask.navigable(node, child)) {
          next.push(child);
          break;
        }
      }
    }
    if (next.length === 0) next.push(motorOut(ask, chart, closest, goal, ms));
    front = next;
    closest = closestTo(front, goal);
    ms += stepMin * 60_000;
  }
  if (best) return legDone(best.end, to, Math.round(best.arriveMs));
  return { kind: 'too-long' };
}

/** The place of an isochrone the closest to the point. */
function closestTo(
  front: readonly Node[],
  goal: { x: number; y: number },
): Node {
  let closest = front[0] as Node;
  let nearest = Number.POSITIVE_INFINITY;
  for (const node of front) {
    const left = Math.hypot(goal.x - node.x, goal.y - node.y);
    if (left < nearest) {
      nearest = left;
      closest = node;
    }
  }
  return closest;
}

/**
 * Hemmed in by the land (a harbour within the margin to the shore): the
 * motor toward the point for one step, from the place the closest to it.
 */
function motorOut(
  ask: RoutingAsk,
  chart: Chart,
  node: Node,
  goal: { x: number; y: number },
  ms: number,
): Node {
  const stepMin = ask.stepMin ?? 10;
  const wind = ask.windAt(node.lat, node.lon, ms) ?? { twd: 0, tws: 0 };
  const sea = ask.seaAt?.(node.lat, node.lon, ms) ?? FLAT;
  const dx = goal.x - node.x;
  const dy = goal.y - node.y;
  const toTarget = course(dx, dy);
  const kn = ask.motorKn * motorWaveShare(sea.waveM);
  const crab = crabInto(toTarget, kn, sea);
  const nm = Math.min(Math.hypot(dx, dy), (crab.sog * stepMin) / 60);
  return childOf(
    chart,
    node,
    {
      course: crab.steer,
      kn,
      sails: 'Moteur',
      motor: true,
      cog: toTarget,
      sog: crab.sog,
    },
    { ms, wind, sea },
    stepMin,
    node.x + nm * Math.sin(toTarget * RAD),
    node.y + nm * Math.cos(toTarget * RAD),
  );
}

/**
 * Route the boat along the points of a route by isochrones, leg by leg.
 * @param ask - Points, departure, wind, polar, motor, sea, land.
 * @returns The routing.
 */
export function routeIsochrones(ask: RoutingAsk): RoutingResult {
  const endMs = ask.departMs + MOST_DAYS * 86_400_000;
  const steps: RoutingStep[] = [];
  const legs: RoutingLeg[] = [];
  let ms = ask.departMs;
  let here: LatLon = ask.points[0] ?? { lat: 0, lon: 0 };
  for (let to = 1; to < ask.points.length; to++) {
    const target = ask.points[to] as RoutePoint;
    const leg = routeLeg(ask, here, ms, to, target, endMs);
    if (leg.kind !== 'done') return leg;
    steps.push(...leg.steps);
    legs.push(leg.leg);
    ms = leg.leg.arriveMs;
    here = target;
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
