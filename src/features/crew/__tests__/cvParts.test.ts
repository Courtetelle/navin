import { expect, test } from 'vitest';

import { identity } from '../cvParts.ts';

test('the band of the CV: born and nationality, then phone and mail, then the address', () => {
  expect(
    identity({
      id: 'm',
      prenom: 'Léa',
      sexe: 'Femme',
      naissance: '07/01/1973',
      nationalite: 'suisse',
      tel: '+41 76 000 00 00',
      email: 'lea@example.org',
      adresse: 'Rue du Lac 1\nCH-1110 Morges',
    }),
  ).toStrictEqual([
    ['née le 07/01/1973', 'suisse'],
    ['+41 76 000 00 00', 'lea@example.org'],
    ['Rue du Lac 1, CH-1110 Morges'],
  ]);
  // Empty lines left out.
  expect(
    identity({ id: 'm', prenom: 'Léa', email: 'lea@example.org' }),
  ).toStrictEqual([['lea@example.org']]);
});
