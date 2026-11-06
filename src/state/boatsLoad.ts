import { textOf, uid } from '../lib/format.ts';
import { indexById } from '../lib/indexById.ts';
import {
  EXAMPLE_BOATS,
  INSPIRATION_INFO,
  SAVANNAH_INFO,
} from '../model/boatSeeds.ts';
import { boatInfoOf, boatSnap, infoDiffKeys } from '../model/boatSheet.ts';
import {
  DEP_CHECK,
  DEP_CHECK_X,
  QUIT_CHECK_X,
  RELEVES_LABEL,
  SAVANNAH_CHECK,
  relevesItems,
  seedList,
} from '../model/checklistSeeds.ts';
import { LAKE_CONTACTS } from '../model/contacts.ts';
import type { Boat, Cruise, CruiseMeta } from '../model/types.ts';
import { store } from '../storage/store.ts';

import {
  ckColon,
  displacementWithoutKg,
  migrateSheets,
  powerWithoutKw,
  splitAnchorAndSails,
  splitFlagPort,
  splitModelYear,
} from './boatMigrations.ts';
import { examplesWanted } from './examplesWanted.ts';
import { migrateSavannahChecklists } from './savannahChecklists.ts';

const emptyLists = () => ({
  checklist: [],
  checklistDep: [],
  checklistX: [],
  checklistDepX: [],
});

const randomId = (prefix: string) =>
  prefix + Math.random().toString(36).slice(2, 9);

/**
 * Read the boats with the legacy robustness fixes and every one-shot migration,
 * in the legacy boot order (lake.js 301-414). The caller then runs `saveBoats(true)`.
 * @returns The boats.
 */
export function readBoats(): Boat[] {
  let boats: Boat[];
  if (store.get<unknown>('ldb.boats', null) == null) {
    boats = [
      {
        id: 'savannah',
        info: { contacts: LAKE_CONTACTS },
        checklist: seedList(SAVANNAH_CHECK, 'c'),
      },
    ];
  } else {
    boats = store.arr<Boat>('ldb.boats', (boat) => {
      if (!boat.info || typeof boat.info !== 'object') boat.info = {};
      if (!boat.id) boat.id = randomId('b');
      if (boat.checklist != null && !Array.isArray(boat.checklist)) {
        boat.checklist = [];
      }
      return boat;
    });
  }
  if (!store.get('ldb.anchorKg', false)) {
    for (const boat of boats) splitAnchorAndSails(boat.info);
    store.set('ldb.boats', boats);
    store.set('ldb.anchorKg', true);
  }
  if (!store.get('ldb.powerKw', false)) {
    for (const boat of boats) powerWithoutKw(boat.info);
    store.set('ldb.boats', boats);
    store.set('ldb.powerKw', true);
  }
  if (examplesWanted() && !store.get('ldb.exBoats', false)) {
    for (const example of EXAMPLE_BOATS) {
      if (!boats.some((boat) => boat.id === example.id)) {
        boats.push({
          id: example.id,
          info: { ...example.info },
          ...emptyLists(),
        });
      }
    }
    store.set('ldb.boats', boats);
    store.set('ldb.exBoats', true);
  }
  if (!store.get('ldb.inspiration', false)) {
    const exists = boats.some(
      (boat) =>
        boat.id === 'inspiration' ||
        /^\s*inspiration\s*$/i.test(textOf(boat.info?.boat)),
    );
    if (!exists) {
      boats.push({
        id: 'inspiration',
        info: { ...INSPIRATION_INFO },
        ...emptyLists(),
      });
    }
    store.set('ldb.boats', boats);
    store.set('ldb.inspiration', true);
  }
  seedSavannahInfo(boats);
  migrateSheets('ldb.modelSplit', boats, splitModelYear);
  migrateSheets('ldb.displKg', boats, displacementWithoutKg);
  migrateSheets('ldb.flagSplit', boats, splitFlagPort);
  for (const boat of boats) migrateBoatChecklists(boat, boats);
  keepCruiseCopiesAsVersions(boats);
  return boats;
}

function seedSavannahInfo(boats: Boat[]): void {
  const savannah = boats.find((boat) => boat.id === 'savannah');
  if (!savannah) return;
  if (!savannah.infoSeeded) {
    savannah.info = { ...SAVANNAH_INFO, ...savannah.info };
    savannah.infoSeeded = true;
  }
  if (!savannah.voilesUnseed) {
    const descriptions = savannah.info.voilesDesc;
    if (
      savannah.info.voilesAvant === 'Foc, Génois volant, Spi' &&
      !(Array.isArray(descriptions) ? descriptions : []).some(Boolean)
    ) {
      savannah.info.voilesAvant = '';
    }
    savannah.voilesUnseed = true;
    store.set('ldb.boats', boats);
  }
  if (!savannah.tarifsSeeded) {
    if (!savannah.info.tarifs) savannah.info.tarifs = SAVANNAH_INFO.tarifs;
    savannah.tarifsSeeded = true;
  }
}

function migrateBoatChecklists(boat: Boat, boats: Boat[]): void {
  const savannah = boat.id === 'savannah';
  if (!boat.checklistDep) {
    boat.checklistDep = savannah ? seedList(DEP_CHECK, 'd') : [];
  }
  if (!boat.checklistDepX) {
    boat.checklistDepX = savannah
      ? seedList([...DEP_CHECK, ...DEP_CHECK_X], 'x')
      : [];
  }
  if (savannah && !boat.relSeeded) {
    const list = boat.checklistDep.filter(
      (item) => item.label !== 'Vérifier le carburant',
    );
    const position = list.findIndex((item) =>
      /batterie|fer à cheval/i.test(item.label),
    );
    list.splice(position === -1 ? 0 : position + 1, 0, {
      id: 'rel1',
      label: RELEVES_LABEL,
      action: 'releves',
    });
    boat.checklistDep = list;
    boat.relSeeded = true;
  }
  if (savannah && !boat.relSplit) {
    const list = boat.checklistDep;
    const position = list.findIndex((item) => item.action === 'releves');
    if (position !== -1) list.splice(position, 1, ...relevesItems('rel-'));
    boat.relSplit = true;
  }
  if (savannah) migrateSavannahChecklists(boat, boats);
  if (!boat.ckColon) {
    for (const property of [
      'checklistDep',
      'checklistDepX',
      'checklist',
      'checklistX',
    ] as const) {
      for (const item of boat[property] || []) ckColon(item);
    }
    boat.ckColon = true;
    store.set('ldb.boats', boats);
  }
  if (savannah && !boat.ck385) {
    const list = boat.checklistDep || [];
    if (!list.some((item) => /fer à cheval/i.test(item.label))) {
      const vests = list.findIndex((item) => /^Gilets/i.test(item.label));
      list.splice(vests === -1 ? 0 : vests + 1, 0, {
        id: uid(),
        label: 'Sortir la bouée fer à cheval',
      });
    }
    boat.ck385 = true;
    store.set('ldb.boats', boats);
  }
  if (!boat.checklistX) {
    boat.checklistX = savannah
      ? seedList(
          [
            ...SAVANNAH_CHECK.slice(0, -2),
            ...QUIT_CHECK_X,
            ...SAVANNAH_CHECK.slice(-2),
          ],
          'y',
        )
      : [];
  }
}

function keepCruiseCopiesAsVersions(boats: Boat[]): void {
  if (store.get('ldb.boatVers1', false)) return;
  try {
    const byId = indexById(boats);
    for (const meta of store.get<CruiseMeta[]>('ldb.index', [])) {
      const cruise = store.get<Cruise | null>(`ldb.cruise.${meta.id}`, null);
      const boat = cruise?.boatId ? byId.get(cruise.boatId) : undefined;
      if (!cruise || !boat) continue;
      const info = boatInfoOf(boat, cruise.info);
      if (infoDiffKeys(info, boatInfoOf(boat, boat.info)).length > 0) {
        const at =
          textOf(cruise.saved) ||
          cruise.updated ||
          meta.created ||
          new Date().toISOString();
        boatSnap(
          boat,
          info,
          `Copie gardée dans la navigation « ${cruise.info.name || meta.name || 'sans nom'} »`,
          at,
        );
      }
    }
  } catch {
    // A damaged index: no version is kept.
  }
  store.set('ldb.boatVers1', true);
}
