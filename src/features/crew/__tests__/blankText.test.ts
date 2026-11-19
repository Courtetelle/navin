import { expect, test } from 'vitest';

import { blankLabel, blankText } from '../blankSheet.ts';

test('the French sheet starts with clear rules, then its parts', () => {
  const lines = blankText('fr').split('\n');

  expect(lines.slice(0, 4)).toStrictEqual([
    'NavIn · Fiche équipier·ère',
    '',
    '📌 À LIRE AVANT DE REMPLIR',
    '1️⃣ Appuie longuement sur ce message, « Copier », colle-le dans ta réponse, puis complète-le.',
  ]);
  expect(lines).toContain('— Permis mer et licence VHF —');
  expect(lines).toContain('Licence VHF n° : ');
  expect(lines).toContain('Permis mer n° : ');
  expect(blankText('fr')).not.toContain('Permis bateau');
  // The lake permit and the dates of issue stay on the card only.
  expect(blankText('fr')).not.toMatch(/Permis lac|délivr/);
  expect(lines.indexOf('— Identité —') + 1).toBe(lines.indexOf('Prénom : '));
  expect(lines.at(-1)).toBe('— Fin de la fiche, merci ! —');
});

test('the other languages have their own text', () => {
  expect(blankText('en').split('\n').slice(0, 1)).toStrictEqual([
    'NavIn · Crew member sheet',
  ]);
  expect(blankText('en')).toContain('VHF licence no. : ');
  expect(blankText('it')).toContain('Nome : ');
  expect(blankText('es').split('\n')).toContain('O');
});

test('a label falls back on French', () => {
  expect(blankLabel('tel', 'en')).toBe('Phone (format +41 79 123 45 67)');
  expect(blankLabel('tel', 'fr')).toBe('Téléphone (format +41 79 123 45 67)');
  expect(blankLabel('inconnu', 'en')).toBe('');
});
