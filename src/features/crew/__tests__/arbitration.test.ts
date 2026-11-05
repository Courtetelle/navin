import { expect, test } from 'vitest';

import {
  arbitrationDefaults,
  arbitrationLabel,
  differingKeys,
  mergedCard,
} from '../arbitration.ts';

const card = {
  id: 'm1',
  prenom: 'Léa',
  nom: 'Favre',
  tel: '+41 79 000 00 01',
  lieuType: 'Lieu d’origine',
};
const sheet = {
  prenom: 'Léa',
  nom: 'Favre',
  tel: '+41 79 000 00 02',
  email: 'lea@example.org',
  sante: '',
};

test('only the filled received fields that differ are arbitrated', () => {
  expect(differingKeys(sheet, card)).toStrictEqual(['tel', 'email']);
});

test('the value of the card wins by default, when it has one', () => {
  expect(arbitrationDefaults(['tel', 'email'], card)).toStrictEqual({
    tel: 'old',
    email: 'new',
  });
});

test('a field is titled by its label', () => {
  expect(arbitrationLabel('pieceType')).toBe('Type de pièce');
  expect(arbitrationLabel('lieuType')).toBe('Type de lieu');
  expect(arbitrationLabel('email')).toBe('Courriel');
  expect(arbitrationLabel('prenom')).toBe('Prénom');
  expect(arbitrationLabel('autre')).toBe('autre');
});

test('the merge keeps the choices and adds what the card did not have', () => {
  expect(mergedCard(card, sheet, { tel: 'old', email: 'new' })).toStrictEqual({
    ...card,
    email: 'lea@example.org',
    sante: '',
  });
  expect(mergedCard(card, sheet, { tel: 'new' }).tel).toBe('+41 79 000 00 02');
});
