import { signal } from '@preact/signals-react';

import { store } from '../../storage/store.ts';

import type { MobKind, MobProcedure, MobSection } from './mobDefaults.ts';
import { MOB_DEFAULT, MOB_RECUP } from './mobDefaults.ts';

/** Zone of a man-overboard procedure. */
export type MobZone = 'lac' | 'mer';

/** Lake procedures (`ldb.mob2`). */
export const mobLake = signal<MobProcedure>({});
/** Sea procedures (`ldb.mob2mer`). */
export const mobSea = signal<MobProcedure>({});
/** Zone shown (legacy `mobZone`). */
export const mobZone = signal<MobZone>('lac');
/** Procedure shown (legacy `mobKind`). */
export const mobKind = signal<MobKind>('real');
/** Helmsman option shown (legacy `mobAllure`). */
export const mobAllure = signal(0);

/**
 * Load the procedures at start-up: the original ones the first time, the
 * recovery sections added once to a stored procedure, the sea copy created
 * (legacy app.js:1892-1905).
 */
export function initMobProcedures(): void {
  const lake: MobProcedure =
    store.get<MobProcedure | null>('ldb.mob2', null) ??
    structuredClone(MOB_DEFAULT);
  if (!lake.recupAdded) {
    const real = lake.real ?? [];
    lake.real = real;
    const added: MobSection[] = [];
    for (const section of MOB_RECUP) {
      if (!real.some((item) => item.id === section.id)) {
        added.push(structuredClone(section));
      }
    }
    const lost = real.findIndex((item) => /perd de vue/i.test(item.title));
    real.splice(lost === -1 ? real.length : lost, 0, ...added);
    lake.recupAdded = true;
    store.set('ldb.mob2', lake);
  }
  mobLake.value = lake;
  let sea = store.get<MobProcedure | null>('ldb.mob2mer', null);
  if (!sea) {
    sea = structuredClone(lake);
    store.set('ldb.mob2mer', sea);
  }
  mobSea.value = sea;
}

/**
 * Read the procedures again: a restored backup writes them in the storage.
 */
export function reloadMobProcedures(): void {
  const lake = store.get<MobProcedure | null>('ldb.mob2', null);
  const sea = store.get<MobProcedure | null>('ldb.mob2mer', null);
  if (lake) mobLake.value = lake;
  if (sea) mobSea.value = sea;
}

/**
 * Sections of the procedure shown (legacy `mobSecs`).
 * @returns The sections.
 */
export function mobSections(): readonly MobSection[] {
  const procedure = mobZone.value === 'mer' ? mobSea.value : mobLake.value;
  return procedure[mobKind.value] ?? [];
}

/**
 * Change the sections of the procedure shown, then save (legacy `saveMob`).
 * @param recipe - Mutates a copy of the sections.
 */
export function updateMobSections(
  recipe: (sections: MobSection[]) => void,
): void {
  const procedure = structuredClone(
    mobZone.value === 'mer' ? mobSea.value : mobLake.value,
  );
  const sections = procedure[mobKind.value] ?? [];
  procedure[mobKind.value] = sections;
  recipe(sections);
  if (mobZone.value === 'mer') mobSea.value = procedure;
  else mobLake.value = procedure;
  saveMob();
}

/**
 * Put the original version of the procedure shown back (legacy `meReset`).
 */
export function resetMobSections(): void {
  updateMobSections((sections) => {
    sections.splice(
      0,
      sections.length,
      ...structuredClone(MOB_DEFAULT[mobKind.value]),
    );
  });
}

function saveMob(): void {
  store.set('ldb.mob2', mobLake.value);
  store.set('ldb.mob2mer', mobSea.value);
  store.set('ldb.mob.at', new Date().toISOString());
}
