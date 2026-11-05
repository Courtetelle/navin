import { expect, test } from 'vitest';

import { plusButtonClass, rowTypology } from '../buttonTypology.ts';

test('on a data screen, an action row is stacked, ＋ blue and the rest white', () => {
  expect(
    rowTypology('boats', [
      { text: '＋ Ajouter un bateau', className: 'btn' },
      { text: '🖨 Imprimer', className: 'btn primary' },
      { text: '🗑 Supprimer', className: 'btn danger' },
    ]),
  ).toStrictEqual({
    stacked: true,
    classNames: ['btn primary act-add', 'btn act-plain', 'btn danger'],
  });
});

test('a row of choices is never touched', () => {
  expect(
    rowTypology('boats', [
      { text: 'Jour', className: 'btn on', data: ['data-theme'] },
      { text: 'Nuit', className: 'btn', data: ['data-theme'] },
    ]),
  ).toStrictEqual({ stacked: false, classNames: ['btn on', 'btn'] });
});

test('elsewhere only rows holding a ＋ button are stacked', () => {
  expect(
    rowTypology('tracker', [
      { text: '＋ Nouvelle liste', className: 'btn primary' },
      { text: '📚 Mes bases', className: 'btn primary' },
    ]),
  ).toStrictEqual({
    stacked: true,
    classNames: ['btn primary act-add', 'btn act-plain'],
  });
  expect(
    rowTypology('tracker', [{ text: 'Fermer', className: 'btn' }]),
  ).toStrictEqual({
    stacked: false,
    classNames: ['btn'],
  });
});

test('a lone ＋ button turns blue unless it is a choice', () => {
  expect(plusButtonClass({ text: '+ Ajouter', className: 'btn big' })).toBe(
    'btn big act-add',
  );
  expect(plusButtonClass({ text: '+ 1', className: 'chip' })).toBe('chip');
});
