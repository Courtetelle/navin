import { batch } from '@preact/signals-react';
import { produce } from 'immer';

import { uid } from '../../lib/format.ts';
import type { CrewSet, CrewSetLine } from '../../model/types.ts';
import { go } from '../../shell/router.ts';
import type { CrewsEdit } from '../../state/index.ts';
import {
  crewFull,
  crewSetIdent,
  state,
  updateCrewSets,
} from '../../state/index.ts';
import { store } from '../../storage/store.ts';

/**
 * Begin editing a saved composition (legacy `crewsEdit = {…}`).
 * @param id - Composition id.
 * @returns `false` when it no longer exists.
 */
export function beginCrewSetEdit(id: string): boolean {
  const set = crewSetById(id);
  if (!set) return false;
  state.view.crewsEdit.value = {
    id: set.id,
    name: set.name || '',
    crew: set.crew.map((line) => ({ ...line })),
    existing: true,
    mode: null,
  };
  return true;
}

/**
 * Open a composition for editing from another screen (legacy nav.js:1285).
 * @param id - Composition id.
 */
export function openCrewSet(id: string): void {
  if (beginCrewSetEdit(id)) go('crews');
}

/**
 * The composition being edited, as last saved.
 * @param id - Composition id, or null.
 * @returns The saved composition.
 */
export function crewSetById(id: string | null): CrewSet | undefined {
  return state.data.crewSets.value.find((set) => set.id === id);
}

/**
 * The composition differs from the saved one and no choice was made yet: the
 * change waits for « écraser » or « nouvel équipage » (legacy `ceChoice`).
 * @param edit - Composition being edited.
 * @param base - Saved composition.
 * @returns `true` while the choice is pending.
 */
export function choicePending(
  edit: CrewsEdit,
  base: CrewSet | undefined,
): boolean {
  return Boolean(
    edit.existing &&
    !edit.mode &&
    base &&
    crewFull(base.crew) !== crewFull(edit.crew),
  );
}

/**
 * Change the composition being edited.
 * @param change - Fields to replace.
 */
export function patchCrewsEdit(change: Partial<CrewsEdit>): void {
  const edit = state.view.crewsEdit.value;
  if (edit) state.view.crewsEdit.value = { ...edit, ...change };
}

/**
 * Back from a new card: the people created since are added to the composition
 * (legacy `VIEWS.crews`, prep.js:773).
 */
export function addPendingMembers(): void {
  const edit = state.view.crewsEdit.value;
  if (!edit?.pendingNew) return;
  const { pendingNew, ...rest } = edit;
  const crew = [...edit.crew];
  const added = state.data.members.value.filter(
    (member) => !pendingNew.has(member.id),
  );
  for (const member of added) {
    if (crew.some((line) => line.memberId === member.id)) continue;
    crew.push({
      memberId: member.id,
      fonction: crew.length > 0 ? 'Équipier' : 'Skipper',
    });
  }
  state.view.crewsEdit.value = { ...rest, crew, addedNew: added.length > 0 };
}

/**
 * Automatic save of the composition being edited (legacy `saveNow`): created at
 * the first person chosen; a changed existing one waits for the user's choice.
 */
export function saveCrewsEdit(): void {
  const edit = state.view.crewsEdit.value;
  if (!edit || edit.crew.length === 0) return;
  const name = (edit.name || '').trim();
  if (edit.existing && !edit.mode) {
    const base = crewSetById(edit.id);
    if (!base || choicePending(edit, base)) return;
    updateCrewSets((sets) => setName(find(sets, edit.id), name));
    return;
  }
  if (crewSetById(edit.id)) {
    updateCrewSets((sets) => {
      const set = find(sets, edit.id);
      if (set) set.crew = copyLines(edit.crew);
      setName(set, name);
    });
    return;
  }
  const id = uid();
  const ident = crewSetIdent();
  batch(() => {
    patchCrewsEdit({ id });
    updateCrewSets((sets) => {
      const set: CrewSet = { id, ident, crew: copyLines(edit.crew) };
      setName(set, name);
      sets.push(set);
    });
  });
}

/**
 * The change becomes a new composition with its own number (legacy `ceAsNew`).
 * @param base - Saved composition it comes from.
 * @returns The identifier of the new composition.
 */
export function saveCrewsEditAsNew(base: CrewSet): string {
  const edit = state.view.crewsEdit.value;
  const set: CrewSet = {
    id: uid(),
    ident: crewSetIdent(),
    crew: copyLines(edit?.crew ?? []),
  };
  const name = (edit?.name || '').trim();
  if (name && name !== base.name) set.name = name;
  batch(() => {
    patchCrewsEdit({ id: set.id, mode: 'new', name: set.name || '' });
    updateCrewSets((sets) => {
      sets.push(set);
    });
  });
  return set.ident ?? '';
}

/**
 * Put a person in the composition or take them out.
 * @param memberId - Member id.
 */
export function toggleCrewsEditMember(memberId: string): void {
  const edit = state.view.crewsEdit.value;
  if (!edit) return;
  const crew = edit.crew.filter((line) => line.memberId !== memberId);
  if (crew.length === edit.crew.length) {
    crew.push({ memberId, fonction: crew.length > 0 ? 'Équipier' : 'Skipper' });
  }
  patchCrewsEdit({ crew });
  saveCrewsEdit();
}

/**
 * Give a role: one skipper and one second only (legacy `data-cerole`).
 * @param index - Line of the composition.
 * @param role - Role.
 */
export function setCrewsEditRole(index: number, role: string): void {
  const edit = state.view.crewsEdit.value;
  if (!edit) return;
  const crew = edit.crew.map((line) =>
    role !== 'Équipier' && line.fonction === role
      ? { ...line, fonction: 'Équipier' }
      : line,
  );
  const line = crew[index];
  if (line) crew[index] = { ...line, fonction: role };
  patchCrewsEdit({ crew });
  saveCrewsEdit();
}

/**
 * Write the caption of the group photo. Legacy wrote the list without the
 * stamps of a change of composition.
 * @param caption - Caption, empty to remove it.
 */
export function setCrewPhotoCaption(caption: string): void {
  const id = state.view.crewsEdit.value?.id ?? null;
  if (!crewSetById(id)) return;
  state.data.crewSets.value = produce(state.data.crewSets.value, (sets) => {
    const set = find(sets, id);
    if (!set) return;
    if (caption) set.photoCap = caption;
    else delete set.photoCap;
  });
  store.set('ldb.crewSets', state.data.crewSets.value);
}

function find(sets: CrewSet[], id: string | null): CrewSet | undefined {
  return sets.find((set) => set.id === id);
}

function setName(set: CrewSet | undefined, name: string): void {
  if (!set) return;
  if (name) set.name = name;
  else delete set.name;
}

function copyLines(lines: readonly CrewSetLine[]): CrewSetLine[] {
  return lines.map((line) => ({ ...line }));
}
