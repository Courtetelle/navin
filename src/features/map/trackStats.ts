import { distNM } from '../../lib/geo.ts';
import { sunEvents } from '../../lib/sun.ts';
import type { CrewSet } from '../../model/recordTypes.ts';
import type { Cruise } from '../../model/types.ts';
import type { TrackPoint } from '../../state/index.ts';
import { loadTrack, state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

/** Statistics of a track (legacy `trackStats`). */
export interface TrackStatsResult {
  /** Distance in NM. */
  nm: number;
  /** Highest speed in knots. */
  max: number;
  /** Hours above 0.5 knot. */
  moving: number;
  /** First point time, epoch ms. */
  start: number | null;
  /** Last point time, epoch ms. */
  end: number | null;
}

/** One track of a cruise, as listed in « Mes traces ». */
export interface LakeTrack {
  /** Cruise id, followed by `#<rank>` when the cruise holds several tracks. */
  id: string;
  name: string;
  track: TrackPoint[];
  /** The outing it belongs to, when still stored. */
  cruise?: Cruise | null;
}

/**
 * Distance, top speed and time under way of a track (legacy `trackStats`):
 * gaps over 45 minutes do not count, speeds over 40 knots are GPS jumps.
 * @param track - Points in time order.
 * @returns The statistics.
 */
export function trackStats(track: readonly TrackPoint[]): TrackStatsResult {
  let nm = 0;
  let max = 0;
  let moving = 0;
  for (let index = 1; index < track.length; index++) {
    const [fromTime, fromLat, fromLon] = track[index - 1] as TrackPoint;
    const [toTime, toLat, toLon] = track[index] as TrackPoint;
    const hours = (toTime - fromTime) / 3_600_000;
    if (hours <= 0 || hours > 0.75) continue;
    const distance = distNM(
      { lat: fromLat, lon: fromLon },
      { lat: toLat, lon: toLon },
    );
    nm += distance;
    const speed = distance / hours;
    if (hours >= 10 / 3600 && speed < 40) {
      max = Math.max(max, speed);
      if (speed > 0.5) moving += hours;
    }
  }
  const first = track[0];
  const last = track.at(-1);
  return {
    nm,
    max,
    moving,
    start: first ? first[0] : null,
    end: last ? last[0] : null,
  };
}

const PURPOSE_CODES: Record<string, string> = {
  Entraînement: 'Ent',
  Location: 'Loc',
  Invitation: 'Inv',
};
const BOAT_LETTERS = 5;
const CREW_LETTERS = 4;

/**
 * The saved crew made of exactly the people aboard an outing.
 * @param cruise - The outing.
 * @param sets - The saved crews.
 * @returns Its name, empty when no saved crew matches.
 */
function crewNameOf(cruise: Cruise, sets: readonly CrewSet[]): string {
  const aboard = new Set(
    cruise.crew.map((line) => line.memberId).filter(Boolean),
  );
  if (aboard.size === 0) return '';
  const match = sets.find(
    (set) =>
      set.crew.length === aboard.size &&
      set.crew.every((line) => aboard.has(line.memberId)),
  );
  return match?.name ?? '';
}

/**
 * Short name of a track: date, boat, type of outing and saved crew, abbreviated,
 * e.g. `20260226_Savan Ent-Réga`.
 * @param cruise - The outing.
 * @param time - Start of the track, epoch ms.
 * @param sets - The saved crews.
 * @returns The name.
 */
export function traceTitle(
  cruise: Cruise,
  time: number,
  sets: readonly CrewSet[] = state.data.crewSets.value,
): string {
  const date = new Date(time);
  const day = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const boat = (cruise.info.boat ?? '').trim().slice(0, BOAT_LETTERS);
  const purpose =
    (cruise.purpose && PURPOSE_CODES[cruise.purpose]) ||
    (cruise.type === 'lac' ? 'Lac' : 'Mer');
  const crew = crewNameOf(cruise, sets).trim().slice(0, CREW_LETTERS);
  return `${day}_${boat} ${crew ? `${purpose}-${crew}` : purpose}`;
}

/** What a sheet of a track shows. */
export interface TraceSheet {
  /** Duration in ms. */
  duration: number;
  nm: number;
  /** Knots. */
  maxSpeed: number;
  /** Knots, over the whole duration. */
  meanSpeed: number;
  /** True wind in knots, `null` when not recorded. */
  maxWind: number | null;
  meanWind: number | null;
  /** Apparent wind in knots, `null` when not recorded. */
  maxApparent: number | null;
  meanApparent: number | null;
  sun: Array<{ kind: 'rise' | 'set'; at: number }>;
}

function windRange(
  track: readonly TrackPoint[],
  column: 3 | 4,
): { max: number | null; mean: number | null } {
  let count = 0;
  let total = 0;
  let max = 0;
  for (const point of track) {
    const value = point[column];
    if (value !== null && value !== undefined) {
      count++;
      total += value;
      max = Math.max(max, value);
    }
  }
  return count > 0 ? { max, mean: total / count } : { max: null, mean: null };
}

/**
 * The statistics of the sheet of a track.
 * @param track - Points in time order.
 * @returns The sheet.
 */
export function traceSheet(track: readonly TrackPoint[]): TraceSheet {
  const { nm, max, start, end } = trackStats(track);
  const duration = (end ?? 0) - (start ?? 0);
  const wind = windRange(track, 3);
  const apparent = windRange(track, 4);
  const first = track[0];
  return {
    duration,
    nm,
    maxSpeed: max,
    meanSpeed: duration > 0 ? nm / (duration / 3_600_000) : 0,
    maxWind: wind.max,
    meanWind: wind.mean,
    maxApparent: apparent.max,
    meanApparent: apparent.mean,
    sun: first ? sunEvents(first[0], end ?? first[0], first[1], first[2]) : [],
  };
}

/**
 * Every recorded track of every cruise, newest first; a cruise may hold
 * several tracks, whose starts are in `ldb.trkSegs.<id>` (legacy `allLakeTracks`).
 * @returns The tracks of two points or more.
 */
export function allLakeTracks(): LakeTrack[] {
  const tracks: LakeTrack[] = [];
  for (const meta of state.data.index.value) {
    const track = store.get<TrackPoint[]>(`ldb.track.${meta.id}`, []);
    const starts = store
      .get<number[]>(`ldb.trkSegs.${meta.id}`, [])
      .filter((start) => start > 0 && start < track.length);
    const bounds = [0, ...starts].toSorted((a, b) => a - b);
    for (const [rank, start] of bounds.entries()) {
      const part = track.slice(start, bounds[rank + 1] ?? track.length);
      if (part.length < 2) continue;
      const several = bounds.length > 1;
      const cruise = store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null);
      const title = cruise
        ? traceTitle(cruise, (part[0] as TrackPoint)[0])
        : meta.name;
      tracks.push({
        id: several ? `${meta.id}#${rank}` : meta.id,
        name: several ? `${title} · trace ${rank + 1}` : title,
        track: part,
        cruise,
      });
    }
  }
  return tracks.toSorted(
    (a, b) => (b.track[0] as TrackPoint)[0] - (a.track[0] as TrackPoint)[0],
  );
}

/**
 * Points of the recording in progress: the tracker shows only that one, older
 * tracks stay in « Mes traces » (legacy `currentTrack`).
 * @returns The points, empty when nothing is recording.
 */
export function currentTrack(): readonly TrackPoint[] {
  const trip = state.view.trip.value;
  if (!trip?.start) return [];
  const buffer = state.view.trackBuf.value;
  const all = state.view.tracking.value && buffer ? buffer : loadTrack();
  if (trip.from !== null && trip.from !== undefined) {
    return all.slice(trip.from);
  }
  return all.filter((point) => point[0] >= trip.start - 60_000);
}
