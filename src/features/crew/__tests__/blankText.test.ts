import { expect, test } from 'vitest';

import { blankLabel, blankText } from '../blankSheet.ts';

test('the French sheet lists the labels in the order of the model', () => {
  const lines = blankText('fr').split('\n');

  expect(lines.slice(0, 6)).toStrictEqual([
    'NavIn · Fiche coéquipier·ère',
    '',
    'Merci de compléter après chaque « : » puis de me renvoyer ce message tel quel sans rien modifier de mon texte.',
    'Ne remplis rien si tu n’es pas en mesure de le faire (exemple pour Licence VHF n°).',
    '',
    'Prénom : ',
  ]);
  expect(lines.slice(13, 18)).toStrictEqual([
    '(Ici tu remplis à choix soit ta carte d’identité soit ton passeport, mais pas les deux)',
    'Carte d’identité : ',
    'Ou',
    'Passeport : ',
    'N° de la pièce d’identité : ',
  ]);
  expect(lines).toHaveLength(27);
  expect(lines.at(-2)).toBe('Téléphone du proche : ');
});

test('the other languages have their own text', () => {
  expect(blankText('en').split('\n').slice(0, 1)).toStrictEqual([
    'NavIn · Crew member sheet',
  ]);
  expect(blankText('it').split('\n', 6)[5]).toBe('Nome : ');
  expect(blankText('es').split('\n', 16)[15]).toBe('O');
});

test('a label falls back on French', () => {
  expect(blankLabel('tel', 'en')).toBe('Phone (with country code, e.g. +41)');
  expect(blankLabel('tel', 'fr')).toBe('Téléphone (avec indicatif, ex. +41)');
  expect(blankLabel('inconnu', 'en')).toBe('');
});
