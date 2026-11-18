import { keyToDate, num } from '../../lib/format.ts';
import type { CvTrip, MemberCv } from '../../model/memberCv.ts';
import type { Cruise } from '../../model/types.ts';
import { daysWithData, state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';
import { outingTimes } from '../boats/index.ts';

import { normLabel } from './blankParse.ts';

/** A navigation worked out from the outings saved in NavIn. */
export type NavInTrip = CvTrip & { navin: true };

/**
 * The navigations of a person saved in NavIn: each cruise at sea with its
 * dates, boat, role, name and miles; the lake outings only counted in days,
 * on one line.
 * @param memberId - The card.
 * @returns The navigations, the sea ones the latest first.
 */
export function navInTrips(memberId: string): NavInTrip[] {
  const sea: NavInTrip[] = [];
  const lakeDays: string[] = [];
  const open = state.data.cruise.value;
  for (const meta of state.data.index.value) {
    const cruise =
      open?.id === meta.id
        ? open
        : store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null);
    const line = cruise?.crew.find((one) => one.memberId === memberId);
    if (!cruise || !line) continue;
    const days = daysWithData(cruise);
    if (meta.type === 'lac' || cruise.type === 'lac') {
      lakeDays.push(...days);
      continue;
    }
    sea.push(seaTrip(meta.id, cruise, days, line.fonction));
  }
  const trips = sea.toSorted((first, second) =>
    (second.when ?? '').localeCompare(first.when ?? ''),
  );
  const lake = lakeLine(lakeDays);
  return lake ? [...trips, lake] : trips;
}

function seaTrip(
  id: string,
  cruise: Cruise,
  days: readonly string[],
  role: string | undefined,
): NavInTrip {
  const { info, created } = cruise;
  const from = text(info.du) || days[0] || created.slice(0, 10);
  const to = text(info.au) || days.at(-1) || from;
  const length = dayCount(from, to) || days.length;
  let miles = 0;
  for (const key of days) {
    miles += num(cruise.days[key]?.nmJour) ?? outingTimes(key, cruise).nm;
  }
  const trip: NavInTrip = {
    id: `navin-${id}`,
    navin: true,
    waters: 'mer',
    when: from.slice(0, 4),
  };
  const boat = text(info.boat);
  const route = [text(info.name), text(info.ports)].filter(Boolean).join(' · ');
  if (boat) trip.boat = boat;
  if (role) trip.role = role;
  if (route) trip.route = route;
  if (length) trip.duration = `${length} jour${length > 1 ? 's' : ''}`;
  if (miles >= 1) trip.nm = String(Math.round(miles));
  return trip;
}

function lakeLine(days: readonly string[]): NavInTrip | null {
  const unique = [...new Set(days)].toSorted();
  const first = unique[0];
  const last = unique.at(-1);
  if (!first || !last) return null;
  const from = first.slice(0, 4);
  const to = last.slice(0, 4);
  const count = unique.length;
  return {
    id: 'navin-lac',
    navin: true,
    waters: 'lac',
    when: from === to ? from : `${from} – ${to}`,
    route: 'Sorties enregistrées dans NavIn',
    duration: `${count} jour${count > 1 ? 's' : ''}`,
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Days from one day to another, both counted.
 * @param from - `YYYY-MM-DD`.
 * @param to - `YYYY-MM-DD`.
 * @returns The days, 0 when unreadable.
 */
function dayCount(from: string, to: string): number {
  const start = keyToDate(from).getTime();
  const end = keyToDate(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * The CV of a card with the navigations saved in NavIn added: a cruise
 * already typed in the CV (same year, same boat) is not counted twice.
 * @param memberId - The card.
 * @param cv - Its CV.
 * @returns The CV shown and shared.
 */
export function cvWithNavIn(memberId: string | null, cv: MemberCv): MemberCv {
  if (!memberId) return cv;
  const typed = cv.trips ?? [];
  const added = navInTrips(memberId).filter(
    (trip) =>
      trip.waters === 'lac' ||
      !typed.some(
        (one) =>
          one.waters === 'mer' &&
          (one.when ?? '').includes(trip.when ?? '') &&
          sameBoat(one.boat, trip.boat),
      ),
  );
  return added.length > 0 ? { ...cv, trips: [...typed, ...added] } : cv;
}

function sameBoat(first: string | undefined, second: string | undefined) {
  const one = normLabel(first ?? '');
  const other = normLabel(second ?? '');
  return Boolean(one && other && (one.includes(other) || other.includes(one)));
}
