import { batch } from '@preact/signals-react';

import { uid } from '../../lib/format.ts';
import { roleLabel } from '../../model/crewFields.ts';
import type { CrewSet, Member } from '../../model/types.ts';
import type { VoyageSection } from '../../model/voyages.ts';
import { go } from '../../shell/router.ts';
import {
  crewSetIdent,
  memberName,
  state,
  updateCrewSets,
  updateVoyages,
} from '../../state/index.ts';
import { showFiche } from '../crew/index.ts';

/**
 * A text field of a card, trimmed.
 * @param member - The card.
 * @param key - The field.
 * @returns The text, or an empty one.
 */
export function memberField(member: Member | undefined, key: string): string {
  const value = member?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * The crew of the cruise as tables: one per person, with role and contacts.
 * @returns The tables.
 */
export function crewSections(): VoyageSection[] {
  const members = state.data.members.value;
  return state.data.voyages.value.crew.map((line, index) => {
    const member = members.find((item) => item.id === line.memberId);
    const rows: Array<readonly [string, string]> = [
      ['Rôle', roleLabel(line.fonction, member?.sexe)],
    ];
    for (const [key, label] of [
      ['tel', 'Téléphone'],
      ['email', 'Courriel'],
      ['adresse', 'Adresse'],
      ['nationalite', 'Nationalité'],
    ] as const) {
      const value = memberField(member, key);
      if (value) rows.push([label, value]);
    }
    return {
      title: `${index + 1}. ${member ? memberName(member) : '?'}`,
      rows,
    };
  });
}

/**
 * Add a card to the cruise crew, or take it out; the first one is skipper.
 * @param id - Member id.
 */
export function toggleVoyageMember(id: string): void {
  updateVoyages((voyages) => {
    const at = voyages.crew.findIndex((line) => line.memberId === id);
    if (at === -1) {
      voyages.crew.push({
        memberId: id,
        fonction: voyages.crew.length === 0 ? 'Skipper' : 'Équipier',
      });
    } else {
      voyages.crew.splice(at, 1);
    }
  });
}

/** The cards there were when a new one was opened from the cruise crew. */
let knownBeforeNew: ReadonlySet<string> | null = null;

/**
 * Open a card from the cruise crew; leaving it comes back here. A new card,
 * once saved, joins the cruise crew.
 * @param id - Member id, or `new`.
 */
export function openVoyageFiche(id: string): void {
  if (id === 'new') {
    knownBeforeNew = new Set(state.data.members.peek().map((item) => item.id));
  }
  go('people');
  batch(() => {
    state.view.ficheFromData.value = true;
    state.view.crewFicheBack.value = 'vcrew';
    state.view.crewFiche.value = id;
  });
  showFiche(id);
}

/** Back on the cruise crew: the cards created meanwhile join it. */
export function addNewVoyageMembers(): void {
  const known = knownBeforeNew;
  knownBeforeNew = null;
  if (!known) return;
  const added = state.data.members
    .peek()
    .filter((member) => !known.has(member.id));
  for (const member of added) {
    if (
      !state.data.voyages
        .peek()
        .crew.some((line) => line.memberId === member.id)
    ) {
      toggleVoyageMember(member.id);
    }
  }
}

/**
 * Keep the cruise crew among the saved crews (data › Équipages), under the
 * name of the cruise.
 * @returns The name it is kept under, or null when the crew is empty.
 */
export function saveVoyageCrewSet(): string | null {
  const voyage = state.data.voyages.peek();
  if (voyage.crew.length === 0) return null;
  const set: CrewSet = {
    id: uid(),
    ident: crewSetIdent(),
    name: voyage.name,
    crew: voyage.crew.map((line) => ({ ...line })),
    at: new Date().toISOString(),
  };
  updateCrewSets((sets) => {
    sets.push(set);
  });
  return voyage.name;
}
