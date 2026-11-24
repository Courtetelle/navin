import { roleLabel } from '../../model/crewFields.ts';
import type { Member } from '../../model/types.ts';
import type { VoyageSection } from '../../model/voyages.ts';
import { memberName, state, updateVoyages } from '../../state/index.ts';

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
