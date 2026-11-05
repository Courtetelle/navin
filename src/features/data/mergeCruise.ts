import type { Cruise, Entry, PhotoReference } from '../../model/types.ts';
import type { TrackPoint } from '../../state/index.ts';
import { saveCruiseRecord, state, trackKey } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

const NOT_COPIED: ReadonlySet<string> = new Set([
  'entries',
  'days',
  'info',
  'crew',
  'deleted',
  'photos',
  'id',
  'updated',
]);

/**
 * Merge a cruise received from a backup or another device (legacy
 * `mergeCruise`): the entries of both sides are kept, deletions follow, and
 * for the rest the most recently changed version wins. A cruise unknown here
 * is added as it is. Its track points are added to the stored track.
 * @param received - Cruise read from the file (a fresh object, completed in place).
 * @param track - Track of the file, if any.
 * @returns The stored cruise.
 */
export function mergeCruise(received: Cruise, track: unknown): Cruise {
  received.info = received.info || {};
  received.crew = received.crew || [];
  received.days = received.days || {};
  const known = state.data.index.value.some((meta) => meta.id === received.id);
  const { cruise } = saveCruiseRecord(
    known ? mergeInto(storedCruise(received.id), received) : received,
    true,
  );
  if (Array.isArray(track) && track.length > 0) {
    addTrackPoints(cruise.id, track as TrackPoint[]);
  }
  return cruise;
}

function storedCruise(id: string): Cruise {
  const cruise = store.get<Cruise | null>(`ldb.cruise.${id}`, null);
  if (!cruise) throw new Error(`cruise ${id} is not stored`);
  return cruise;
}

function mergeInto(current: Cruise, received: Cruise): Cruise {
  const newer = (received.updated || '') > (current.updated || '');
  const deleted = new Set([...deletedIds(current), ...deletedIds(received)]);
  current.entries = mergedEntries(current, received, newer, deleted);
  current.deleted = [...deleted];
  for (const key of Object.keys(received.days)) {
    current.days[key] = newer
      ? { ...current.days[key], ...received.days[key] }
      : { ...received.days[key], ...current.days[key] };
  }
  current.info = newer
    ? { ...current.info, ...received.info }
    : { ...received.info, ...current.info };
  if (newer ? received.crew.length > 0 : current.crew.length === 0) {
    current.crew = received.crew;
  }
  const photos = mergedPhotos(current, received);
  if (photos.length > 0) current.photos = photos;
  for (const key of Object.keys(received)) {
    if (!NOT_COPIED.has(key) && (newer || current[key] == null)) {
      current[key] = received[key];
    }
  }
  if (newer) current.updated = received.updated;
  return current;
}

function deletedIds(cruise: Cruise): readonly string[] {
  return (cruise.deleted ?? []) as readonly string[];
}

function mergedEntries(
  current: Cruise,
  received: Cruise,
  newer: boolean,
  deleted: ReadonlySet<string>,
): Entry[] {
  const byId = new Map(current.entries.map((entry) => [entry.id, entry]));
  for (const entry of received.entries) {
    if (!byId.has(entry.id) || newer) byId.set(entry.id, entry);
  }
  return [...byId.values()]
    .filter((entry) => !deleted.has(entry.id))
    .toSorted((first, second) => first.t.localeCompare(second.t));
}

function mergedPhotos(current: Cruise, received: Cruise): PhotoReference[] {
  const byId = new Map(
    (current.photos ?? []).map((photo) => [photo.id, photo]),
  );
  for (const photo of received.photos ?? []) {
    if (!byId.has(photo.id)) byId.set(photo.id, photo);
  }
  return [...byId.values()];
}

function addTrackPoints(id: string, track: readonly TrackPoint[]): void {
  const key = trackKey(id);
  const stored = store.get<TrackPoint[]>(key, []);
  const seen = new Set<number>();
  for (const point of stored) seen.add(point[0]);
  const merged = [...stored];
  for (const point of track) {
    if (!seen.has(point[0])) merged.push(point);
  }
  store.set(
    key,
    merged.toSorted((first, second) => first[0] - second[0]),
  );
}
