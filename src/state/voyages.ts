import { produce } from 'immer';

import type { Voyages } from '../model/voyages.ts';
import {
  cleanVoyages,
  defaultVoyages,
  mergedVoyages,
} from '../model/voyages.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';

/** Load data › Croisières (`ldb.voyages`), or its default content. */
export function loadVoyages(): void {
  data.voyages.value =
    cleanVoyages(store.get<unknown>('ldb.voyages', null)) ?? defaultVoyages();
}

/**
 * Change data › Croisières with an immer recipe, stamp and save it.
 * @param recipe - Mutates the draft.
 */
export function updateVoyages(recipe: (voyages: Voyages) => void): void {
  data.voyages.value = produce(data.voyages.value, (draft) => {
    recipe(draft);
    draft.mod = new Date().toISOString();
  });
  store.set('ldb.voyages', data.voyages.value);
}

/**
 * data › Croisières was ever changed on this device: only then does it go
 * into the backups (an untouched one keeps the file the one of the first app).
 * @returns True when changed.
 */
export function voyagesChanged(): boolean {
  return Boolean(data.voyages.value.mod);
}

/**
 * data › Croisières from a backup or another device: the newer change wins,
 * the documents of both are kept.
 * @param raw - Untrusted content.
 */
export function mergeVoyages(raw: unknown): void {
  const received = cleanVoyages(raw);
  if (!received?.mod) return;
  const kept = data.voyages.value;
  const merged = mergedVoyages(kept, received);
  if (JSON.stringify(merged) === JSON.stringify(kept)) return;
  data.voyages.value = merged;
  store.set('ldb.voyages', merged);
}
