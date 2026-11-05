import { expect, test } from 'vitest';

import {
  translateMessage,
  translateOrKeep,
  translatePlaceholder,
  translateText,
} from '../translate.ts';

test('known texts are translated, the surrounding spaces kept', () => {
  expect(translateText('Données techniques', 'en')).toBe('Technical data');
  expect(translateText('  Retour ', 'en')).toBe('  Back ');
  expect(translateText('Sortir', 'it')).toBe('Esci');
  expect(translateText('Sortir', 'es')).toBe('Salir');
  expect(translateText('Boat Savannah', 'en')).toBeNull();
});

test('UI patterns translate their variable parts word by word', () => {
  expect(translateText('Prévisions météo : OUI', 'en')).toBe(
    'Weather forecast: YES',
  );
  expect(translateText('3 entrées au journal', 'en')).toBe('3 log entry(ies)');
  expect(translateText('Valeur entre 0 et 12', 'es')).toBe(
    'Valor entre 0 y 12',
  );
});

test('sentence fragments are translated in help texts only', () => {
  expect(
    translateText('Pied de pilote, arrondi au 0,5 m supérieur', 'en', true),
  ).toBe('Pied de pilote, rounded up to 0,5 m');
  expect(
    translateText('Pied de pilote, arrondi au 0,5 m supérieur', 'en'),
  ).toBeNull();
  expect(translateText('Bateaux à imprimer', 'it', true)).toBe(
    'Barche da stampare',
  );
});

test('bubbles are translated idea by idea', () => {
  expect(
    translateMessage('Fiche supprimée · Signature enregistrée', 'en'),
  ).toBe('Sheet deleted · Signature saved');
  expect(translateMessage('Fiche supprimée', 'fr')).toBe('Fiche supprimée');
});

test('French and unknown texts are kept', () => {
  expect(translateOrKeep('Données techniques', 'fr')).toBe(
    'Données techniques',
  );
  expect(translateOrKeep('Savannah', 'en')).toBe('Savannah');
  expect(translatePlaceholder('ex. Croatie 2026', 'en')).toBe(
    'e.g. Croatia 2026',
  );
  expect(translatePlaceholder('rien de connu', 'en')).toBe('rien de connu');
});
