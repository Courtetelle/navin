import { batch } from '@preact/signals-react';

import { state, updateMembers } from '../../state/index.ts';

import { showCrewPick, showFicheList } from './screen.ts';

/**
 * Open a card (legacy `crewFiche = id; crewFicheBack = back; renderCrewPick()`).
 * @param id - Member id, or `new`.
 * @param back - Screen to go back to: `list`, `crews`, or null for the pick screen.
 */
export function openFiche(id: string, back: string | null): void {
  batch(() => {
    state.view.crewFiche.value = id;
    state.view.crewFicheBack.value = back;
  });
  showCrewPick();
}

/**
 * Delete a card from a list (the swipe of prep.js:1221), then show the card list.
 * @param id - Member id.
 */
export function deleteMemberCard(id: string): void {
  updateMembers((members) => {
    const index = members.findIndex((member) => member.id === id);
    if (index !== -1) members.splice(index, 1);
  });
  showFicheList();
}
