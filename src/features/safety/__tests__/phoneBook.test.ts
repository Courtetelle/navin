import { expect, test } from 'vitest';

import { phoneBookEntries, searchPhones } from '../phoneBook.ts';

const saved = [
  {
    id: 'p1',
    name: 'Port de Rolle',
    number: '+41 21 825 11 11',
    kind: 'port' as const,
  },
  {
    id: 'p2',
    name: 'Voilerie Bénet',
    number: '079 555 12 34',
    kind: 'contact' as const,
  },
];
const members = [
  { id: 'm1', prenom: 'Élise', nom: 'Martin', tel: '+41 79 111 22 33' },
  { id: 'm2', prenom: 'Noa', nom: 'Roy' },
];
const boat = ['Capitainerie : 022 999 88 77\nSans numéro : à voir'];

test('the phone book gathers its numbers, the crew cards and the boat, by name', () => {
  const entries = phoneBookEntries(saved, members, boat);
  expect(
    entries.map((entry) => [entry.name, entry.kind, entry.own]),
  ).toStrictEqual([
    ['Capitainerie', 'bateau', false],
    ['Élise Martin', 'equipier', false],
    ['Port de Rolle', 'port', true],
    ['Voilerie Bénet', 'contact', true],
  ]);
});

test('the search reads names without accents, kinds and digits', () => {
  const entries = phoneBookEntries(saved, members, boat);
  const names = (query: string) =>
    searchPhones(entries, query).map((entry) => entry.name);
  expect(names('elise')).toStrictEqual(['Élise Martin']);
  expect(names('port')).toStrictEqual(['Port de Rolle']);
  expect(names('555 12')).toStrictEqual(['Voilerie Bénet']);
  expect(names('equipier')).toStrictEqual(['Élise Martin']);
  expect(names('')).toHaveLength(4);
  expect(names('zzz')).toStrictEqual([]);
});
