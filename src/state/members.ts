import { produce } from 'immer';

import { normMemberPhones } from '../lib/phone.ts';
import { customField } from '../model/boatSheet.ts';
import { MEMBER_FIELDS, MEMBER_KEYS } from '../model/crewFields.ts';
import type { FieldDefinition } from '../model/field.ts';
import { EXAMPLE_MEMBERS } from '../model/memberSeeds.ts';
import type { CrewMember, Member } from '../model/types.ts';
import { store } from '../storage/store.ts';

import { data } from './data.ts';
import { examplesWanted } from './examplesWanted.ts';
import { preferences } from './preferences.ts';

/**
 * Load the member cards (each gets an id), add the example cards once and
 * put the phones in international format once (lake.js 1685-1781).
 */
export function loadMembers(): void {
  const members = store.arr<Member>('ldb.members', (member) => {
    if (!member.id) member.id = `m${Math.random().toString(36).slice(2, 9)}`;
    return member;
  });
  data.members.value = members;
  if (examplesWanted() && !store.get('ldb.exMembers', false)) {
    let added = 0;
    for (const example of EXAMPLE_MEMBERS) {
      if (!members.some((member) => member.id === example.id)) {
        members.push({ ...example });
        added++;
      }
    }
    if (added) saveMembers(true);
    store.set('ldb.exMembers', true);
  }
  if (!store.get('ldb.membersIntl', false)) {
    for (const member of members) normMemberPhones(member);
    saveMembers(true);
    store.set('ldb.membersIntl', true);
  }
  if (!store.get('ldb.procheSplit', false)) {
    try {
      for (const member of members) normMemberPhones(member);
      saveMembers(true);
      store.set('ldb.procheSplit', true);
    } catch {
      // A damaged card: retried at the next start.
    }
  }
}

/**
 * Persist the member cards (legacy `saveMembers`).
 * @param keepStamp - `true` keeps `ldb.members.at`.
 * @returns `true` when written.
 */
export function saveMembers(keepStamp?: boolean): boolean {
  if (keepStamp !== true) store.set('ldb.members.at', new Date().toISOString());
  return store.set('ldb.members', data.members.value);
}

/**
 * Change the member cards with an immer recipe, then save them.
 * @param recipe - Mutates the draft list.
 * @param keepStamp - As in {@link saveMembers}.
 * @returns `true` when written.
 */
export function updateMembers(
  recipe: (members: Member[]) => void,
  keepStamp?: boolean,
): boolean {
  data.members.value = produce(data.members.value, recipe);
  return saveMembers(keepStamp);
}

/**
 * Display name `Prénom Nom` (legacy `memberName`).
 * @param member - Member card.
 * @returns The full name.
 */
export function memberName(member: Pick<Member, 'prenom' | 'nom'>): string {
  return [member.prenom, member.nom].filter(Boolean).join(' ');
}

/**
 * Restored cards: unknown ones are added, and when the received list is newer
 * its cards replace those with the same id (legacy `mergeMembers`).
 * @param list - Cards from a backup.
 * @param at - Stamp of the received list.
 */
export function mergeMembers(list: readonly Member[], at?: string): void {
  const newer = (at || '') > store.get('ldb.members.at', '');
  data.members.value = produce(data.members.value, (members) => {
    for (const received of list) {
      if (!received?.id) continue;
      const member = normMemberPhones(structuredClone(received));
      const position = members.findIndex((item) => item.id === member.id);
      if (position === -1) members.push(member);
      else if (newer) members[position] = member;
    }
  });
  if (newer) store.set('ldb.members.at', at);
  saveMembers(true);
}

/**
 * Member card fields with the renamed labels and the custom fields of the
 * settings (legacy `memberFieldsX`).
 * @returns The field definitions.
 */
export function memberFieldsX(): FieldDefinition[] {
  const settings = preferences.settings.value;
  const alias = settings.memberAlias || {};
  return [
    ...MEMBER_FIELDS.map((field) =>
      alias[field.key] ? { ...field, label: alias[field.key] } : field,
    ),
    ...(settings.memberCustom || []).map((custom) => customField(custom)),
  ];
}

/**
 * Keys saved on a member card, custom fields included (legacy `memberKeysX`).
 * @returns The keys.
 */
export function memberKeysX(): string[] {
  return [
    ...MEMBER_KEYS,
    ...(preferences.settings.value.memberCustom || []).map(
      (custom) => `x_${custom.id}`,
    ),
  ];
}

/**
 * A crew line copied from a member card; later changes of the card do not
 * change the cruise history (legacy `crewFromMember`).
 * @param member - Member card.
 * @param fonction - Role on board.
 * @returns The crew line.
 */
export function crewFromMember(member: Member, fonction?: string): CrewMember {
  const crew: CrewMember = {
    memberId: member.id,
    nom: memberName(member),
    fonction,
  };
  for (const key of MEMBER_KEYS) if (member[key]) crew[key] = member[key];
  return crew;
}
