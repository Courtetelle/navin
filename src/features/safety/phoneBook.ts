import { PHONE_RE } from '../../lib/phone.ts';
import type { Member } from '../../model/recordTypes.ts';
import { memberName, state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { contactItems } from './contacts.ts';

/** What a number of the phone book is. */
export type PhoneKind = 'port' | 'contact' | 'equipier' | 'bateau';

/** Labels of the kinds, as shown and searched. */
export const PHONE_KINDS: Record<PhoneKind, string> = {
  port: 'Port',
  contact: 'Contact',
  equipier: 'Équipier',
  bateau: 'Bateau',
};

/** A number typed in the phone book. */
interface SavedPhone {
  id: string;
  name: string;
  number: string;
  kind: 'port' | 'contact';
}

/** One line of the phone book. */
export interface PhoneEntry {
  /** Unique key. */
  id: string;
  name: string;
  number: string;
  kind: PhoneKind;
  /** Typed in the phone book: it can be deleted there. */
  own: boolean;
}

const KEY = 'ldb.phoneBook';

/**
 * The numbers typed in the phone book.
 * @returns They, as kept.
 */
function savedPhones(): SavedPhone[] {
  return store.get<SavedPhone[]>(KEY, []);
}

/**
 * Keep a new number.
 * @param name - Name.
 * @param number - Number, as typed.
 * @param kind - Port or contact.
 */
export function addPhone(
  name: string,
  number: string,
  kind: 'port' | 'contact',
): void {
  const id = `ph${Date.now().toString(36)}`;
  store.set(KEY, [
    ...savedPhones(),
    { id, name: name.trim(), number: number.trim(), kind },
  ]);
}

/**
 * Delete a number typed in the phone book.
 * @param id - Its id.
 */
export function deletePhone(id: string): void {
  store.set(
    KEY,
    savedPhones().filter((phone) => phone.id !== id),
  );
}

/**
 * Every number of the phone book: those typed in it, the phones of the crew
 * cards, and the useful numbers and base of the open boat.
 * @param saved - Numbers typed in the phone book.
 * @param members - Crew cards.
 * @param boatTexts - Contacts texts of the open boat (`label : number` lines).
 * @returns The entries, by name.
 */
export function phoneBookEntries(
  saved: readonly SavedPhone[],
  members: readonly Member[],
  boatTexts: readonly string[],
): PhoneEntry[] {
  const entries: PhoneEntry[] = saved.map((phone) => ({
    ...phone,
    own: true,
  }));
  for (const member of members) {
    const tel = typeof member.tel === 'string' ? member.tel : '';
    for (const [index, number] of (tel.match(PHONE_RE) ?? []).entries()) {
      entries.push({
        id: `m-${member.id}-${index}`,
        name: memberName(member) || 'Équipier',
        number,
        kind: 'equipier',
        own: false,
      });
    }
  }
  for (const [index, item] of boatTexts.flatMap(contactItems).entries()) {
    if (item.kind !== 'call') continue;
    entries.push({
      id: `b-${index}`,
      name: item.label || item.number,
      number: item.number,
      kind: 'bateau',
      own: false,
    });
  }
  return entries.toSorted((first, second) =>
    first.name.localeCompare(second.name, 'fr', { sensitivity: 'base' }),
  );
}

const plain = (text: string) =>
  text
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase();

/**
 * The entries a search finds: every word in the name, the number (digits
 * only) or the kind.
 * @param entries - Phone book.
 * @param query - Words typed.
 * @returns The entries found, in the same order.
 */
export function searchPhones(
  entries: readonly PhoneEntry[],
  query: string,
): PhoneEntry[] {
  const words = plain(query).split(/\s+/u).filter(Boolean);
  if (words.length === 0) return [...entries];
  return entries.filter((entry) => {
    const text = plain(`${entry.name} ${PHONE_KINDS[entry.kind]}`);
    const digits = entry.number.replaceAll(/\D/gu, '');
    return words.every(
      (word) =>
        text.includes(word) ||
        (/\d/u.test(word) && digits.includes(word.replaceAll(/\D/gu, ''))),
    );
  });
}

/**
 * The phone book of this device and of the open boat.
 * @returns The entries, by name.
 */
export function currentPhoneBook(): PhoneEntry[] {
  const info = state.data.cruise.value?.info;
  const texts = [info?.contacts, info?.base].filter(
    (text): text is string => typeof text === 'string',
  );
  return phoneBookEntries(savedPhones(), state.data.members.value, texts);
}
