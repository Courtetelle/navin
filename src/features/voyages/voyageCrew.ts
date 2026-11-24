import { batch } from '@preact/signals-react';

import { uid } from '../../lib/format.ts';
import { roleLabel } from '../../model/crewFields.ts';
import type { CrewSet, Member } from '../../model/types.ts';
import type { VoyageSection, Voyages } from '../../model/voyages.ts';
import { go } from '../../shell/router.ts';
import {
  crewSetIdent,
  memberName,
  state,
  updateCrewSets,
  updateVoyages,
} from '../../state/index.ts';
import { beginVoyageCrewEdit } from '../crew/index.ts';

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
 * The saved crew chosen for a cruise, if it still exists.
 * @param voyages - The cruise.
 * @returns The crew of data › Équipages.
 */
export function voyageCrewSet(
  voyages: Pick<Voyages, 'crewSet'>,
): CrewSet | undefined {
  return voyages.crewSet
    ? state.data.crewSets.value.find((set) => set.id === voyages.crewSet)
    : undefined;
}

/**
 * Who leaves on the cruise: the saved crew chosen, or the crew picked one by
 * one before saved crews could be chosen.
 * @param voyages - The cruise.
 * @returns The lines, member id and role.
 */
export function voyageCrewLines(
  voyages: Pick<Voyages, 'crewSet' | 'crew'>,
): Array<{ memberId: string; fonction?: string }> {
  return voyageCrewSet(voyages)?.crew ?? voyages.crew;
}

/**
 * The crew of the cruise as tables: one per person, with role and contacts.
 * @returns The tables.
 */
export function crewSections(): VoyageSection[] {
  const members = state.data.members.value;
  return voyageCrewLines(state.data.voyages.value).map((line, index) => {
    const member = members.find((item) => item.id === line.memberId);
    const rows: Array<readonly [string, string]> = [
      ['Rôle', roleLabel(line.fonction ?? '', member?.sexe)],
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
 * Choose the saved crew of the open cruise, or none.
 * @param id - Crew id, or undefined.
 */
export function chooseVoyageCrewSet(id: string | undefined): void {
  updateVoyages((voyages) => {
    if (id) voyages.crewSet = id;
    else delete voyages.crewSet;
  });
}

/**
 * Edit a saved crew in data › Équipages; leaving the editor comes back to
 * the cruise crew.
 * @param id - Crew id.
 */
export function editVoyageCrewSet(id: string): void {
  if (beginVoyageCrewEdit(id)) go('crews');
}

/** The saved crews there were when a new one was started from the cruise. */
let knownBeforeNew: ReadonlySet<string> | null = null;

/** Start a new saved crew from the cruise: once saved, it becomes its crew. */
export function newVoyageCrewSet(): void {
  knownBeforeNew = new Set(state.data.crewSets.peek().map((set) => set.id));
  batch(() => {
    state.view.crewsEdit.value = {
      id: null,
      name: '',
      crew: [],
      editing: true,
      back: 'vcrew',
    };
  });
  go('crews');
}

/** Back on the cruise crew: a crew saved meanwhile becomes its crew. */
export function linkNewVoyageCrewSet(): void {
  const known = knownBeforeNew;
  knownBeforeNew = null;
  if (!known) return;
  const added = state.data.crewSets.peek().find((set) => !known.has(set.id));
  if (added) chooseVoyageCrewSet(added.id);
}

/**
 * Turn the crew picked one by one into a saved crew of data › Équipages,
 * under the name of the cruise, and choose it.
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
  updateVoyages((voyages) => {
    voyages.crewSet = set.id;
    voyages.crew = [];
  });
  return voyage.name;
}
