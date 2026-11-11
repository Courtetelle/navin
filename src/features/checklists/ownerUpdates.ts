import { produce } from 'immer';

import type { ModeKey } from '../../model/modes.ts';
import { CK_DEFS } from '../../model/modes.ts';
import {
  boatById,
  curMode,
  saveCruise,
  seedBrief,
  state,
  updateBoat,
  updateCruise,
  updateSeaTpl,
} from '../../state/index.ts';

import type { ChecklistOwnerRecord } from './checklistOwner.ts';
import { ownerBoatId } from './checklistOwner.ts';

/**
 * The seeding legacy `checklistOwner` did on every read: the safety briefing
 * once per owner, empty lists, and on a sea cruise the copy of the template.
 * @param boatId - Boat asked for.
 */
export function ensureChecklistOwner(boatId?: string | null): void {
  const id = ownerBoatId(boatId);
  if (id) ensureBoat(id);
  else if (state.data.cruise.value) ensureCruise();
}

/**
 * Change the lists of an owner, then save them; on a sea cruise the lists also
 * become the template of the next cruises (legacy `ckEdSave` and `save`).
 * @param boatId - Id of the owning boat, `null` for the open cruise.
 * @param mode - Mode of the lists.
 * @param recipe - Mutates the draft owner.
 */
export function updateOwner(
  boatId: string | null,
  mode: ModeKey,
  recipe: (owner: ChecklistOwnerRecord) => void,
): void {
  if (boatId) {
    updateBoat(boatId, recipe);
    return;
  }
  updateCruise(recipe, { save: false });
  syncSeaTpl(mode);
  saveCruise();
}

/**
 * Copy the lists of the open cruise to the sea template (legacy `syncSeaTpl`).
 * @param mode - Mode of the lists: nothing happens outside `mer`.
 */
function syncSeaTpl(mode: ModeKey): void {
  const cruise = state.data.cruise.value as ChecklistOwnerRecord | null;
  if (!cruise || mode !== 'mer') return;
  updateSeaTpl((template) => {
    for (const [, property] of CK_DEFS.mer) {
      template[property] = structuredClone(cruise[property] ?? []);
    }
    const lists = structuredClone(cruise.ckLists ?? []);
    template.ckLists = lists;
    template.ckMeta = structuredClone(cruise.ckMeta ?? {});
    template.briefSeeded = Boolean(cruise.briefSeeded);
    for (const key of Object.keys(template)) {
      if (key.startsWith('ckx_')) Reflect.deleteProperty(template, key);
    }
    for (const list of lists) {
      const property = `ckx_${list.id}`;
      template[property] = structuredClone(cruise[property] ?? []);
    }
  });
}

function ensureBoat(id: string): void {
  if (!boatById(id)?.briefSeeded) {
    updateBoat(id, (boat) => {
      seedBrief(boat);
    });
  }
  const mode = curMode();
  state.data.boats.value = produce(state.data.boats.value, (boats) => {
    const boat = boats.find((item) => item.id === id);
    if (!boat) return;
    for (const [, property] of CK_DEFS[mode]) boat[property] ??= [];
    for (const list of boat.ckLists ?? []) boat[`ckx_${list.id}`] ??= [];
  });
}

function ensureCruise(): void {
  const template = state.data.seaTpl.value;
  updateCruise(
    (cruise: ChecklistOwnerRecord) => {
      for (const [, property] of CK_DEFS.mer) {
        cruise[property] ||= structuredClone(template[property] ?? []);
      }
      if (cruise.ckLists || !template.ckLists) return;
      const lists = structuredClone(template.ckLists);
      cruise.ckLists = lists;
      cruise.ckMeta = structuredClone(template.ckMeta ?? {});
      for (const list of lists) {
        const property = `ckx_${list.id}`;
        cruise[property] = structuredClone(template[property] ?? []);
      }
      if (template.briefSeeded) cruise.briefSeeded = true;
    },
    { save: false },
  );
  const seeded = (state.data.cruise.value as ChecklistOwnerRecord).briefSeeded;
  if (!seeded) {
    updateCruise(
      (cruise) => {
        seedBrief(cruise);
      },
      { save: false },
    );
    syncSeaTpl('mer');
    saveCruise();
  }
  updateCruise(
    (cruise: ChecklistOwnerRecord) => {
      for (const list of cruise.ckLists ?? []) cruise[`ckx_${list.id}`] ??= [];
    },
    { save: false },
  );
}
