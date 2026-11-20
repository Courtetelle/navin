import { store } from '../storage/store.ts';

import type { TrackPoint } from './view.ts';

/** The texts given to traces with a long press, by trace id. */
const TRACE_NAMES_KEY = 'ldb.traceNames';

/**
 * The texts given to traces, by trace id (`cruise` or `cruise#rank`).
 * @returns The texts.
 */
export function traceNames(): Readonly<Record<string, string>> {
  return store.get<Record<string, string>>(TRACE_NAMES_KEY, {});
}

/**
 * Give a trace a text of one's own; an empty text gives back its name.
 * @param id - Trace id.
 * @param text - The new text.
 */
export function renameTrace(id: string, text: string): void {
  const names = Object.fromEntries(
    Object.entries(traceNames()).filter(([key]) => key !== id),
  );
  if (text.trim()) names[id] = text.trim();
  store.set(TRACE_NAMES_KEY, names);
}

/**
 * Texts of a backup added to those of the device, which win.
 * @param received - The texts of the backup.
 */
export function mergeTraceNames(received: unknown): void {
  if (!received || typeof received !== 'object') return;
  const names: Record<string, string> = {};
  for (const [id, text] of Object.entries(received)) {
    if (typeof text === 'string' && text) names[id] = text;
  }
  store.set(TRACE_NAMES_KEY, { ...names, ...traceNames() });
}

/**
 * Where the recording of a cruise is cut into several traces, as the times
 * of their first points (they stay right when tracks are merged).
 * @param cruiseId - Cruise id.
 * @returns The times, empty for a single trace.
 */
export function traceCutTimes(cruiseId: string): number[] {
  const track = store.get<TrackPoint[]>(`ldb.track.${cruiseId}`, []);
  return store
    .get<number[]>(`ldb.trkSegs.${cruiseId}`, [])
    .filter((start) => start > 0 && start < track.length)
    .map((start) => (track[start] as TrackPoint)[0]);
}

/**
 * Cut the recording of a cruise again where a backup cut it, unless the
 * device has cuts of its own.
 * @param cruiseId - Cruise id.
 * @param times - Times of the first points of the traces after the first.
 */
export function restoreTraceCuts(cruiseId: string, times: unknown): void {
  if (!Array.isArray(times) || times.length === 0) return;
  if (store.get<number[]>(`ldb.trkSegs.${cruiseId}`, []).length > 0) return;
  const track = store.get<TrackPoint[]>(`ldb.track.${cruiseId}`, []);
  const starts = (times as unknown[])
    .filter((time): time is number => typeof time === 'number')
    .map((time) => track.findIndex((point) => point[0] >= time))
    .filter((start) => start > 0);
  if (starts.length > 0) {
    store.set(
      `ldb.trkSegs.${cruiseId}`,
      [...new Set(starts)].toSorted((a, b) => a - b),
    );
  }
}

/** Traces deleted on this device or another, for the synchronisation. */
const TRACES_GONE_KEY = 'ldb.syncTracesGone';
/** A deleted trace is remembered this long, then forgotten. */
const TRACES_GONE_MS = 180 * 24 * 3600 * 1000;

/**
 * Deleted traces: `cruise|first time|last time` → when deleted.
 * @returns The deleted traces still remembered.
 */
export function tracesGone(): Record<string, number> {
  const limit = Date.now() - TRACES_GONE_MS;
  return Object.fromEntries(
    Object.entries(
      store.get<Record<string, number>>(TRACES_GONE_KEY, {}),
    ).filter(([, at]) => at >= limit),
  );
}

/**
 * Note a trace deleted here, by the times of its points: the other devices
 * delete the same points, and never send them back.
 * @param cruiseId - Cruise id.
 * @param points - The points deleted.
 */
export function noteTraceGone(
  cruiseId: string,
  points: readonly TrackPoint[],
): void {
  const first = points[0]?.[0];
  const last = points.at(-1)?.[0];
  if (first === undefined || last === undefined) return;
  store.set(TRACES_GONE_KEY, {
    ...tracesGone(),
    [`${cruiseId}|${first}|${last}`]: Date.now(),
  });
}

function rangesOf(
  gone: Readonly<Record<string, number>>,
  cruiseId: string,
): Array<[number, number]> {
  return Object.keys(gone).flatMap((key): Array<[number, number]> => {
    const [id, from, to] = key.split('|');
    return id === cruiseId && from && to ? [[Number(from), Number(to)]] : [];
  });
}

/**
 * The points of a track outside the deleted traces.
 * @param cruiseId - Cruise id.
 * @param track - The points.
 * @param gone - The deleted traces.
 * @returns The points kept.
 */
export function withoutGonePoints<T>(
  cruiseId: string,
  track: readonly T[],
  gone: Readonly<Record<string, number>> = tracesGone(),
): T[] {
  const ranges = rangesOf(gone, cruiseId);
  if (ranges.length === 0) return [...track];
  return track.filter((point) => {
    const time = (point as unknown as TrackPoint)[0];
    return !ranges.some(([from, to]) => time >= from && time <= to);
  });
}

/**
 * Take the traces another device deleted: remembered here, and their points
 * deleted from the tracks of this device (the cuts between traces kept).
 * @param received - The deleted traces of the other device.
 * @param tracked - The cruise recorded here, left as it is.
 */
export function takeTracesGone(received: unknown, tracked?: string): void {
  if (!received || typeof received !== 'object') return;
  const mine = tracesGone();
  const merged = { ...mine };
  for (const [key, at] of Object.entries(received)) {
    if (typeof at === 'number' && key.split('|').length === 3) {
      merged[key] = Math.max(at, merged[key] ?? 0);
    }
  }
  store.set(TRACES_GONE_KEY, merged);
  const cruises = new Set(
    Object.keys(merged).map((key) => key.split('|', 1)[0]),
  );
  for (const cruiseId of cruises) {
    if (!cruiseId || cruiseId === tracked) continue;
    const key = `ldb.track.${cruiseId}`;
    const track = store.get<TrackPoint[]>(key, []);
    const kept = withoutGonePoints(cruiseId, track, merged);
    if (kept.length === track.length) continue;
    const cuts = traceCutTimes(cruiseId);
    if (kept.length === 0) {
      store.del(key);
      store.del(`ldb.trkSegs.${cruiseId}`);
      continue;
    }
    store.set(key, kept);
    const starts = cuts
      .map((time) => kept.findIndex((point) => point[0] >= time))
      .filter((start) => start > 0);
    store.set(
      `ldb.trkSegs.${cruiseId}`,
      [...new Set(starts)].toSorted((a, b) => a - b),
    );
  }
}
