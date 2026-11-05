import { expect, test } from 'vitest';

import { helpBubbleText, keepHelp, splitEmptyHelp } from '../helpRules.ts';

test('short texts and empty-state messages stay visible', () => {
  expect(keepHelp('Enregistrement automatique.')).toBe(true);
  expect(
    keepHelp(
      'Aucune trace enregistrée pour l’instant, démarrez la première depuis NavIn.',
    ),
  ).toBe(true);
  expect(
    keepHelp(
      'Toutes les traces enregistrées, avec la carte et le fichier GPX de chacune.',
    ),
  ).toBe(false);
  expect(
    keepHelp('Toutes les traces enregistrées, avec la carte et le GPX.', {
      nextIsRow: true,
    }),
  ).toBe(true);
  expect(
    keepHelp(
      'Toutes les traces enregistrées, avec la carte et le fichier GPX de chacune.',
      { keep: true },
    ),
  ).toBe(true);
});

test('an empty-state sentence is split from its explanation', () => {
  expect(
    splitEmptyHelp(
      'Aucune composition enregistrée. Crée la première avec le bouton ci-dessous.',
    ),
  ).toStrictEqual({
    first: 'Aucune composition enregistrée.',
    rest: 'Crée la première avec le bouton ci-dessous.',
  });
  expect(splitEmptyHelp('Aucune composition enregistrée.')).toBeNull();
});

test('the bubble shows lists as one line', () => {
  expect(helpBubbleText(['  Un ', 'Deux'])).toBe('Un · Deux');
  expect(helpBubbleText(' Un\n   deux ')).toBe('Un deux');
});
