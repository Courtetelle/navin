import { freeze, produce } from 'immer';

import { store } from '../storage/store.ts';

import type { PrepState, PrepUseLog } from './data.ts';
import { data } from './data.ts';

/** Load the PréP usage order and paths (`ldb.prepUse`, `ldb.prepPaths`). */
export function loadPrep(): void {
  data.prep.value = null;
  data.prepUse.value = store.get<PrepUseLog>('ldb.prepUse', {
    boat: [],
    crew: [],
  });
  data.prepPaths.value = store.get<Record<string, unknown>>(
    'ldb.prepPaths',
    {},
  );
}

/**
 * Set the PréP flow state (legacy `prep = …`).
 * @param prep - New state, or null to leave the flow.
 */
export function setPrep(prep: PrepState | null): void {
  data.prep.value = freeze(prep, true);
}

/**
 * Change the PréP flow state with an immer recipe (it must be open).
 * @param recipe - Mutates the draft state.
 */
export function updatePrep(recipe: (prep: PrepState) => void): void {
  if (data.prep.value) data.prep.value = produce(data.prep.value, recipe);
}

/**
 * Note that a boat or crew was used, newest first, 300 at most (legacy `noteUse`).
 * @param kind - `'boat'` or `'crew'`.
 * @param id - Boat or crew id.
 * @param purpose - Purpose or type (`'mer'` by default).
 */
export function noteUse(kind: string, id: string, purpose?: string): void {
  data.prepUse.value = produce(data.prepUse.value, (log) => {
    log[kind] = [
      { id, p: purpose || 'mer', at: new Date().toISOString() },
      ...(log[kind] || []),
    ].slice(0, 300);
  });
  store.set('ldb.prepUse', data.prepUse.value);
}

/**
 * Order by use: the last one used for this purpose first, then most recently
 * used, then never used by name (legacy `byUse`).
 * @param list - Boats or crews.
 * @param kind - `'boat'` or `'crew'`.
 * @param purpose - Purpose (`'mer'` by default).
 * @param nameOf - Display name, for the alphabetical order.
 * @returns A sorted copy.
 */
export function byUse<T extends { id: string }>(
  list: readonly T[],
  kind: string,
  purpose: string | undefined,
  nameOf: (item: T) => string,
): T[] {
  const log = data.prepUse.value[kind] || [];
  const wanted = purpose || 'mer';
  const top = log.find(
    (use) => use.p === wanted && list.some((item) => item.id === use.id),
  )?.id;
  const last = (id: string) => log.find((use) => use.id === id)?.at || '';
  return list.toSorted(
    (a, z) =>
      (a.id === top ? -1 : z.id === top ? 1 : 0) ||
      last(z.id).localeCompare(last(a.id)) ||
      nameOf(a).localeCompare(nameOf(z), 'fr'),
  );
}

/**
 * Change the saved PréP paths with an immer recipe, then persist them.
 * @param recipe - Mutates the draft map (purpose → path).
 */
export function updatePrepPaths(
  recipe: (paths: Record<string, unknown>) => void,
): void {
  data.prepPaths.value = produce(data.prepPaths.value, recipe);
  store.set('ldb.prepPaths', data.prepPaths.value);
}
