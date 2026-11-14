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
