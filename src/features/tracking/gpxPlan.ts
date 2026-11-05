import type { Entry } from '../../model/types.ts';
import { state } from '../../state/index.ts';

import type { TrackEvent, TrackSample } from './detector.ts';
import { detectorPush, newDetector } from './detector.ts';
import type { TrackLeg } from './entrySelection.ts';
import { TICK_MIN, legsFromEvents, selectLeg } from './entrySelection.ts';
import type { ParsedTrack } from './gpxParse.ts';

/** What an import adds to a hand-written entry. */
export interface EntryFill {
  id: string;
  add: Record<string, unknown>;
}

/** Everything the import screen shows and applies. */
export interface ImportPlan {
  /** Title of the screen. */
  name: string;
  /** Points in time order. */
  points: TrackSample[];
  /** Time of the last point kept by the detector, ms. */
  lastTime: number;
  /** Total distance, NM. */
  distance: number;
  legs: TrackLeg[];
  /** Key points without an entry at the same minute. */
  fresh: TrackEvent[];
  /** Total navigation time, ms. */
  navigationMs: number;
  /** Hand-written entries completed from the track. */
  fills: EntryFill[];
}

const SPLIT_GAP_MS = 45 * 60_000;
const NEAR_POINT_MS = 3 * 60_000;

/**
 * Work out an import (first part of legacy `importGpxFile`): key points of the
 * track, entries to keep, entries noted during the navigation to complete.
 * @param parsed - Points (at least two, all dated) and name.
 * @param fileName - Title when the track has no name.
 * @returns The plan.
 */
export function planImport(parsed: ParsedTrack, fileName: string): ImportPlan {
  const points = parsed.pts.toSorted((first, second) => first.t - second.t);
  const { autoTurn } = state.preferences.settings.value;
  const detector = newDetector({
    turn: autoTurn,
    every: TICK_MIN,
    splitGap: SPLIT_GAP_MS,
  });
  const events: TrackEvent[] = [];
  for (const point of points) events.push(...detectorPush(detector, point));
  const lastPoint = detector.lastPt ?? (points.at(-1) as TrackSample);
  events.push({
    kind: 'Arrivée',
    t: lastPoint.t,
    lat: lastPoint.lat,
    lon: lastPoint.lon,
    cog: null,
    sog: 0,
    dist: detector.dist,
    twd: detector.lastTwd,
    tws: detector.lastTws,
  });
  const legs = legsFromEvents(events);
  const chosen = legs.flatMap((leg) => selectLeg(leg.dep, leg.mids, leg.arr));
  const entries = state.data.cruise.value?.entries ?? [];
  const known = new Set(entries.map((entry) => entry.t.slice(0, 16)));
  let navigationMs = 0;
  for (const leg of legs) navigationMs += leg.arr.t - leg.dep.t;
  return {
    name: parsed.name || fileName,
    points,
    lastTime: lastPoint.t,
    distance: detector.dist,
    legs,
    fresh: chosen.filter(
      (event) => !known.has(new Date(event.t).toISOString().slice(0, 16)),
    ),
    navigationMs,
    fills: entryFills(entries, points),
  };
}

/**
 * Track points to keep for the map: one every 10 s, first and last included.
 * @param points - Points in time order.
 * @returns The thinned points.
 */
export function thinPoints(points: readonly TrackSample[]): TrackSample[] {
  const kept: TrackSample[] = [];
  for (const [index, point] of points.entries()) {
    const before = points[index - 1];
    if (
      !before ||
      index === points.length - 1 ||
      Math.floor(point.t / 10_000) !== Math.floor(before.t / 10_000)
    ) {
      kept.push(point);
    }
  }
  return kept;
}

function entryFills(
  entries: readonly Entry[],
  points: readonly TrackSample[],
): EntryFill[] {
  const fills: EntryFill[] = [];
  for (const entry of entries) {
    if (entry.auto) continue;
    const point = nearPoint(points, Date.parse(entry.t));
    if (!point) continue;
    const add = fillOf(entry, point);
    if (Object.keys(add).length > 0) fills.push({ id: entry.id, add });
  }
  return fills;
}

function nearPoint(
  points: readonly TrackSample[],
  time: number,
): TrackSample | null {
  let low = 0;
  let high = points.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if ((points[middle]?.t ?? 0) < time) low = middle;
    else high = middle;
  }
  const before = points[low];
  const after = points[high];
  if (!before || !after) return null;
  const point =
    Math.abs(before.t - time) < Math.abs(after.t - time) ? before : after;
  return Math.abs(point.t - time) <= NEAR_POINT_MS ? point : null;
}

function fillOf(entry: Entry, point: TrackSample): Record<string, unknown> {
  const add: Record<string, unknown> = {};
  if (!entry.v.pos || entry.v.pos.text) {
    add.pos = { lat: point.lat, lon: point.lon };
  }
  if (entry.v.sog == null && point.sog != null) add.sog = point.sog;
  if (entry.v.cog == null && point.cog != null) add.cog = point.cog;
  if (entry.v.twd == null && point.twd != null) {
    add.twd = Math.round(point.twd) % 360;
  }
  if (entry.v.tws == null && point.tws != null) {
    add.tws = Math.round(point.tws);
  }
  return add;
}
