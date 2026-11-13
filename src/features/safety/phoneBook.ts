import { PHONE_RE, PROCHES } from '../../lib/phone.ts';
import type { Member } from '../../model/recordTypes.ts';
import { memberName, state } from '../../state/index.ts';
import { store } from '../../storage/store.ts';

import { contactItems } from './contacts.ts';

/** What a number of the phone book is. */
export type PhoneKind = 'port' | 'contact' | 'equipier' | 'proche' | 'bateau';

/** Labels of the kinds, as shown and searched. */
export const PHONE_KINDS: Record<PhoneKind, string> = {
  port: 'Port',
  contact: 'Contact',
  equipier: 'Équipier',
  proche: 'Proche',
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
  /** Phone number, empty for an email line. */
  number: string;
  /** Email, empty for a phone line. @default undefined */
  email?: string;
  /** Who a relative belongs to, e.g. « Proche de Élise Martin ». @default undefined */
  sub?: string;
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

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/gu;

/** A person of the crew cards or of the open outing. */
type Person = Record<string, unknown> & { id?: string; nom?: string };

/**
 * Every number of the phone book: those typed in it; the phones and emails
 * of the crew cards and of the crew of the open outing, with the phones of
 * their relatives; the useful numbers and base of the open boat. A number or
 * an email found twice is listed once.
 * @param saved - Numbers typed in the phone book.
 * @param members - Crew cards.
 * @param boatTexts - Contacts texts of the open boat (`label : number` lines).
 * @param crew - Crew lines of the open outing.
 * @returns The entries, by name.
 */
export function phoneBookEntries(
  saved: readonly SavedPhone[],
  members: readonly Member[],
  boatTexts: readonly string[],
  crew: readonly Person[] = [],
): PhoneEntry[] {
  const entries: PhoneEntry[] = saved.map((phone) => ({
    ...phone,
    own: true,
  }));
  const seen = new Set(
    saved.map((phone) => phone.number.replaceAll(/\D/gu, '')),
  );
  const push = (entry: Omit<PhoneEntry, 'own'>) => {
    const key = entry.email
      ? entry.email.toLowerCase()
      : entry.number.replaceAll(/\D/gu, '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    entries.push({ ...entry, own: false });
  };
  const people: Array<[string, Person, string]> = [
    ...members.map((member): [string, Person, string] => [
      `m-${member.id}`,
      member,
      memberName(member),
    ]),
    ...crew.map((line, index): [string, Person, string] => [
      `c-${index}`,
      line,
      text(line.nom),
    ]),
  ];
  for (const [key, person, rawName] of people) {
    const name = rawName || 'Équipier';
    for (const [index, number] of (
      text(person.tel).match(PHONE_RE) ?? []
    ).entries()) {
      push({ id: `${key}-t${index}`, name, number, kind: 'equipier' });
    }
    for (const [index, email] of (
      text(person.email).match(EMAIL_RE) ?? []
    ).entries()) {
      push({
        id: `${key}-e${index}`,
        name,
        number: '',
        email,
        kind: 'equipier',
      });
    }
    for (const [slot, [nameKey, phoneKey]] of PROCHES.entries()) {
      for (const [index, number] of (
        text(person[phoneKey]).match(PHONE_RE) ?? []
      ).entries()) {
        push({
          id: `${key}-p${slot}-${index}`,
          name: text(person[nameKey]) || `Proche de ${name}`,
          number,
          kind: 'proche',
          sub: `Proche de ${name}`,
        });
      }
    }
  }
  for (const [index, item] of boatTexts.flatMap(contactItems).entries()) {
    if (item.kind !== 'call') continue;
    push({
      id: `b-${index}`,
      name: item.label || item.number,
      number: item.number,
      kind: 'bateau',
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
    const haystack = plain(
      `${entry.name} ${PHONE_KINDS[entry.kind]} ${entry.sub ?? ''} ${entry.email ?? ''}`,
    );
    const digits = entry.number.replaceAll(/\D/gu, '');
    return words.every(
      (word) =>
        haystack.includes(word) ||
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
  return phoneBookEntries(
    savedPhones(),
    state.data.members.value,
    texts,
    state.data.cruise.value?.crew ?? [],
  );
}
