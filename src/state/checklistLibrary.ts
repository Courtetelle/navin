import { produce } from 'immer';

import { uid } from '../lib/format.ts';
import {
  BRIEF_CATS,
  BRIEF_ITEMS,
  BRIEF_NAME,
  PRISE_ITEMS,
  PRISE_REPLACES,
} from '../model/checklistBases.ts';
import { SEA_DEP, SEA_QUIT, seedList } from '../model/checklistSeeds.ts';
import { CK_CATS_DEFAULT } from '../model/modes.ts';
import type {
  ChecklistBase,
  ChecklistItem,
  SeaTemplate,
} from '../model/types.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';

/** Date stamped on the built-in checklist bases. */
const SEED_AT = '2026-10-31T00:00:00.000Z';

/**
 * Load the checklist bases and the sea template, adding the built-in bases
 * (safety briefing, boat takeover) and the 2025 takeover items once.
 */
export function loadChecklistLibrary(): void {
  const stored = store.get<unknown>('ldb.ckLib', []);
  const library = (Array.isArray(stored) ? stored : []) as ChecklistBase[];
  if (!library.some((base) => base.seed === 'brief')) {
    library.push({
      id: 'base-brief',
      seed: 'brief',
      name: BRIEF_NAME,
      cats: [...BRIEF_CATS],
      items: structuredClone(BRIEF_ITEMS) as ChecklistBase['items'],
      at: SEED_AT,
    });
    store.set('ldb.ckLib', library);
  }
  let template = store.get<SeaTemplate | null>('ldb.tpl.mer', null);
  if (!template) {
    template = {
      checklistDep: seedList(SEA_DEP, 'm'),
      checklist: seedList(SEA_QUIT, 'r'),
    };
    store.set('ldb.tpl.mer', template);
  }
  if (!template.prise2025) {
    const keep = (template.checklistDep || []).filter(
      (item) => !PRISE_REPLACES.includes(item.label),
    );
    const have = new Set(keep.map((item) => item.label));
    template.checklistDep = [
      ...keep,
      ...PRISE_ITEMS.filter((item) => !have.has(item.label)).map(
        (item): ChecklistItem => ({ id: uid(), ...item }),
      ),
    ];
    template.prise2025 = true;
    store.set('ldb.tpl.mer', template);
  }
  if (!library.some((base) => base.seed === 'prise')) {
    library.push({
      id: 'base-prise',
      seed: 'prise',
      name: 'Prise en main du bateau',
      cats: ['Check-in', 'Croisière', 'Mer'],
      items: structuredClone(PRISE_ITEMS) as ChecklistBase['items'],
      at: SEED_AT,
    });
    store.set('ldb.ckLib', library);
  }
  data.ckLib.value = library;
  data.seaTpl.value = template;
}

/**
 * Persist the checklist bases with their stamp (legacy `saveLib`).
 * @returns `true` when written.
 */
export function saveLib(): boolean {
  const written = store.set('ldb.ckLib', data.ckLib.value);
  store.set('ldb.ckLib.at', new Date().toISOString());
  return written;
}

/**
 * Change the checklist bases with an immer recipe, then persist them.
 * @param recipe - Mutates the draft list.
 * @returns `true` when written.
 */
export function updateCkLib(recipe: (draft: ChecklistBase[]) => void): boolean {
  data.ckLib.value = produce(data.ckLib.value, recipe);
  return saveLib();
}

/**
 * Merge restored bases: unknown ones are added, newer ones (`at`) replace (legacy `mergeCkLib`).
 * @param list - Bases from a backup.
 */
export function mergeCkLib(
  list: readonly ChecklistBase[] | null | undefined,
): void {
  updateCkLib((library) => {
    for (const base of list || []) {
      if (!base?.id) continue;
      const position = library.findIndex((item) => item.id === base.id);
      if (position === -1) {
        library.push(base);
      } else if ((base.at || '') > (library[position]?.at || '')) {
        library[position] = base;
      }
    }
  });
}

/**
 * Every checklist category: defaults, those of the bases, then extras (legacy `allCkCats`).
 * @param extra - More categories.
 * @returns Unique categories in that order.
 */
export function allCkCats(extra?: readonly string[]): string[] {
  const categories = [...CK_CATS_DEFAULT];
  for (const base of data.ckLib.value) categories.push(...(base.cats || []));
  categories.push(...(extra || []));
  return [...new Set(categories)];
}

/**
 * Persist the sea checklist template (`ldb.tpl.mer`).
 * @param recipe - Mutates the draft template.
 * @returns `true` when written.
 */
export function updateSeaTpl(recipe: (draft: SeaTemplate) => void): boolean {
  data.seaTpl.value = produce(data.seaTpl.value, recipe);
  return store.set('ldb.tpl.mer', data.seaTpl.value);
}

/** A checklist owner (boat or cruise) as seen by {@link seedBrief}. */
export interface ChecklistOwner {
  /** @default undefined */
  briefSeeded?: boolean;
  /** @default undefined */
  ckLists?: Array<{ id: string; name: string; cats?: string[] }>;
  [key: string]: unknown;
}

/**
 * Add the safety briefing once to a boat or cruise (legacy `seedBrief`). Use it
 * inside an immer recipe: it mutates `owner`.
 * @param owner - Boat or cruise draft.
 * @param library - Checklist bases.
 * @returns `true` when the owner changed.
 */
export function seedBrief(
  owner: ChecklistOwner,
  library: readonly ChecklistBase[] = data.ckLib.value,
): boolean {
  if (owner.briefSeeded) return false;
  owner.briefSeeded = true;
  if ((owner.ckLists || []).some((list) => list.name === BRIEF_NAME)) {
    return true;
  }
  const base = library.find((item) => item.seed === 'brief');
  const items = base ? base.items : BRIEF_ITEMS;
  const id = uid();
  owner.ckLists = [
    { id, name: BRIEF_NAME, cats: [...BRIEF_CATS] },
    ...(owner.ckLists || []),
  ];
  owner[`ckx_${id}`] = items.map((item) => ({ id: uid(), ...item }));
  return true;
}
