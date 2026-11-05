import { uid } from '../../lib/format.ts';
import { normMemberPhones } from '../../lib/phone.ts';
import { MEMBER_KEYS } from '../../model/crewFields.ts';
import type { CrewMember, Member } from '../../model/types.ts';
import {
  crewFromMember,
  memberName,
  state,
  updateCruise,
  updateMembers,
} from '../../state/index.ts';

/**
 * Copy a changed card onto its crew line of the open cruise, keeping the role
 * (legacy `syncCrewFromMember`).
 * @param member - The card.
 */
export function syncCrewFromMember(member: Member): void {
  const cruise = state.data.cruise.value;
  const index =
    cruise?.crew.findIndex((line) => line.memberId === member.id) ?? -1;
  if (index === -1) return;
  updateCruise((draft) => {
    const line = draft.crew[index];
    if (line) draft.crew[index] = crewFromMember(member, line.fonction);
  });
}

/**
 * Crew lists typed by hand: each person becomes a reusable card (legacy
 * `crewToFiches`).
 */
export function crewToFiches(): void {
  const cruise = state.data.cruise.value;
  if (!cruise) return;
  const created: Member[] = [];
  const links = new Map<number, string>();
  for (const [index, line] of cruise.crew.entries()) {
    const fullName = (line.nom ?? '').trim();
    if (line.memberId || !fullName) continue;
    let member =
      findByName(state.data.members.value, fullName) ??
      findByName(created, fullName);
    if (!member) {
      member = cardFromLine(line, fullName);
      created.push(member);
    }
    links.set(index, member.id);
  }
  if (links.size === 0) return;
  updateMembers((members) => {
    members.push(...created);
  });
  updateCruise((draft) => {
    for (const [index, memberId] of links) {
      const line = draft.crew[index];
      if (line) line.memberId = memberId;
    }
  });
}

function findByName(
  members: readonly Member[],
  fullName: string,
): Member | undefined {
  const wanted = fullName.toLowerCase();
  return members.find((member) => memberName(member).toLowerCase() === wanted);
}

function cardFromLine(line: CrewMember, fullName: string): Member {
  const [prenom, ...others] = fullName.split(/\s+/);
  const member: Member = { id: uid(), prenom, nom: others.join(' ') };
  for (const key of MEMBER_KEYS) if (line[key]) member[key] = line[key];
  return normMemberPhones(member);
}
