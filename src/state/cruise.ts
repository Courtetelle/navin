import { freeze, produce } from 'immer';

import { dayKey, num, uid } from '../lib/format.ts';
import { DEFAULT_CONTACTS } from '../model/contacts.ts';
import type { Cruise, CruiseMeta, Draft } from '../model/types.ts';
import { delPhoto } from '../storage/photos.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';
import { hooks } from './hooks.ts';
import { view } from './view.ts';

/** Storage key prefixes of everything that belongs to one cruise. */
export const CRUISE_KEY_PREFIXES: readonly string[] = [
  'ldb.cruise.',
  'ldb.draft.',
  'ldb.track.',
  'ldb.trkSegs.',
  'ldb.lastTrip.',
  'ldb.trip.',
];

/**
 * A new empty cruise; with `from`, the boat and contacts are taken over and the
 * engine counter starts from the last value read (legacy `blankCruise`).
 * @param name - Cruise name.
 * @param from - Previous cruise to continue from.
 * @returns The cruise (not saved).
 */
export function blankCruise(name: string, from?: Cruise | null): Cruise {
  const cruise: Cruise = {
    id: uid(),
    created: new Date().toISOString(),
    info: { name, conso: 3, vMoteur: 5, contacts: DEFAULT_CONTACTS },
    crew: [],
    entries: [],
    days: {},
  };
  if (from) {
    const keep = { ...from.info };
    for (const key of ['name', 'ports', 'du', 'au']) {
      Reflect.deleteProperty(keep, key);
    }
    const lastDay = Object.keys(from.days)
      .toSorted()
      .findLast((key) => num(from.days[key]?.moteurSoir) != null);
    if (lastDay) keep.moteurInit = from.days[lastDay]?.moteurSoir as string;
    Object.assign(cruise.info, keep, { name });
  }
  return cruise;
}

/**
 * Index line of a cruise.
 * @param cruise - Cruise.
 * @returns `{ id, name, created, type, duree }`.
 */
function cruiseMeta(cruise: Cruise): CruiseMeta {
  return {
    id: cruise.id,
    name: cruise.info.name || 'Sans nom',
    created: cruise.created,
    type: cruise.type || 'mer',
    duree: cruise.duree,
  };
}

/**
 * Save the open cruise: stamp `updated`, update its index line, remember it as
 * current (legacy `saveCruise`).
 * @param keepStamp - `true` keeps the received `updated` (sync merge).
 * @returns `true` when the cruise was written.
 */
export function saveCruise(keepStamp?: boolean): boolean {
  const current = data.cruise.value;
  if (!current) return false;
  return saveCruiseRecord(current, keepStamp).written;
}

/**
 * Save any cruise like {@link saveCruise} (stamp, index line, `ldb.current`)
 * without opening it; when it is the open one, the open cruise is updated too
 * (legacy `prev = cruise; cruise = target; saveCruise(); cruise = prev`).
 * @param target - Cruise to save.
 * @param keepStamp - `true` keeps its `updated`.
 * @returns The saved (stamped) cruise and whether it was written.
 */
export function saveCruiseRecord(
  target: Cruise,
  keepStamp?: boolean,
): { cruise: Cruise; written: boolean } {
  const cruise = freeze(
    keepStamp === true
      ? target
      : { ...target, updated: new Date().toISOString() },
    true,
  );
  if (data.cruise.value?.id === cruise.id) data.cruise.value = cruise;
  const meta = cruiseMeta(cruise);
  const index = data.index.value;
  const position = index.findIndex((line) => line.id === cruise.id);
  data.index.value = freeze(
    position === -1 ? [...index, meta] : index.with(position, meta),
    true,
  );
  store.set('ldb.index', data.index.value);
  store.set('ldb.current', cruise.id);
  return { cruise, written: store.set(`ldb.cruise.${cruise.id}`, cruise) };
}

/**
 * Change the open cruise with an immer recipe, then save it (legacy pattern
 * "mutate `cruise`, then `saveCruise()`").
 * @param recipe - Mutates the draft cruise.
 * @param options - `save: false` keeps the change in memory only; `keepStamp` as in {@link saveCruise}.
 * @returns `true` when saved (or not asked to save), `false` without open cruise or on write failure.
 */
export function updateCruise(
  recipe: (draft: Cruise) => void,
  options: { save?: boolean; keepStamp?: boolean } = {},
): boolean {
  const current = data.cruise.value;
  if (!current) return false;
  data.cruise.value = produce(current, recipe);
  if (options.save === false) return true;
  return saveCruise(options.keepStamp);
}

/**
 * Make a cruise the open one, in memory (legacy `cruise = c`); the draft and the
 * shown day are reset. Call {@link saveCruise} to persist it.
 * @param cruise - Cruise, or null to close.
 */
export function setCruise(cruise: Cruise | null): void {
  data.cruise.value = freeze(cruise, true);
  data.draft.value = null;
  view.currentDay.value = null;
}

/**
 * Open a stored cruise with its draft (legacy `openCruise`).
 * @param id - Cruise id.
 * @returns `false` when not found.
 */
export function openCruise(id: string): boolean {
  const cruise = store.get<Cruise | null>(`ldb.cruise.${id}`, null);
  if (!cruise) return false;
  data.cruise.value = freeze(cruise, true);
  data.draft.value = freeze(
    store.get<Draft | null>(`ldb.draft.${id}`, null),
    true,
  );
  store.set('ldb.current', id);
  return true;
}

/**
 * Delete the stored data of a cruise: photos, cruise, draft, track and trip keys.
 * @param id - Cruise id.
 */
function deleteCruiseData(id: string): void {
  const cruise = store.get<Cruise | null>(`ldb.cruise.${id}`, null);
  if (cruise?.photos) {
    for (const photo of cruise.photos) void delPhoto(photo.id);
  }
  for (const prefix of CRUISE_KEY_PREFIXES) store.del(prefix + id);
}

/**
 * Delete a whole cruise; when it was open, the most recent remaining one opens
 * (legacy `removeCruise`).
 * @param id - Cruise id.
 */
export function removeCruise(id: string): void {
  const open = data.cruise.value;
  if (open?.id === id && view.tracking.value) void hooks.stopTracking?.(false);
  deleteCruiseData(id);
  data.index.value = data.index.value.filter((line) => line.id !== id);
  store.set('ldb.index', data.index.value);
  if (open?.id !== id) return;
  data.cruise.value = null;
  data.draft.value = null;
  store.del('ldb.current');
  const next = data.index.value.toSorted((a, z) =>
    z.created.localeCompare(a.created),
  )[0];
  if (next) openCruise(next.id);
}

/**
 * Persist the draft of the open cruise, or delete it when null (legacy `saveDraft`).
 * @returns `true` when written or deleted.
 */
export function saveDraft(): boolean {
  const cruise = data.cruise.value;
  if (!cruise) return false;
  const draft = data.draft.value;
  if (draft) return store.set(`ldb.draft.${cruise.id}`, draft);
  store.del(`ldb.draft.${cruise.id}`);
  return true;
}

/**
 * Replace the draft and persist it (legacy `draft = …; saveDraft()`).
 * @param draft - New draft, or null to drop it.
 * @returns `true` when persisted.
 */
export function setDraft(draft: Draft | null): boolean {
  data.draft.value = freeze(draft, true);
  return saveDraft();
}

/**
 * Change the draft with an immer recipe, then persist it.
 * @param recipe - Mutates the draft form.
 * @returns `false` without draft or open cruise.
 */
export function updateDraft(recipe: (draft: Draft) => void): boolean {
  if (!data.draft.value) return false;
  data.draft.value = produce(data.draft.value, recipe);
  return saveDraft();
}

/**
 * Today's day key, or the shown day (legacy `currentDay || dayKey(new Date())`).
 * @returns `YYYY-MM-DD`.
 */
export function shownDay(): string {
  return view.currentDay.value || dayKey(new Date());
}
