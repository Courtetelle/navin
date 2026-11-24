import { signal } from '@preact/signals-react';

import type { LatLon } from '../../lib/geo.ts';
import { distNM, rad } from '../../lib/geo.ts';
import type { RoutePoint } from '../../model/routes.ts';
import type { RoutingResult } from '../../model/sailRouting.ts';
import { routingTurns } from '../../model/sailRouting.ts';
import { activeVoyageId } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

export const ROUTING_KEY = 'ldb.routingShown';

/** The wind, the current and the waves at one place of the routing. */
export interface RoutingMark {
  lat: number;
  lon: number;
  ms: number;
  /** Where the wind comes from, degrees, and its speed, knots. */
  twd: number;
  tws: number;
  /** Where the current flows to, degrees, and its speed, knots. */
  setDeg: number;
  driftKn: number;
  /** Wave height, metres (`null` unknown). */
  waveM: number | null;
  /** Where the waves come from, degrees, and their period, seconds (`null` unknown). @default undefined */
  waveFrom?: number | null;
  wavePeriod?: number | null;
  /** Estimated speed of the boat through the water and over the ground, knots. @default undefined */
  kn?: number;
  sog?: number;
  /** Under sail or under motor. @default undefined */
  mode?: 'sail' | 'motor';
  /** Angle to the true wind and side. @default undefined */
  twa?: number;
  side?: 'tribord' | 'bâbord';
  /** Angle to the apparent wind (0 to 180°) and its speed, knots. @default undefined */
  awa?: number;
  aws?: number;
}

/** The figures of a routing. */
export interface RoutingStats {
  nm: number;
  sailMin: number;
  motorMin: number;
  tacks: number;
  gybes: number;
}

/** What a routing was asked with, to route it again at another ETD. */
export interface RoutingPlan {
  routeId: string;
  boatId: string;
  motorBelow: number;
  motorKn: number;
  /** The motor helps the sails. @default undefined */
  motorAssist?: boolean;
  model: string;
  /** The first routing: its ETD, ETA and figures. */
  base: { departMs: number; arriveMs: number; stats: RoutingStats };
}

/** A routing shown on the map. */
export interface ShownRouting {
  /** Id in « Routages » once kept. @default undefined */
  id?: string;
  name: string;
  /** ETD and ETA, epoch ms. @default undefined */
  departMs?: number;
  arriveMs?: number;
  /** Figures of the routing, to show what an hour earlier or later changes. @default undefined */
  stats?: RoutingStats;
  /** How to route it again at another hour. @default undefined */
  plan?: RoutingPlan;
  /** The way the boat goes, `[lat, lon]`. */
  track: Array<[number, number]>;
  /** The turns of the routing: the Go to goes from one to the next. */
  turns: RoutePoint[];
  marks: RoutingMark[];
}

function kept(): ShownRouting | null {
  const value = store.get<ShownRouting | null>(ROUTING_KEY, null);
  return value && Array.isArray(value.track) && Array.isArray(value.turns)
    ? value
    : null;
}

/** The routing on the map, `null` without. */
export const shownRouting = signal<ShownRouting | null>(kept());

/**
 * At most this many places with the wind, the current and the waves: the
 * map shows as many as fit at its zoom.
 */
const MOST_MARKS = 80;
/** Places at least this far apart, nautical miles. */
const LEAST_SPACING_NM = 0.2;

/**
 * The routing as shown on the map: its way, its turns, and the wind, current
 * and waves at places evenly spaced along it.
 * @param name - Its name.
 * @param result - The routing.
 * @param points - The points of the route.
 * @returns What the map shows.
 */
export function routingShape(
  name: string,
  result: Extract<RoutingResult, { kind: 'done' }>,
  points: readonly RoutePoint[],
): ShownRouting {
  const { steps, nm, arriveMs, sailMin, motorMin, tacks, gybes } = result;
  const track: Array<[number, number]> = steps.map((step) => [
    step.lat,
    step.lon,
  ]);
  const end = points.at(-1);
  if (end) track.push([end.lat, end.lon]);
  const spacing = Math.max(LEAST_SPACING_NM, nm / MOST_MARKS);
  const marks: RoutingMark[] = [];
  let along = 0;
  let next = 0;
  for (const [rank, step] of steps.entries()) {
    const before = steps[rank - 1];
    if (before) along += distNM(before, step);
    if (along + 1e-9 < next) continue;
    marks.push({
      lat: step.lat,
      lon: step.lon,
      ms: step.ms,
      twd: step.twd,
      tws: step.tws,
      setDeg: step.setDeg,
      driftKn: step.driftKn,
      waveM: Number.isFinite(step.waveM) ? step.waveM : null,
      waveFrom: Number.isFinite(step.waveFrom) ? step.waveFrom : null,
      wavePeriod: Number.isFinite(step.wavePeriod) ? step.wavePeriod : null,
      kn: step.kn,
      sog: step.sog,
      mode: step.mode,
      twa: step.twa,
      side: step.side,
      awa: step.awa,
      aws: step.aws,
    });
    next = along + spacing;
  }
  return {
    name,
    track,
    turns: routingTurns(result, points),
    marks,
    departMs: steps[0]?.ms ?? arriveMs,
    arriveMs,
    stats: {
      nm,
      sailMin,
      motorMin,
      tacks,
      gybes,
    },
  };
}

const SAVED_KEY = 'ldb.routings';

/** A routing kept in « Routages », as the routes in « Routes ». */
export interface SavedRouting {
  id: string;
  /** Kept at, ISO. */
  at: string;
  departMs: number;
  arriveMs: number;
  nm: number;
  /** The summary line: time, sail, motor, tacks. */
  summary: string;
  /** Weather model. */
  model: string;
  shown: ShownRouting;
  /**
   * The cruise of data › Croisières it belongs to (active when kept).
   * @default undefined
   */
  voyage?: string;
}

function isSaved(value: unknown): value is SavedRouting {
  const item = value as Partial<SavedRouting> | null;
  return (
    typeof item?.id === 'string' &&
    typeof item.departMs === 'number' &&
    Array.isArray(item.shown?.track)
  );
}

/** The routings kept, newest first. */
export const savedRoutings = signal<SavedRouting[]>(
  store.get<unknown[]>(SAVED_KEY, []).filter(isSaved),
);

/**
 * Keep a routing in « Routages » (the same id replaces it).
 * @param routing - The routing.
 */
export function saveRouting(routing: SavedRouting): void {
  const known = savedRoutings.peek().find((item) => item.id === routing.id);
  const voyage = known ? known.voyage : activeVoyageId();
  const list = [
    voyage ? { ...routing, voyage } : routing,
    ...savedRoutings.peek().filter((item) => item.id !== routing.id),
  ];
  savedRoutings.value = list;
  store.set(SAVED_KEY, list);
}

/**
 * Remove a routing from « Routages ».
 * @param id - Its id.
 */
export function removeRouting(id: string): void {
  const list = savedRoutings.peek().filter((item) => item.id !== id);
  savedRoutings.value = list;
  store.set(SAVED_KEY, list);
}

/**
 * Rename a routing of « Routages ».
 * @param id - Its id.
 * @param name - Its new name.
 */
export function renameRouting(id: string, name: string): void {
  const list = savedRoutings
    .peek()
    .map((item) =>
      item.id === id
        ? { ...item, shown: { ...item.shown, name: name.trim() } }
        : item,
    );
  savedRoutings.value = list;
  store.set(SAVED_KEY, list);
}

/**
 * Put a routing into a cruise of data › Croisières, or take it out.
 * @param id - Routing id.
 * @param voyage - Cruise id, or undefined.
 */
export function setRoutingVoyage(id: string, voyage: string | undefined): void {
  const list = savedRoutings.peek().map((item) => {
    if (item.id !== id) return item;
    const { voyage: _old, ...rest } = item;
    return voyage ? { ...rest, voyage } : rest;
  });
  savedRoutings.value = list;
  store.set(SAVED_KEY, list);
}

/** A turn is reached this close, nautical miles. */
const TURN_REACHED_NM = 0.05;

/**
 * The turn to go to: the end of the leg the boat is nearest to, the next
 * one once it is reached; never back.
 * @param turns - The turns of the routing.
 * @param here - The boat.
 * @param from - The turn aimed at so far.
 * @returns Rank of the turn to go to (1 at least).
 */
export function routingLeg(
  turns: readonly LatLon[],
  here: LatLon,
  from = 1,
): number {
  const last = turns.length - 1;
  if (last < 1) return 0;
  let leg = 1;
  let best = Infinity;
  for (let rank = 1; rank <= last; rank++) {
    const away = legDistance(
      turns[rank - 1] as LatLon,
      turns[rank] as LatLon,
      here,
    );
    if (away < best - 1e-9) {
      best = away;
      leg = rank;
    }
  }
  let aim = Math.max(from, leg);
  while (aim < last && distNM(here, turns[aim] as LatLon) < TURN_REACHED_NM) {
    aim++;
  }
  return Math.min(aim, last);
}

/** Distance from a place to a leg, nautical miles (flat over a leg). */
function legDistance(a: LatLon, b: LatLon, here: LatLon): number {
  const cos = Math.cos(rad((a.lat + b.lat) / 2));
  const bx = (b.lon - a.lon) * cos;
  const by = b.lat - a.lat;
  const hx = (here.lon - a.lon) * cos;
  const hy = here.lat - a.lat;
  const length = bx * bx + by * by;
  const share =
    length > 0 ? Math.max(0, Math.min(1, (hx * bx + hy * by) / length)) : 0;
  return Math.hypot(hx - share * bx, hy - share * by) * 60;
}

/**
 * The Go to of a turn of the routing.
 * @param shown - The routing.
 * @param leg - Rank of the turn.
 * @returns The target.
 */
export function legTarget(
  shown: ShownRouting,
  leg: number,
): { lat: number; lon: number; name: string; leg: number } {
  const turn = shown.turns[leg] as RoutePoint;
  const last = shown.turns.length - 1;
  return {
    lat: turn.lat,
    lon: turn.lon,
    name: `${shown.name} · ${leg === last ? 'arrivée' : `segment ${leg}/${last}`}`,
    leg,
  };
}
