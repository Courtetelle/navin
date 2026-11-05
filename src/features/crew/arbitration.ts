import { stringOf, textOf } from '../../lib/format.ts';
import { normMemberPhones } from '../../lib/phone.ts';
import { CREW_FIELDS, MEMBER_KEYS } from '../../model/crewFields.ts';
import type { Member } from '../../model/types.ts';
import { state, updateMembers } from '../../state/index.ts';

import type { ParsedSheet } from './blankParse.ts';
import { BLANK_FIELDS } from './blankTexts.ts';
import { syncCrewFromMember } from './crewActions.ts';

/** Which value of a field is kept. */
export type Side = 'old' | 'new';

/** The value kept for each differing field. */
export type ArbitrationPick = Readonly<Record<string, Side>>;

/**
 * Fields of a received sheet that differ from the card.
 * @param received - Received sheet.
 * @param target - Existing card.
 * @returns The keys, in the order of the card.
 */
export function differingKeys(received: ParsedSheet, target: Member): string[] {
  const keys = new Set(['prenom', 'nom', ...MEMBER_KEYS]);
  return [...keys].filter((key) => {
    const value = received[key];
    return (
      value != null && value !== '' && textOf(target[key]) !== stringOf(value)
    );
  });
}

/**
 * Default choice: the value of the card when it has one, else the received one.
 * @param keys - Differing keys.
 * @param target - Existing card.
 * @returns The choices.
 */
export function arbitrationDefaults(
  keys: readonly string[],
  target: Member,
): Record<string, Side> {
  const pick: Record<string, Side> = {};
  for (const key of keys) pick[key] = target[key] ? 'old' : 'new';
  return pick;
}

/**
 * Title of a differing field.
 * @param key - Field key.
 * @returns The label.
 */
export function arbitrationLabel(key: string): string {
  if (key === 'pieceType') return 'Type de pièce';
  if (key === 'lieuType') return 'Type de lieu';
  const field = CREW_FIELDS.find((item) => item.key === key);
  return (
    field?.label || BLANK_FIELDS.find(([item]) => item === key)?.[1] || key
  );
}

/**
 * The card with the chosen received values, and the received ones it did not have.
 * @param current - Existing card.
 * @param received - Received sheet.
 * @param pick - Choices.
 * @returns The merged card.
 */
export function mergedCard(
  current: Member,
  received: ParsedSheet,
  pick: ArbitrationPick,
): Member {
  const merged: Member = { ...current };
  for (const [key, side] of Object.entries(pick)) {
    if (side === 'new') merged[key] = received[key];
  }
  for (const [key, value] of Object.entries(received)) {
    if (merged[key] == null || merged[key] === '') merged[key] = value;
  }
  return normMemberPhones(merged);
}

/**
 * Merge a received sheet into a card and copy it on board.
 * @param target - Existing card.
 * @param received - Received sheet.
 * @param pick - Choices.
 */
export function mergeReceivedSheet(
  target: Member,
  received: ParsedSheet,
  pick: ArbitrationPick,
): void {
  const index = state.data.members.value.findIndex(
    (member) => member.id === target.id,
  );
  const current = state.data.members.value[index];
  if (!current) return;
  const merged = mergedCard(current, received, pick);
  updateMembers((members) => {
    members[index] = merged;
  });
  if (state.data.cruise.value) syncCrewFromMember(merged);
}
