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
  /** Strongest wind, knots. @default undefined */
  maxTws?: number;
  /** Strongest gusts, knots. @default undefined */
  maxGust?: number;
  /** Highest waves, metres. @default undefined */
  maxWaveM?: number;
  /** Highest convective energy, J/kg (storm risk). @default undefined */
  maxCape?: number;
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
  /**
   * « Départ imminent »: routed from now, again every few minutes.
   * @default undefined
   */
  live?: boolean;
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
 * Over a routing leaving now: the wind measured (LiveMétéo stations) and
 * the storms detected shown too.
 */
export const routingOverlay = signal(false);

/**
 * The label of the routing is shown: its ✕ hides it, a touch on the ETD or
 * the ETA shows it again.
 */
export const routingLabelShown = signal(true);

/** The forecast rain shown over the routing (the hour of the boat). */
export const routingRain = signal(false);

/**
 * The routing played: a blue boat runs along it, sped up, with the wind and
 * the sea where it is; `null` when not played.
 */
export const routingPlay = signal<{ ms: number; playing: boolean } | null>(
  null,
);

/** Played this much faster than real time: one hour in four seconds. */
export const PLAY_SPEED = 900;

/**
 * Where the boat of the routing is at a time, with the wind and the sea
 * there (those of the last place passed).
 * @param shown - The routing.
 * @param ms - The time.
 * @returns The place and its weather, `null` without marks.
 */
export function markAt(shown: ShownRouting, ms: number): RoutingMark | null {
  const { marks, track, arriveMs } = shown;
  const first = marks[0];
  if (!first) return null;
  if (ms <= first.ms) return first;
  const end = track.at(-1);
  for (let rank = 0; rank < marks.length; rank++) {
    const from = marks[rank] as RoutingMark;
    const next = marks[rank + 1];
    const to =
      next ??
      (end && arriveMs !== undefined
        ? { lat: end[0], lon: end[1], ms: arriveMs }
        : null);
    if (!to) return from;
    if (ms < to.ms || !next) {
      const share = Math.max(
        0,
        Math.min(1, (ms - from.ms) / Math.max(1, to.ms - from.ms)),
      );
      return {
        ...from,
        lat: from.lat + (to.lat - from.lat) * share,
        lon: from.lon + (to.lon - from.lon) * share,
        ms,
      };
    }
  }
  return first;
}

/**
 * The highest of some values, rounded; undefined when none is known.
 * @param values - The values (NaN or undefined unknown).
 * @param tenths - Rounded to tenths rather than units.
 * @returns The highest.
 */
export function highest(
  values: ReadonlyArray<number | undefined>,
  tenths = true,
): number | undefined {
  let top = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value !== undefined && Number.isFinite(value) && value > top) {
      top = value;
    }
  }
  if (top === Number.NEGATIVE_INFINITY) return undefined;
  return tenths ? Math.round(top * 10) / 10 : Math.round(top);
}

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
  const { steps, nm, arriveMs } = result;
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
    stats: stepStats(result),
  };
}

/**
 * The figures of a routing: length, sail and motor, manoeuvres, and the
 * strongest wind and gusts, the highest waves and storm energy met.
 * @param result - The routing.
 * @returns The figures.
 */
export function stepStats(
  result: Extract<RoutingResult, { kind: 'done' }>,
): RoutingStats {
  const { steps, nm, sailMin, motorMin, tacks, gybes } = result;
  const stats: RoutingStats = { nm, sailMin, motorMin, tacks, gybes };
  const maxTws = highest(steps.map((step) => step.tws));
  const maxGust = highest(steps.map((step) => step.gust));
  const maxWaveM = highest(steps.map((step) => step.waveM));
  const maxCape = highest(
    steps.map((step) => step.cape),
    false,
  );
  if (maxTws !== undefined) stats.maxTws = maxTws;
  if (maxGust !== undefined) stats.maxGust = maxGust;
  if (maxWaveM !== undefined) stats.maxWaveM = maxWaveM;
  if (maxCape !== undefined) stats.maxCape = maxCape;
  return stats;
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
   * The route it follows, number and name, without date or hour.
   * @default undefined
   */
  route?: string;
  /**
   * Last changed, ISO: on the other devices, the newest change wins.
   * @default undefined
   */
  mod?: string;
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

function keepList(list: SavedRouting[]): void {
  savedRoutings.value = list;
  store.set(SAVED_KEY, list);
}

function changed(item: SavedRouting): SavedRouting {
  return { ...item, mod: new Date().toISOString() };
}

/**
 * Keep a routing in « Routages » (the same id replaces it).
 * @param routing - The routing.
 */
export function saveRouting(routing: SavedRouting): void {
  const known = savedRoutings.peek().find((item) => item.id === routing.id);
  const voyage = known ? known.voyage : activeVoyageId();
  keepList([
    changed(voyage ? { ...routing, voyage } : routing),
    ...savedRoutings.peek().filter((item) => item.id !== routing.id),
  ]);
}

/**
 * Remove a routing from « Routages ».
 * @param id - Its id.
 */
export function removeRouting(id: string): void {
  keepList(savedRoutings.peek().filter((item) => item.id !== id));
}

/**
 * Rename a routing of « Routages ».
 * @param id - Its id.
 * @param name - Its new name.
 */
export function renameRouting(id: string, name: string): void {
  keepList(
    savedRoutings
      .peek()
      .map((item) =>
        item.id === id
          ? changed({ ...item, shown: { ...item.shown, name: name.trim() } })
          : item,
      ),
  );
}

/**
 * Put a routing into a cruise of data › Croisières, or take it out.
 * @param id - Routing id.
 * @param voyage - Cruise id, or undefined.
 */
export function setRoutingVoyage(id: string, voyage: string | undefined): void {
  keepList(
    savedRoutings.peek().map((item) => {
      if (item.id !== id) return item;
      const { voyage: _old, ...rest } = item;
      return changed(voyage ? { ...rest, voyage } : rest);
    }),
  );
}

function changedAt(item: SavedRouting): string {
  return item.mod ?? item.at;
}

/**
 * Take the routings of a backup or of another device (synchronisation): a
 * new one is added, a known one is replaced when changed later there.
 * @param list - The routings received (untrusted).
 */
export function mergeRoutings(list: unknown): void {
  if (!Array.isArray(list)) return;
  const received = list.filter(isSaved);
  if (received.length === 0) return;
  const here = [...savedRoutings.peek()];
  let touched = false;
  for (const routing of received) {
    const at = here.findIndex((item) => item.id === routing.id);
    const old = here[at];
    if (!old) {
      here.push(routing);
      touched = true;
    } else if (changedAt(routing) > changedAt(old)) {
      here[at] = routing;
      touched = true;
    }
  }
  if (!touched) return;
  // Newest first, as kept here.
  keepList(here.toSorted((one, two) => (two.at > one.at ? 1 : -1)));
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

const PREFS_KEY = 'ldb.routingShift';

/** How the arrows of a routing move it (Paramétrages › Routages). */
export interface ShiftPrefs {
  /** Minutes the ETD moves at each touch. */
  stepMin: number;
  /** The routings sorted by efficiency: the next hours looked at. */
  rankHours: number;
}

/** By default: 30 minutes, the 6 next hours. */
export const DEFAULT_SHIFT: ShiftPrefs = { stepMin: 30, rankHours: 6 };

/** The steps offered, minutes. */
export const SHIFT_STEPS: readonly number[] = [10, 15, 30, 60, 120];

/** The spans of the sort by efficiency offered, hours. */
export const RANK_SPANS: readonly number[] = [6, 12, 24];

/** How the arrows move a routing, as set. */
export const shiftPrefs = signal<ShiftPrefs>(readShiftPrefs());

function readShiftPrefs(): ShiftPrefs {
  const kept = store.get<Partial<ShiftPrefs> | null>(PREFS_KEY, null);
  return {
    stepMin:
      typeof kept?.stepMin === 'number' && SHIFT_STEPS.includes(kept.stepMin)
        ? kept.stepMin
        : DEFAULT_SHIFT.stepMin,
    rankHours:
      typeof kept?.rankHours === 'number' && RANK_SPANS.includes(kept.rankHours)
        ? kept.rankHours
        : DEFAULT_SHIFT.rankHours,
  };
}

/**
 * Keep how the arrows move a routing.
 * @param prefs - The step and the span of the sort.
 */
export function saveShiftPrefs(prefs: ShiftPrefs): void {
  shiftPrefs.value = prefs;
  store.set(PREFS_KEY, prefs);
}
