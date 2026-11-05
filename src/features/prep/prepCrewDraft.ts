import { buzz } from '../../lib/dom.ts';
import { uid } from '../../lib/format.ts';
import type { CrewSet } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import {
  crewFull,
  crewSetIdent,
  noteUse,
  saveCrewSets,
  state,
  toast,
  updateCrewSets,
} from '../../state/index.ts';

import { applyCrewSet } from './prepCrew.ts';
import { prepGo } from './prepFlow.ts';
import type { CrewDraft } from './prepTypes.ts';
import { prepFlow, updatePrepFlow } from './prepTypes.ts';

/** « ＋ Nouvelle composition »: open the crew being composed. */
export function startCrewDraft(): void {
  buzz();
  updatePrepFlow((prep) => {
    prep.crewDraft = { baseId: null, name: '', crew: [] };
    prep.sub = 'crewEdit';
  });
}

/**
 * The name typed in « Nom de l’équipage ».
 * @param name - Text of the field.
 */
export function setCrewDraftName(name: string): void {
  updatePrepFlow((prep) => {
    if (prep.crewDraft) prep.crewDraft.name = name;
  });
}

/**
 * Legacy read the name field on every touch, without the spaces around it.
 */
function commitCrewDraftName(): void {
  updatePrepFlow((prep) => {
    if (prep.crewDraft) prep.crewDraft.name = prep.crewDraft.name.trim();
  });
}

/**
 * A person touched: on board or off; the first one is the skipper.
 * @param memberId - Person.
 */
export function toggleCrewDraftMember(memberId: string): void {
  buzz();
  commitCrewDraftName();
  updatePrepFlow(({ crewDraft }) => {
    if (!crewDraft) return;
    const position = crewDraft.crew.findIndex(
      (line) => line.memberId === memberId,
    );
    if (position !== -1) {
      crewDraft.crew.splice(position, 1);
      return;
    }
    const skipper = crewDraft.crew.some((line) => line.fonction === 'Skipper');
    crewDraft.crew.push({
      memberId,
      fonction: skipper ? 'Équipier' : 'Skipper',
    });
  });
}

/**
 * A role touched: any other role than « Équipier » belongs to one person.
 * @param position - Line of the person.
 * @param role - Role.
 */
export function setCrewDraftRole(position: number, role: string): void {
  buzz();
  commitCrewDraftName();
  updatePrepFlow(({ crewDraft }) => {
    if (!crewDraft) return;
    if (role !== 'Équipier') {
      for (const line of crewDraft.crew) {
        if (line.fonction === role) line.fonction = 'Équipier';
      }
    }
    const line = crewDraft.crew[position];
    if (line) line.fonction = role;
  });
}

/** « ＋ Ajouter une personne »: the crew page, the crew composed so far on board. */
export function addCrewDraftPerson(): void {
  buzz();
  const prep = prepFlow();
  if (prep && state.data.cruise.value) {
    applyCrewSet({ crew: prep.crewDraft ? prep.crewDraft.crew : [] });
  }
  updatePrepFlow((flow) => {
    flow.newCrew = true;
  });
  go('crew');
}

/** ◀ of « Nouvel équipage »: back to the compositions. */
export function closeCrewDraft(): void {
  updatePrepFlow((prep) => {
    prep.sub = null;
    prep.crewDraft = null;
  });
}

function newCrewSet(draft: CrewDraft, base: CrewSet | undefined): CrewSet {
  const set: CrewSet = {
    id: uid(),
    ident: crewSetIdent(),
    crew: draft.crew.map((line) => ({ ...line })),
  };
  if (draft.name && draft.name !== base?.name) set.name = draft.name;
  return set;
}

function finishCrewDraft(setId: string): void {
  saveCrewSets();
  const set = state.data.crewSets.value.find((item) => item.id === setId);
  if (!set) return;
  applyCrewSet(set);
  noteUse('crew', set.id, prepFlow()?.purpose ?? undefined);
  closeCrewDraft();
  prepGo(4);
}

function draftAndBase(): {
  draft: CrewDraft;
  base: CrewSet | undefined;
} | null {
  const draft = prepFlow()?.crewDraft;
  if (!draft) return null;
  const base = state.data.crewSets.value.find(
    (item) => item.id === draft.baseId,
  );
  return { draft, base };
}

/**
 * Keep the crew composed when its base changed (prep.js:682).
 * @param overwrite - Overwrite the base, keeping its number; else a new number.
 */
export function saveCrewDraftAs(overwrite: boolean): void {
  buzz();
  commitCrewDraftName();
  const current = draftAndBase();
  if (!current) return;
  const { draft, base } = current;
  if (overwrite && base) {
    updateCrewSets((sets) => {
      const set = sets.find((item) => item.id === base.id);
      if (!set) return;
      set.crew = draft.crew.map((line) => ({ ...line }));
      if (draft.name) set.name = draft.name;
    });
    toast(`✓ ${base.ident} écrasé, même numéro`);
    finishCrewDraft(base.id);
    return;
  }
  const set = newCrewSet(draft, base);
  updateCrewSets((sets) => {
    sets.push(set);
  });
  toast(`✓ Nouvel équipage ${set.ident}${set.name ? ` · ${set.name}` : ''}`);
  finishCrewDraft(set.id);
}

/** « Valider ▶ »: the same composition, or a new one (prep.js:690). */
export function validateCrewDraft(): void {
  buzz();
  commitCrewDraftName();
  const current = draftAndBase();
  if (!current) return;
  const { draft, base } = current;
  if (base && crewFull(base.crew) === crewFull(draft.crew)) {
    if (draft.name && draft.name !== base.name) {
      updateCrewSets((sets) => {
        const set = sets.find((item) => item.id === base.id);
        if (set) set.name = draft.name;
      });
    }
    finishCrewDraft(base.id);
    return;
  }
  const set = newCrewSet(draft, base);
  updateCrewSets((sets) => {
    sets.push(set);
  });
  toast(`Nouvel équipage ${set.ident}${set.name ? ` · ${set.name}` : ''}`);
  finishCrewDraft(set.id);
}
