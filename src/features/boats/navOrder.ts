import type { Boat, Cruise, CruiseMeta, Member } from '../../model/types.ts';
import type { TrackPoint } from '../../state/index.ts';
import { memberName, state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

interface BoatNavigation {
  at: string;
  byPurpose: Record<string, string>;
}

/**
 * Last moment of real navigation of a cruise (legacy `cruiseRealAt`): journal
 * entries, track and filled day sheets count, editing the boat sheet does not.
 * @param meta - Index line of the cruise.
 * @param cruise - The cruise.
 * @returns An ISO-like time, `''` when it never sailed.
 */
export function cruiseRealAt(
  meta: Pick<CruiseMeta, 'id'>,
  cruise: Cruise,
): string {
  let at = '';
  for (const entry of cruise.entries ?? []) {
    if (entry.t > at) at = entry.t;
  }
  const track = store.get<TrackPoint[]>(`ldb.track.${meta.id}`, []);
  try {
    const last = track.at(-1);
    if (last) {
      const end = new Date(last[0]).toISOString();
      if (end > at) at = end;
    }
  } catch {
    // A damaged track point counts for nothing.
  }
  for (const [key, day] of Object.entries(cruise.days ?? {})) {
    const filled =
      day &&
      Object.keys(day).some(
        (name) =>
          day[name] !== '' && day[name] != null && name !== 'typeSortie',
      );
    if (filled && `${key}T23:59` > at) at = `${key}T23:59`;
  }
  return at;
}

/**
 * Boats by real navigation, most recent first; with a purpose (PréP), the last
 * boat sailed for that outing type comes first (legacy `boatsByNav`).
 * @param purpose - Outing purpose.
 * @returns The sorted boats.
 */
export function boatsByNav(purpose?: string | null): Boat[] {
  const boats = state.data.boats.value;
  const navigation = boatNavInfo(boats);
  let topId: string | null = null;
  if (purpose) {
    let topAt = '';
    for (const [id, info] of Object.entries(navigation)) {
      const at = info.byPurpose[purpose];
      if (at && at.localeCompare(topAt) > 0) {
        topAt = at;
        topId = id;
      }
    }
  }
  const lastAt = (boat: Boat) => navigation[boat.id]?.at ?? '';
  return boats.toSorted((first, second) => {
    if (first.id === topId) return -1;
    if (second.id === topId) return 1;
    return (
      lastAt(second).localeCompare(lastAt(first)) ||
      (first.info.boat ?? '').localeCompare(second.info.boat ?? '', 'fr')
    );
  });
}

/**
 * Members by number of real navigations, then the most recent, then by name
 * (legacy `membersByNav`).
 * @returns The sorted members.
 */
export function membersByNav(): Member[] {
  const navigation: Record<string, { count: number; at: string }> = {};
  for (const meta of state.data.index.value) {
    const cruise = store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null);
    if (!cruise || (cruise.crew ?? []).length === 0) continue;
    const at = cruiseRealAt(meta, cruise);
    if (!at) continue;
    const people = new Set(
      cruise.crew.map((line) => line.memberId).filter(Boolean),
    );
    for (const id of people as Set<string>) {
      navigation[id] ??= { count: 0, at: '' };
      const person = navigation[id];
      person.count++;
      if (at > person.at) person.at = at;
    }
  }
  const of = (member: Member) => navigation[member.id] ?? { count: 0, at: '' };
  return state.data.members.value.toSorted(
    (first, second) =>
      of(second).count - of(first).count ||
      of(second).at.localeCompare(of(first).at) ||
      memberName(first).localeCompare(memberName(second), 'fr'),
  );
}

function boatNavInfo(boats: readonly Boat[]): Record<string, BoatNavigation> {
  const out: Record<string, BoatNavigation> = {};
  const byName = new Map(
    boats.map((boat) => [(boat.info.boat ?? '').trim().toLowerCase(), boat.id]),
  );
  for (const meta of state.data.index.value) {
    const cruise = store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null);
    if (!cruise) continue;
    const known = boats.some((boat) => boat.id === cruise.boatId);
    const id = known
      ? cruise.boatId
      : byName.get((cruise.info?.boat ?? '').trim().toLowerCase());
    if (!id) continue;
    const at = cruiseRealAt(meta, cruise);
    if (!at) continue;
    out[id] ??= { at: '', byPurpose: {} };
    const boat = out[id];
    if (at > boat.at) boat.at = at;
    const purpose = cruise.purpose || 'mer';
    if (at > (boat.byPurpose[purpose] ?? '')) boat.byPurpose[purpose] = at;
  }
  return out;
}
