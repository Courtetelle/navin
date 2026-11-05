import { dayKey } from '../../lib/format.ts';
import { distNM } from '../../lib/geo.ts';
import type { Cruise } from '../../model/types.ts';
import type { TrackPoint } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

/** One point of the line of a day. */
export interface DayPoint {
  /** Epoch milliseconds. */
  t: number;
  lat: number;
  lon: number;
}

/** Line sailed on a day. */
export interface DayLine {
  /** Recorded track, or the entries joined when there is no track. */
  line: DayPoint[];
  /** Miles sailed, stopovers excluded. */
  nm: number;
}

/** Gap that splits a track at a stopover. */
const STOPOVER_MS = 45 * 60_000;

/**
 * Line of a day of any cruise, open or not (the data part of legacy `mapData`,
 * which `lakeDays` called on every lake outing).
 * @param key - Day key.
 * @param cruise - Cruise.
 * @returns The line and its miles.
 */
export function dayLine(key: string, cruise: Cruise | null): DayLine {
  if (!cruise) return { line: [], nm: 0 };
  const track = store.get<TrackPoint[]>(`ldb.track.${cruise.id}`, []);
  let line: DayPoint[] = [];
  for (const [t, lat, lon] of track) {
    if (dayKey(new Date(t)) === key) line.push({ t, lat, lon });
  }
  if (line.length < 2) {
    line = [];
    for (const entry of cruise.entries) {
      const position = entry.v.pos;
      if (dayKey(new Date(entry.t)) !== key || !position || position.text) {
        continue;
      }
      const { lat, lon } = position;
      line.push({ t: Date.parse(entry.t), lat, lon });
    }
  }
  let nm = 0;
  for (let index = 1; index < line.length; index++) {
    const previous = line[index - 1] as DayPoint;
    const current = line[index] as DayPoint;
    if (current.t - previous.t < STOPOVER_MS) nm += distNM(previous, current);
  }
  return { line, nm };
}
