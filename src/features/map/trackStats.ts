import { distNM } from '../../lib/geo.ts';
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
      tracks.push({
        id: several ? `${meta.id}#${rank}` : meta.id,
        name: several ? `${meta.name} · trace ${rank + 1}` : meta.name,
        track: part,
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
