import type { Cruise } from '../../model/types.ts';
import { removeCruise, state, toast } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

/**
 * Delete a track (prep.js:1198): one segment of a track cut in several, else the
 * whole track, with its cruise when nothing else remains in it (its unique
 * number is then free again).
 * @param traceId - `cruiseId` or `cruiseId#segment`.
 * @returns `false` when the track is being recorded and was kept.
 */
export function deleteTrace(traceId: string): boolean {
  const [cruiseId, segmentKey] = traceId.split('#');
  if (
    state.view.tracking.value &&
    state.data.cruise.value &&
    state.data.cruise.value.id === cruiseId
  ) {
    toast('⚠ Trace en cours : arrêtez-la d’abord');
    return false;
  }
  const track = store.get<unknown[]>(`ldb.track.${cruiseId}`, []);
  const segments = [
    0,
    ...store
      .get<number[]>(`ldb.trkSegs.${cruiseId}`, [])
      .filter((start) => start > 0 && start < track.length),
  ].toSorted((first, second) => first - second);
  if (segmentKey !== undefined && segments.length > 1) {
    const { kept, starts } = cutSegment(track, segments, Number(segmentKey));
    store.set(`ldb.track.${cruiseId}`, kept);
    store.set(`ldb.trkSegs.${cruiseId}`, starts);
    toast('Trace supprimée');
    return true;
  }
  const cruise = store.get<Cruise | null>(`ldb.cruise.${cruiseId}`, null);
  const others = cruise
    ? (cruise.entries || []).filter((entry) => !entry.auto).length +
      (cruise.crew || []).length +
      (Array.isArray(cruise.photos) ? cruise.photos.length : 0)
    : 0;
  if (others === 0) {
    removeCruise(cruiseId ?? '');
    toast('Trace supprimée, avec sa navigation vide');
  } else {
    store.del(`ldb.track.${cruiseId}`);
    store.del(`ldb.trkSegs.${cruiseId}`);
    toast('Trace supprimée · la navigation et son journal restent');
  }
  return true;
}

/**
 * Remove one segment of a track.
 * @param track - Track points.
 * @param segments - Sorted start indexes of the segments, first one 0.
 * @param segment - Index of the segment to remove.
 * @returns The remaining points and the start indexes of the other segments.
 */
export function cutSegment<T>(
  track: readonly T[],
  segments: readonly number[],
  segment: number,
): { kept: T[]; starts: number[] } {
  const start = segments[segment] ?? 0;
  const end = segments[segment + 1] ?? track.length;
  const length = end - start;
  const kept = [...track.slice(0, start), ...track.slice(end)];
  const moved = segments
    .filter((_, position) => position !== segment)
    .map((value) => (value > start ? value - length : value));
  const starts = [...new Set(moved)].filter(
    (value) => value > 0 && value < kept.length,
  );
  return { kept, starts };
}
