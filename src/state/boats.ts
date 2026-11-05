import { produce } from 'immer';

import { boatInfoOf, boatSnap } from '../model/boatSheet.ts';
import type { Boat, CruiseInfo } from '../model/types.ts';
import { store } from '../storage/store.ts';

import { readBoats } from './boatsLoad.ts';
import { data } from './data.ts';

/** Boat values as serialized at the last save, to keep a version before a series of changes. */
let boatPrevious: Record<string, string> | null = null;

/** Load the boats, run their one-shot migrations and save them (legacy boot, lake.js 301-415). */
export function loadBoats(): void {
  boatPrevious = null;
  data.boats.value = readBoats();
  saveBoats(true);
}

/**
 * Persist the boats; a boat whose values changed since the last save first
 * keeps its previous values as a version, at most every 20 minutes (legacy `saveBoats`).
 * @param keepStamp - `true` keeps `ldb.boats.at` (merge of received data).
 * @returns `true` when written.
 */
export function saveBoats(keepStamp?: boolean): boolean {
  const previous = boatPrevious;
  if (previous) {
    data.boats.value = produce(data.boats.value, (boats) => {
      for (const boat of boats) {
        const before = previous[boat.id];
        const current = JSON.stringify(boatInfoOf(boat, boat.info));
        if (!before || before === current) continue;
        const last = (boat.hist || [])[0];
        if (
          last?.from !== 'Avant modification' ||
          Date.now() - Date.parse(last.at) > 20 * 60e3
        ) {
          boatSnap(
            boat,
            JSON.parse(before) as CruiseInfo,
            'Avant modification',
          );
        }
      }
    });
  }
  const boats = data.boats.value;
  boatPrevious = Object.fromEntries(
    boats.map((boat) => [boat.id, JSON.stringify(boatInfoOf(boat, boat.info))]),
  );
  if (keepStamp !== true) store.set('ldb.boats.at', new Date().toISOString());
  return store.set('ldb.boats', boats);
}

/**
 * Change the boats with an immer recipe, then save them.
 * @param recipe - Mutates the draft list.
 * @param keepStamp - As in {@link saveBoats}.
 * @returns `true` when written.
 */
export function updateBoats(
  recipe: (boats: Boat[]) => void,
  keepStamp?: boolean,
): boolean {
  data.boats.value = produce(data.boats.value, recipe);
  return saveBoats(keepStamp);
}

/**
 * Change one boat with an immer recipe, then save the boats.
 * @param id - Boat id.
 * @param recipe - Mutates the draft boat.
 * @returns `false` when the boat is unknown or not written.
 */
export function updateBoat(id: string, recipe: (boat: Boat) => void): boolean {
  if (!boatById(id)) return false;
  return updateBoats((boats) => {
    const boat = boats.find((item) => item.id === id);
    if (boat) recipe(boat);
  });
}

/**
 * Delete a boat.
 * @param id - Boat id.
 * @returns `true` when written.
 */
export function removeBoat(id: string): boolean {
  data.boats.value = data.boats.value.filter((boat) => boat.id !== id);
  return saveBoats();
}

/**
 * Boat by id (legacy `boatById`).
 * @param id - Boat id.
 * @returns The boat, if any.
 */
export function boatById(id: string | null | undefined): Boat | undefined {
  return data.boats.value.find((boat) => boat.id === id);
}

/**
 * Restored boats: unknown ones are added; when the received list is newer,
 * its boats replace those with the same id (legacy `mergeBoats`).
 * @param list - Boats from a backup.
 * @param at - Stamp of the received list.
 */
export function mergeBoats(list: readonly Boat[], at?: string): void {
  const newer = (at || '') > store.get('ldb.boats.at', '');
  data.boats.value = produce(data.boats.value, (boats) => {
    for (const boat of list) {
      if (!boat?.id) continue;
      const position = boats.findIndex((item) => item.id === boat.id);
      if (position === -1) boats.push(boat);
      else if (newer) boats[position] = boat;
    }
  });
  if (newer) store.set('ldb.boats.at', at);
  saveBoats(true);
}
