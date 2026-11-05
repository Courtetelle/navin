import { uid } from '../../lib/format.ts';
import type { Entry, Member } from '../../model/types.ts';
import {
  addEntry,
  crewFromMember,
  memberName,
  state,
  toast,
  updateCruise,
} from '../../state/index.ts';
import { lakeFix } from '../onwater/index.ts';

/**
 * Put a card on board or take it off, with a journal note once under way
 * (lake.js:1849-1862).
 * @param member - The card.
 */
export function toggleAboard(member: Member): void {
  const cruise = state.data.cruise.value;
  if (!cruise) return;
  const index = cruise.crew.findIndex((line) => line.memberId === member.id);
  updateCruise((draft) => {
    if (index === -1) {
      const skipper = draft.crew.some((line) => line.fonction === 'Skipper');
      draft.crew.push(crewFromMember(member, skipper ? 'Équipier' : 'Skipper'));
    } else {
      draft.crew.splice(index, 1);
    }
  });
  if (!state.view.tracking.value && (cruise.entries ?? []).length === 0) return;
  const who = memberName(member) || 'Coéquipier.ère';
  const note =
    index === -1 ? `${who} rejoint le bord` : `${who} quitte le bord`;
  lakeFix((position) => {
    const count = state.data.cruise.value?.crew.length ?? 0;
    const values: Entry['v'] = {
      evt: [index === -1 ? 'Embarquement' : 'Débarquement'],
      note: `${note} · ${count} à bord`,
    };
    if (position) values.pos = position;
    addEntry({ id: uid(), t: new Date().toISOString(), v: values });
  });
  toast(`${note} · noté au journal`);
}

/**
 * Give a role: one skipper and one second only, the former one goes back to
 * crew member (lake.js:1864-1870).
 * @param index - Crew line.
 * @param role - Role.
 */
export function setCrewRole(index: number, role: string): void {
  updateCruise((draft) => {
    if (role !== 'Équipier') {
      for (const line of draft.crew) {
        if (line.fonction === role) line.fonction = 'Équipier';
      }
    }
    const line = draft.crew[index];
    if (line) line.fonction = role;
  });
}

/**
 * Move a crew line up.
 * @param index - Crew line.
 */
export function moveCrewLineUp(index: number): void {
  updateCruise((draft) => {
    const line = draft.crew[index];
    const above = draft.crew[index - 1];
    if (!line || !above) return;
    draft.crew[index - 1] = line;
    draft.crew[index] = above;
  });
}
