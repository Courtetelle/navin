import { dayKey } from '../lib/format.ts';
import {
  boatInfoOf,
  boatKeys,
  boatSections,
  boatSnap,
  infoDiffKeys,
} from '../model/boatSheet.ts';
import { LAKE_CONTACTS } from '../model/contacts.ts';
import type { SectionDefinition } from '../model/field.ts';
import { INFO_SECTIONS } from '../model/infoSections.ts';
import type { Boat, Cruise } from '../model/types.ts';
import { store } from '../storage/store.ts';

import { boatById, updateBoat } from './boats.ts';
import { blankCruise, updateCruise } from './cruise.ts';
import { data } from './data.ts';
import { activeSections, isLake } from './mode.ts';

/**
 * A new lake outing with the boat's values; the engine counter starts from
 * the last outing of the same boat (legacy `blankOuting`).
 * @param name - Outing name.
 * @param boat - Boat.
 * @param duree - `'croisiere'` or anything else for a day outing.
 * @returns The outing (not saved).
 */
export function blankOuting(name: string, boat: Boat, duree?: string): Cruise {
  const previous = data.index.value
    .filter((meta) => meta.type === 'lac')
    .toSorted((a, z) => z.created.localeCompare(a.created))
    .find(
      (meta) =>
        (
          store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null) ||
          ({} as Partial<Cruise>)
        ).boatId === boat.id,
    );
  const cruise = blankCruise(
    name,
    previous
      ? store.get<Cruise | null>(`ldb.cruise.${previous.id}`, null)
      : null,
  );
  const today = dayKey(new Date());
  cruise.type = 'lac';
  cruise.duree = duree === 'croisiere' ? 'croisiere' : 'jour';
  cruise.boatId = boat.id;
  for (const key of boatKeys(boat)) Reflect.deleteProperty(cruise.info, key);
  Object.assign(
    cruise.info,
    { contacts: LAKE_CONTACTS },
    structuredClone(boat.info),
    { name, du: today },
    cruise.duree === 'jour' ? { au: today } : {},
  );
  return cruise;
}

/**
 * A value corrected in the outing sheet goes back to its boat (legacy `syncBoatFromCruise`).
 * @param key - The changed key.
 */
export function syncBoatFromCruise(key: string): void {
  const cruise = data.cruise.value;
  const boat = cruise?.boatId ? boatById(cruise.boatId) : undefined;
  if (!cruise || !boat || !key || !boatKeys(boat).includes(key)) return;
  updateBoat(boat.id, (draft) => {
    const value = cruise.info[key];
    if (value != null && value !== '') draft.info[key] = value;
    else Reflect.deleteProperty(draft.info, key);
    for (const infoKey in cruise.info) {
      if (infoKey.startsWith('pairSrc_')) {
        draft.info[infoKey] = cruise.info[infoKey];
      }
    }
  });
}

/** The outing sheet takes the current values of its boat (legacy `pullBoatIntoCruise`). */
export function pullBoatIntoCruise(): void {
  const cruise = data.cruise.value;
  const boat = cruise?.boatId ? boatById(cruise.boatId) : undefined;
  if (!cruise || !boat) return;
  if (
    infoDiffKeys(boatInfoOf(boat, cruise.info), boatInfoOf(boat, boat.info))
      .length === 0
  ) {
    return;
  }
  updateCruise((draft) => {
    for (const key of boatKeys(boat)) {
      if (boat.info[key] == null) Reflect.deleteProperty(draft.info, key);
      else draft.info[key] = boat.info[key];
    }
    for (const key in boat.info) {
      if (key.startsWith('pairSrc_')) draft.info[key] = boat.info[key];
    }
  });
}

/**
 * The open outing of this boat takes its values (legacy `syncCruiseFromBoat`).
 * @param boat - Boat.
 */
export function syncCruiseFromBoat(boat: Boat): void {
  if (data.cruise.value?.boatId !== boat.id) return;
  updateCruise((draft) => {
    for (const key of boatKeys(boat)) {
      if (boat.info[key] == null) Reflect.deleteProperty(draft.info, key);
      else draft.info[key] = boat.info[key];
    }
  });
}

/**
 * Put back a previous version of a boat sheet, keeping the current one as a version.
 * @param id - Boat id.
 * @param position - Index in `boat.hist`.
 * @returns `false` when the boat or version is unknown.
 */
export function restoreBoatVersion(id: string, position: number): boolean {
  const version = boatById(id)?.hist?.[position];
  if (!version) return false;
  updateBoat(id, (boat) => {
    boatSnap(boat, boatInfoOf(boat, boat.info), 'Avant retour en arrière');
    for (const key of Object.keys(boatInfoOf(boat, boat.info))) {
      Reflect.deleteProperty(boat.info, key);
    }
    Object.assign(boat.info, structuredClone(version.info));
  });
  const boat = boatById(id);
  if (boat) syncCruiseFromBoat(boat);
  return true;
}

/**
 * "Bateau et croisière" sections of the open cruise: the cruise, then the
 * sections of the outing's boat (legacy `infoSections`).
 * @returns The active sections.
 */
export function infoSections(): SectionDefinition[] {
  const cruise = data.cruise.value;
  const boat = isLake() && cruise ? boatById(cruise.boatId) : undefined;
  return boat
    ? activeSections([
        INFO_SECTIONS[0] as SectionDefinition,
        ...boatSections(boat),
      ])
    : activeSections(INFO_SECTIONS);
}
