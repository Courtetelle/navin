import { dayKey, fmtDur, fr, keyToDate, num, textOf } from '../lib/format.ts';
import { NOT_CARRIED } from '../model/fields.ts';
import type { Cruise, Day, Draft, Entry, EntryValues } from '../model/types.ts';

import { updateCruise } from './cruise.ts';
import { data } from './data.ts';
import { activeFields } from './mode.ts';
import { preferences } from './preferences.ts';

/**
 * Values of the last entry to carry over, when the "prefill" setting is on (legacy `carriedValues`).
 * @param exclude - Keys not carried.
 * @param cruise - Cruise (the open one by default).
 * @returns Deep copies of the carried values.
 */
export function carriedValues(
  exclude: readonly string[],
  cruise: Cruise | null = data.cruise.value,
): EntryValues {
  const values: EntryValues = {};
  const last = cruise?.entries.at(-1);
  if (!preferences.settings.value.prefill || !last) return values;
  for (const field of activeFields()) {
    if (!exclude.includes(field.key) && last.v[field.key] != null) {
      values[field.key] = structuredClone(last.v[field.key]);
    }
  }
  return values;
}

/**
 * A new logbook form at the current time (legacy `newDraft`).
 * @returns The draft (not saved).
 */
export function newDraft(): Draft {
  const values = carriedValues(NOT_CARRIED);
  return {
    t: new Date().toISOString(),
    v: values,
    prefilled: Object.keys(values).length > 0,
  };
}

/**
 * Add or replace an entry, keep the entries sorted by time and save (legacy `addEntry`).
 * @param entry - Entry (replaces the one with the same id).
 * @returns `true` when saved.
 */
export function addEntry(entry: Entry): boolean {
  return updateCruise((cruise) => {
    const position = cruise.entries.findIndex((item) => item.id === entry.id);
    if (position === -1) cruise.entries.push(entry);
    else cruise.entries[position] = entry;
    cruise.entries.sort((a, b) => a.t.localeCompare(b.t));
  });
}

/**
 * Delete an entry and save.
 * @param id - Entry id.
 * @returns `true` when saved.
 */
export function removeEntry(id: string): boolean {
  return updateCruise((cruise) => {
    cruise.entries = cruise.entries.filter((entry) => entry.id !== id);
  });
}

/**
 * Day sheet values, without creating the day (read-only part of legacy `dayData`).
 * @param key - `YYYY-MM-DD`.
 * @param cruise - Cruise (the open one by default).
 * @returns The day, or an empty object.
 */
export function getDay(
  key: string,
  cruise: Cruise | null = data.cruise.value,
): Day {
  return cruise?.days[key] ?? {};
}

/**
 * Create the day in memory when missing, like legacy `dayData(key)` does (the
 * empty day is written at the next save).
 * @param key - `YYYY-MM-DD`.
 */
export function ensureDay(key: string): void {
  if (!data.cruise.value || data.cruise.value.days[key]) return;
  updateCruise(
    (cruise) => {
      cruise.days[key] = {};
    },
    { save: false },
  );
}

/**
 * Change a day sheet (created when missing), then save the cruise.
 * @param key - `YYYY-MM-DD`.
 * @param recipe - Mutates the draft day.
 * @param options - `save: false` keeps the change in memory.
 * @returns `true` when saved.
 */
export function updateDay(
  key: string,
  recipe: (day: Day, cruise: Cruise) => void,
  options: { save?: boolean } = {},
): boolean {
  return updateCruise((cruise) => {
    cruise.days[key] ??= {};
    recipe(cruise.days[key], cruise);
  }, options);
}

/**
 * Days with a filled sheet or with entries, sorted (legacy `daysWithData`).
 * @param cruise - Cruise (the open one by default).
 * @returns Day keys.
 */
export function daysWithData(
  cruise: Cruise | null = data.cruise.value,
): string[] {
  if (!cruise) return [];
  const keys = Object.keys(cruise.days).filter(
    (key) => Object.keys(cruise.days[key] ?? {}).length > 0,
  );
  for (const entry of cruise.entries) keys.push(dayKey(new Date(entry.t)));
  return [...new Set(keys)].toSorted();
}

/** A navigation leg from a "Départ" entry to the next "Arrivée". */
interface NavLeg {
  dep: Entry;
  arr: Entry;
}

/**
 * Legs "Départ → Arrivée" of the logbook (legacy `navLegs`).
 * @param cruise - Cruise (the open one by default).
 * @returns The legs.
 */
function navLegs(cruise: Cruise | null = data.cruise.value): NavLeg[] {
  const legs: NavLeg[] = [];
  let departure: Entry | null = null;
  for (const entry of cruise?.entries ?? []) {
    const events = entry.v.evt || [];
    if (events.includes('Départ')) {
      departure = entry;
    } else if (events.includes('Arrivée') && departure) {
      legs.push({ dep: departure, arr: entry });
      departure = null;
    }
  }
  return legs;
}

/** Navigation of one day: duration, miles and the legs overlapping it. */
interface DayNavigation {
  ms: number;
  nm: number;
  legs: Array<NavLeg & { ms: number; dist: number }>;
}

/**
 * Navigation time and miles of a day, legs spread over the days (legacy `navForDay`).
 * @param key - `YYYY-MM-DD`.
 * @param cruise - Cruise (the open one by default).
 * @returns Duration (ms), miles and legs of that day.
 */
export function navForDay(
  key: string,
  cruise: Cruise | null = data.cruise.value,
): DayNavigation {
  const start = keyToDate(key);
  start.setHours(0, 0, 0, 0);
  const dayStart = start.getTime();
  const dayEnd = dayStart + 86_400_000;
  let ms = 0;
  let nm = 0;
  const legs: DayNavigation['legs'] = [];
  for (const leg of navLegs(cruise)) {
    const from = Date.parse(leg.dep.t);
    const to = Date.parse(leg.arr.t);
    const overlap = Math.min(to, dayEnd) - Math.max(from, dayStart);
    if (overlap <= 0) continue;
    ms += overlap;
    const dist = (num(leg.arr.v.loch) ?? 0) - (num(leg.dep.v.loch) ?? 0);
    if (dist > 0 && to > from) nm += (dist * overlap) / (to - from);
    legs.push({ ...leg, ms: to - from, dist });
  }
  return { ms, nm, legs };
}

/**
 * Navigation of a day as text: the duration typed by hand, else `H h MM · X NM` (legacy `navLabel`).
 * @param key - `YYYY-MM-DD`.
 * @param cruise - Cruise (the open one by default).
 * @returns The label, or `''`.
 */
export function navLabel(
  key: string,
  cruise: Cruise | null = data.cruise.value,
): string {
  const day = cruise?.days[key] ?? {};
  const navigation = navForDay(key, cruise);
  if (day.dureeNav) return textOf(day.dureeNav);
  if (!navigation.ms) return '';
  return `${fmtDur(navigation.ms)}${navigation.nm ? ` · ${fr(navigation.nm)} NM` : ''}`;
}

/**
 * Names of the crew of a cruise (legacy `crewNames`).
 * @param cruise - Cruise (the open one by default).
 * @returns Non-empty names.
 */
export function crewNames(cruise: Cruise | null = data.cruise.value): string[] {
  const names: string[] = [];
  for (const member of cruise?.crew ?? []) {
    if (member.nom) names.push(member.nom);
  }
  return names;
}
