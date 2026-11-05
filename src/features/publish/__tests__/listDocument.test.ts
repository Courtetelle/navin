import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  blankSheet,
  dateStamp,
  documentOf,
  imagePages,
  slug,
  stripName,
} from '../listDocument.ts';
import type { PublishItem } from '../types.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 6, 15, 10, 30));
});

afterEach(() => {
  vi.useRealTimers();
});

const MISTRAL: PublishItem = {
  id: 'b1',
  name: 'Mistral',
  sections: [
    { sk: 'Identité', title: 'Mistral · Identité', rows: [['Type', 'Sloop']] },
    { sk: 'Moteur', title: 'Moteur', rows: [['Puissance', '30 cv']] },
  ],
};
const ALIZE: PublishItem = {
  id: 'b2',
  name: 'Alizé',
  sections: [{ title: 'Alizé', rows: [['Type', 'Ketch']] }],
};

function tall(id: string, rows: number): PublishItem {
  return {
    id,
    name: id,
    sections: [
      {
        title: id,
        rows: Array.from({ length: rows }, (_, index) => [`l${index}`, 'v']),
      },
    ],
  };
}

test('documentOf titles a single element by its name', () => {
  expect(documentOf([MISTRAL], 'Mes bateaux', 'boats')).toStrictEqual({
    title: 'Mistral',
    kicker: 'Fiche bateau',
    sub: 'Fiche bateau · 15/07/2026',
    sections: [
      { sk: 'Identité', title: 'Identité', rows: [['Type', 'Sloop']] },
      { sk: 'Moteur', title: 'Moteur', rows: [['Puissance', '30 cv']] },
    ],
  });
});

test('documentOf counts several elements and keeps their names', () => {
  const sheet = documentOf([MISTRAL, ALIZE], 'Mes bateaux', 'boats');
  expect(sheet.title).toBe('Mes bateaux');
  expect(sheet.sub).toBe('2 éléments · 15/07/2026');
  expect(sheet.sections?.[0]?.title).toBe('Mistral · Identité');
  expect(sheet.sections?.[2]?.title).toBe('Alizé');
});

test('stripName removes the name with or without its separator', () => {
  expect(stripName('Mistral · Identité', 'Mistral')).toBe('Identité');
  expect(stripName('Mistral', 'Mistral')).toBe('');
  expect(stripName('Moteur', 'Mistral')).toBe('Moteur');
});

test('imagePages starts a new image past 60 lines, never splitting an element', () => {
  const pages = imagePages([tall('a', 30), tall('b', 26), tall('c', 2)]);
  expect(pages.map((page) => page.map((item) => item.id))).toStrictEqual([
    ['a', 'b'],
    ['c'],
  ]);
  expect(imagePages([tall('alone', 200)])).toHaveLength(1);
  expect(imagePages([])).toStrictEqual([]);
});

test('imagePages counts the extra lines of a multi-line value', () => {
  const item: PublishItem = {
    id: 'a',
    name: 'a',
    sections: [{ title: 'a', rows: [['Actions', `x${'\ny'.repeat(57)}`]] }],
  };
  const pages = imagePages([item, { ...item, id: 'b' }]);
  expect(pages).toHaveLength(2);
});

test('slug gives the file-name form of a list title', () => {
  expect(slug('Les coéquipiers·ères')).toBe('les-coequipiers-eres');
  expect(slug('Mes bateaux')).toBe('mes-bateaux');
  expect(slug('  Équipages ! ')).toBe('equipages');
});

test('dateStamp is today as YYYYMMDD', () => {
  expect(dateStamp()).toBe('20260715');
});

test('blankSheet empties the values of the first element', () => {
  expect(blankSheet('boats', 'Mes bateaux', MISTRAL)).toStrictEqual({
    id: 'blank',
    name: 'Fiche bateau à remplir',
    sections: [
      { sk: 'Identité', title: 'Identité', rows: [['Type', ' ']] },
      { sk: 'Moteur', title: 'Moteur', rows: [['Puissance', ' ']] },
    ],
    photos: [],
  });
});

test('blankSheet keeps a title made of the name alone', () => {
  const sheet = blankSheet('crews', 'Équipages', ALIZE);
  expect(sheet.name).toBe('Fiche équipage à remplir');
  expect(sheet.sections[0]?.title).toBe('Alizé');
});

test('blankSheet of an empty list offers three blank lines', () => {
  expect(blankSheet('crews', 'Équipages', undefined).sections).toStrictEqual([
    {
      title: 'Équipages',
      rows: [
        ['Nom', ' '],
        ['Date', ' '],
        ['Remarques', ' '],
      ],
    },
  ]);
});
