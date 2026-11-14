import { expect, test } from 'vitest';

import { foundIn, linesText, textValue } from '../recordText.ts';

const lines = [
  { label: 'Nom du bateau', value: 'Savannah' },
  { label: 'Modèle', value: 'Hanse 325' },
  { label: 'Moteur', value: 'Volvo D1-20' },
];

test('a word of a field shows where it was found', () => {
  expect(foundIn('hanse', 'Savannah', lines)).toBe('Modèle : Hanse 325');
  expect(foundIn('volvo', 'Savannah', lines)).toBe('Moteur : Volvo D1-20');
});

test('a word of the name needs no more', () => {
  expect(foundIn('sava', 'Savannah', lines)).toBe('');
});

test('the title of a field is searched too', () => {
  expect(linesText(lines)).toContain('Moteur');
  expect(foundIn('moteur', 'Savannah', lines)).toBe('Moteur : Volvo D1-20');
});

test('pictures and yes/no are left out of the text', () => {
  expect(textValue('data:image/png;base64,AAAA')).toBe('');
  expect(textValue(true)).toBe('');
  expect(textValue(['a', 2, { b: 'c' }])).toBe('a · 2 · c');
});
