import { uid } from '../../lib/format.ts';
import { indexById } from '../../lib/indexById.ts';
import type { CrewMember, CrewSet, CrewSetLine } from '../../model/types.ts';
import {
  crewFromMember,
  crewSetIdent,
  saveCrewSets,
  state,
  updateCrewSets,
  updateCruise,
} from '../../state/index.ts';

import { updatePrepFlow } from './prepTypes.ts';

/**
 * Key of a crew: people and roles, order ignored (legacy `crewKey`).
 * @param lines - Crew lines.
 * @returns The key.
 */
export function crewKey(lines: readonly CrewSetLine[]): string {
  return lines
    .map((line) => `${line.memberId}:${line.fonction || ''}`)
    .toSorted()
    .join('|');
}

/**
 * The composition of the crew on board, created when it is a new one (legacy
 * `crewSetFromCruise`).
 * @returns The composition, or null without anyone from the cards.
 */
export function crewSetFromCruise(): CrewSet | null {
  const crew = (state.data.cruise.value?.crew || [])
    .filter((line) => line.memberId)
    .map((line) => ({
      memberId: line.memberId as string,
      fonction: line.fonction,
    }));
  if (crew.length === 0) return null;
  const known = state.data.crewSets.value.find(
    (item) => crewKey(item.crew) === crewKey(crew),
  );
  if (known) {
    saveCrewSets();
    return known;
  }
  const created: CrewSet = { id: uid(), ident: crewSetIdent(), crew };
  updateCrewSets((sets) => {
    sets.push(created);
  });
  return (
    state.data.crewSets.value.find((item) => item.id === created.id) ?? created
  );
}

/**
 * Put a composition on board (legacy `applyCrewSet`).
 * @param set - Composition.
 * @param set.crew - People and roles.
 * @returns `false` without open cruise.
 */
export function applyCrewSet(set: { crew: readonly CrewSetLine[] }): boolean {
  updatePrepFlow((prep) => {
    Reflect.deleteProperty(prep, 'fresh');
  });
  if (!state.data.cruise.value) return false;
  const crew: CrewMember[] = [];
  const members = indexById(state.data.members.value);
  for (const line of set.crew) {
    const member = members.get(line.memberId);
    if (member) crew.push(crewFromMember(member, line.fonction));
  }
  updateCruise((cruise) => {
    cruise.crew = crew;
  });
  return true;
}
