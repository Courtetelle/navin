import type { LatLon } from '../../lib/geo.ts';
import { bearing, distNM } from '../../lib/geo.ts';
import type { RealPolar, SailsNow } from '../../model/realPolar.ts';
import {
  addMinute,
  angleMean,
  sailsName,
  sailsSail,
} from '../../model/realPolar.ts';
import type { Wind } from '../../model/sailRouting.ts';
import type { Boat, Cruise } from '../../model/types.ts';
import type { TrackPoint } from '../../state/index.ts';
import { updateBoat } from '../../state/index.ts';
import { fetchPastWind, windAt } from '../map/routingWeather.ts';

import { DEFAULT_SAILS, realPolarsOf } from './polarRecorder.ts';

/** A real polar computed with the wind of a model is named with this. */
export const MODEL_WIND = 'vent modèle';

/** One steady minute of a trace. */
export interface TraceMinute {
  ms: number;
  lat: number;
  lon: number;
  /** Course over ground, degrees. */
  cog: number;
  /** Speed over ground, knots. */
  kn: number;
}

/** Points further apart than this break a minute. */
const HOLE_MS = 40_000;
/** At most this much change of course within a minute, degrees. */
const MOST_COURSE_SPREAD = 15;

/**
 * The steady minutes of a trace: a minute of points without a hole, its
 * course within 15°, its speed from its distance.
 * @param track - The points `[ms, lat, lon, …]`.
 * @returns The minutes.
 */
export function traceMinutes(track: readonly TrackPoint[]): TraceMinute[] {
  const minutes: TraceMinute[] = [];
  let window: TrackPoint[] = [];
  const flush = (points: TrackPoint[]) => {
    const courses: number[] = [];
    for (let rank = 1; rank < points.length; rank++) {
      const a = points[rank - 1] as TrackPoint;
      const b = points[rank] as TrackPoint;
      if (distNM(spot(a), spot(b)) > 0.002) {
        courses.push(bearing(spot(a), spot(b)));
      }
    }
    const first = points[0] as TrackPoint;
    const last = points.at(-1) as TrackPoint;
    const hours = (last[0] - first[0]) / 3_600_000;
    const nm = distNM(spot(first), spot(last));
    if (courses.length < 2 || hours <= 0) return;
    const { spread } = angleMean(courses);
    if (spread > MOST_COURSE_SPREAD) return;
    const kn = nm / hours;
    if (kn < 0.8 || kn > 30) return;
    minutes.push({
      ms: (first[0] + last[0]) / 2,
      lat: (first[1] + last[1]) / 2,
      lon: (first[2] + last[2]) / 2,
      cog: bearing(spot(first), spot(last)),
      kn,
    });
  };
  for (const point of track) {
    const previous = window.at(-1);
    // A hole: the minute begun is dropped.
    if (previous && point[0] - previous[0] > HOLE_MS) window = [];
    window.push(point);
    const head = window[0] as TrackPoint;
    if (point[0] - head[0] >= 60_000) {
      const points = window;
      window = [point];
      flush(points);
    }
  }
  return minutes;
}

function spot(point: TrackPoint): LatLon {
  return { lat: point[1], lon: point[2] };
}

/**
 * The sails up at a time: the last ones noted in the logbook before it.
 * @param cruise - The outing or cruise of the trace.
 * @param ms - The time.
 * @returns The sails.
 */
export function sailsAt(
  cruise: Cruise | null | undefined,
  ms: number,
): SailsNow {
  const sails = { ...DEFAULT_SAILS };
  const entries = (cruise?.entries ?? []).toSorted((a, b) =>
    a.t.localeCompare(b.t),
  );
  for (const entry of entries) {
    if (new Date(entry.t).getTime() > ms) break;
    if (entry.v.gv) sails.gv = entry.v.gv;
    if (entry.v.avant) sails.avant = entry.v.avant;
  }
  return sails;
}

/**
 * Count the steady minutes of a trace in the real polars of a boat, with the
 * wind of a model at their place and time.
 * @param list - The real polars of the boat.
 * @param minutes - The minutes of the trace.
 * @param wind - The wind at a place and time.
 * @param sails - The sails up at a time.
 * @returns The new list and the minutes counted.
 */
export function countTrace(
  list: readonly RealPolar[],
  minutes: readonly TraceMinute[],
  wind: (lat: number, lon: number, ms: number) => Wind | null,
  sails: (ms: number) => SailsNow,
): { list: RealPolar[]; counted: number } {
  const next = [...list];
  let counted = 0;
  for (const minute of minutes) {
    const up = sails(minute.ms);
    const blow = wind(minute.lat, minute.lon, minute.ms);
    if (!blow || !sailsSail(up)) continue;
    const name = `${sailsName(up)} · ${MODEL_WIND}`;
    const rank = next.findIndex((real) => real.sails === name);
    const before = next[rank];
    const after = addMinute(before, name, {
      twa: Math.abs(((minute.cog - blow.twd + 540) % 360) - 180),
      tws: blow.tws,
      kn: minute.kn,
      at: new Date(minute.ms).toISOString(),
    });
    if (after === before) continue;
    counted++;
    if (rank === -1) next.push(after);
    else next[rank] = after;
  }
  return { list: next, counted };
}

/**
 * Add a trace to the real polars of a boat, with the wind of the model at
 * the place and time of each steady minute.
 * @param boatId - The boat.
 * @param traceId - The trace id, kept in `boat.polarTraces` so that it is
 *   added once.
 * @param track - The trace.
 * @param cruise - Its outing or cruise (for the sails of the logbook).
 * @returns The minutes counted, or why none.
 */
export async function addTraceToPolar(
  boatId: string,
  traceId: string,
  track: readonly TrackPoint[],
  cruise: Cruise | null | undefined,
): Promise<{ counted: number } | { error: string }> {
  const minutes = traceMinutes(track);
  if (minutes.length === 0) {
    return { error: 'Aucune minute régulière dans cette trace.' };
  }
  const first = minutes[0] as TraceMinute;
  const last = minutes.at(-1) as TraceMinute;
  const wind = await fetchPastWind(
    minutes.filter((_, rank) => rank % 10 === 0),
    first.ms,
    last.ms,
  );
  if ('error' in wind) return wind;
  let counted = 0;
  updateBoat(boatId, (draft) => {
    const done = countTrace(
      realPolarsOf(draft),
      minutes,
      (lat, lon, ms) => windAt(wind, lat, lon, ms),
      (ms) => sailsAt(cruise, ms),
    );
    counted = done.counted;
    draft.realPolars = done.list;
    draft.polarTraces = [...new Set([...tracesInPolar(draft), traceId])];
  });
  return { counted };
}

/**
 * The traces already added to the real polars of a boat.
 * @param boat - The boat.
 * @returns Their ids.
 */
export function tracesInPolar(boat: Boat): string[] {
  const ids = boat.polarTraces;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string')
    : [];
}
