import { produce } from 'immer';

import { uid } from '../lib/format.ts';
import type { Cruise } from '../model/types.ts';
import type {
  Voyage,
  VoyageSectionKey,
  VoyageStore,
  Voyages,
} from '../model/voyages.ts';
import {
  VOYAGE_STORE_V,
  blankVoyage,
  cleanVoyageStore,
  mergedStores,
  voyageNavInfo,
} from '../model/voyages.ts';
import { delPhoto } from '../storage/photos.ts';
import { store } from '../storage/store.ts';

import { saveCruiseRecord } from './cruise.ts';
import { data } from './data.ts';

const EMPTY: VoyageStore = {
  list: [],
  active: null,
  mod: '',
  v: VOYAGE_STORE_V,
};

/** Load data › Croisières (`ldb.voyages`) and the cruise opened. */
export function loadVoyages(): void {
  data.voyageStore.value =
    cleanVoyageStore(store.get<unknown>('ldb.voyages', null)) ?? EMPTY;
  const open = store.get<string | null>('ldb.voyageOpen', null);
  data.voyageOpen.value = data.voyageStore.value.list.some(
    (voyage) => voyage.id === open,
  )
    ? open
    : null;
}

function saveStore(next: VoyageStore): void {
  data.voyageStore.value = next;
  store.set('ldb.voyages', next);
}

/**
 * Change the cruises with an immer recipe, stamp and save them.
 * @param recipe - Mutates the draft.
 */
export function updateVoyageStore(recipe: (draft: VoyageStore) => void): void {
  saveStore(
    produce(data.voyageStore.value, (draft) => {
      recipe(draft);
      draft.mod = new Date().toISOString();
      draft.v = VOYAGE_STORE_V;
    }),
  );
}

/**
 * Change the cruise opened with an immer recipe, stamp and save it.
 * @param recipe - Mutates the draft of its content.
 */
export function updateVoyages(recipe: (voyages: Voyages) => void): void {
  const id = data.voyageOpen.value;
  if (!id) return;
  saveStore(
    produce(data.voyageStore.value, (draft) => {
      const voyage = draft.list.find((item) => item.id === id);
      if (!voyage) return;
      recipe(voyage);
      voyage.mod = new Date().toISOString();
    }),
  );
}

/**
 * Open a cruise in data › Croisières.
 * @param id - Its id, or null for the list.
 */
export function openVoyage(id: string | null): void {
  data.voyageOpen.value = id;
  store.set('ldb.voyageOpen', id);
}

/**
 * Create a cruise, with the sections ticked, and open it.
 * @param sections - Sections ticked.
 * @param active - It becomes the active cruise.
 * @returns The cruise.
 */
export function createVoyage(
  sections: readonly VoyageSectionKey[],
  active: boolean,
): Voyage {
  const voyage = blankVoyage(data.voyageStore.value.list, {
    id: uid(),
    sections,
    now: new Date(),
    newId: uid,
  });
  updateVoyageStore((draft) => {
    draft.list.push(voyage);
    if (active) draft.active = voyage.id;
  });
  openVoyage(voyage.id);
  return voyage;
}

/**
 * Change a cruise by id.
 * @param id - Its id.
 * @param recipe - Mutates the draft.
 */
export function patchVoyage(id: string, recipe: (draft: Voyage) => void): void {
  updateVoyageStore((draft) => {
    const voyage = draft.list.find((item) => item.id === id);
    if (!voyage) return;
    recipe(voyage);
    voyage.mod = new Date().toISOString();
  });
}

/**
 * Rename a cruise; an empty text keeps its name.
 * @param id - Its id.
 * @param name - The new name.
 */
export function renameVoyage(id: string, name: string): void {
  if (!name.trim()) return;
  patchVoyage(id, (draft) => {
    draft.name = name.trim();
  });
}

/**
 * Delete a cruise and its documents.
 * @param id - Its id.
 */
export function removeVoyage(id: string): void {
  const voyage = data.voyageStore.value.list.find((item) => item.id === id);
  updateVoyageStore((draft) => {
    draft.list = draft.list.filter((item) => item.id !== id);
    if (draft.active === id) draft.active = null;
  });
  if (data.voyageOpen.value === id) openVoyage(null);
  for (const doc of voyage?.docs ?? []) void delPhoto(doc.id);
}

/**
 * Make a cruise the active one, or none.
 * @param id - Its id, or null.
 */
export function setActiveVoyage(id: string | null): void {
  updateVoyageStore((draft) => {
    draft.active = id;
  });
}

/**
 * The active cruise, which new navigations, routes and routings join.
 * @returns Its id, or undefined.
 */
export function activeVoyageId(): string | undefined {
  return data.voyageStore.peek().active ?? undefined;
}

/**
 * data › Croisières holds something: only then does it go into the backups
 * (an untouched one keeps the file the one of the first app).
 * @returns True when there is something.
 */
export function voyagesChanged(): boolean {
  return (
    data.voyageStore.value.list.length > 0 ||
    Boolean(data.voyageStore.value.mod)
  );
}

/**
 * Every document of every cruise.
 * @returns Their ids.
 */
export function allVoyageDocIds(): string[] {
  return data.voyageStore.value.list.flatMap((voyage) =>
    voyage.docs.map((doc) => doc.id),
  );
}

/**
 * data › Croisières from a backup or another device.
 * @param raw - Untrusted content (both formats).
 */
export function mergeVoyages(raw: unknown): void {
  const received = cleanVoyageStore(raw);
  if (!received || (received.list.length === 0 && !received.mod)) return;
  const kept = data.voyageStore.value;
  const merged = mergedStores(kept, received);
  if (JSON.stringify(merged) === JSON.stringify(kept)) return;
  saveStore(merged);
}

/**
 * Save a navigation without opening it, the current one staying current.
 * @param cruise - The navigation.
 */
function saveNavigation(cruise: Cruise): void {
  const current = store.get<string | null>('ldb.current', null);
  saveCruiseRecord(cruise, true);
  if (current) store.set('ldb.current', current);
  else store.del('ldb.current');
}

function navigation(id: string): Cruise | null {
  const open = data.cruise.peek();
  return open?.id === id
    ? open
    : store.get<Cruise | null>(`ldb.cruise.${id}`, null);
}

/**
 * The navigations of a cruise take its ports, dates, VHF, weather and the
 * renter's numbers (used by the VHF calls, the SOS page and the CV).
 * @param id - Cruise id.
 */
export function syncVoyageNavigations(id: string): void {
  const voyage = data.voyageStore.peek().list.find((item) => item.id === id);
  if (!voyage) return;
  const values = voyageNavInfo(voyage);
  if (Object.keys(values).length === 0) return;
  for (const meta of data.index.peek()) {
    if (meta.voyage !== id) continue;
    const cruise = navigation(meta.id);
    if (!cruise) continue;
    const changed = Object.entries(values).some(
      ([key, value]) => cruise.info[key] !== value,
    );
    if (changed) {
      saveNavigation({ ...cruise, info: { ...cruise.info, ...values } });
    }
  }
}

/**
 * Put a navigation into a cruise (it takes its values), or take it out.
 * @param id - Navigation id.
 * @param voyage - Cruise id, or undefined.
 */
export function setNavigationVoyage(
  id: string,
  voyage: string | undefined,
): void {
  const cruise = navigation(id);
  if (!cruise) return;
  const { voyage: _old, ...rest } = cruise;
  saveNavigation(voyage ? { ...rest, voyage } : rest);
  if (voyage) syncVoyageNavigations(voyage);
}

/**
 * The cruise a navigation belongs to, if it still exists.
 * @param navigationId - Navigation id.
 * @returns The cruise id, or undefined.
 */
export function voyageOfNavigation(
  navigationId: string | undefined,
): string | undefined {
  if (!navigationId) return undefined;
  const meta = data.index.value.find((line) => line.id === navigationId);
  const id = typeof meta?.voyage === 'string' ? meta.voyage : undefined;
  return id && data.voyageStore.value.list.some((item) => item.id === id)
    ? id
    : undefined;
}
