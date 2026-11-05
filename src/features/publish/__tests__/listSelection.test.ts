import { expect, test } from 'vitest';

import {
  chosenItems,
  sectionKeys,
  sectionRowLabels,
} from '../listSelection.ts';
import type { ListChoice, PublishItem } from '../types.ts';

const NONE: ListChoice = { off: [], offSec: [], offRow: [], offPh: [] };

const BOATS: PublishItem[] = [
  {
    id: 'b1',
    name: 'Mistral',
    face: 'b1',
    faceRect: true,
    sections: [
      {
        sk: 'Identité',
        title: 'Mistral · Identité',
        rows: [
          ['Type', 'Sloop'],
          ['Année', '2004'],
        ],
      },
      { sk: 'Moteur', title: 'Moteur', rows: [['Puissance', '30 cv']] },
    ],
    photos: [
      { id: 'p1', cap: 'Photo 1' },
      { id: 'p2', cap: 'Photo 2' },
    ],
  },
  {
    id: 'b2',
    name: 'Alizé',
    sections: [
      {
        sk: 'Moteur',
        title: 'Alizé · Moteur',
        rows: [['Carburant', 'Gasoil']],
      },
    ],
  },
];

test('sectionKeys lists each key once, in order of appearance', () => {
  expect(sectionKeys(BOATS)).toStrictEqual(['Identité', 'Moteur']);
  expect(
    sectionKeys([{ id: 'x', name: 'x', sections: [{ title: 'x', rows: [] }] }]),
  ).toStrictEqual([]);
});

test('sectionRowLabels gathers the labels of a section over all items', () => {
  expect(sectionRowLabels(BOATS, 'Moteur')).toStrictEqual([
    'Puissance',
    'Carburant',
  ]);
});

test('chosenItems keeps everything when nothing is switched off', () => {
  const [first] = chosenItems(BOATS, NONE);
  expect(first?.sections).toStrictEqual(BOATS[0]?.sections);
  expect(first?.photos).toStrictEqual(BOATS[0]?.photos);
  expect(first?.face).toBe('b1');
});

test('chosenItems drops the unchecked elements', () => {
  const list = chosenItems(BOATS, { ...NONE, off: ['b1'] });
  expect(list.map((item) => item.id)).toStrictEqual(['b2']);
});

test('chosenItems puts the name back on the first section left', () => {
  const list = chosenItems(BOATS, { ...NONE, offSec: ['Identité'] });
  expect(list[0]?.sections).toStrictEqual([
    {
      sk: 'Moteur',
      title: 'Mistral · Moteur',
      rows: [['Puissance', '30 cv']],
    },
  ]);
});

test('chosenItems removes the unchecked rows and the emptied sections', () => {
  const list = chosenItems(BOATS, {
    ...NONE,
    offRow: ['Identité|Année', 'Moteur|Puissance'],
  });
  expect(list[0]?.sections).toStrictEqual([
    {
      sk: 'Identité',
      title: 'Mistral · Identité',
      rows: [['Type', 'Sloop']],
    },
  ]);
});

test('chosenItems honours the photo and thumbnail switches', () => {
  const noPhoto = chosenItems(BOATS, { ...NONE, offPh: ['p1'] });
  expect(noPhoto[0]?.photos).toStrictEqual([{ id: 'p2', cap: 'Photo 2' }]);
  const none = chosenItems(BOATS, { ...NONE, offSec: ['§photos', '§face'] });
  expect(none[0]?.photos).toStrictEqual([]);
  expect(none[0]?.face).toBeNull();
});

test('chosenItems leaves out an element with nothing left', () => {
  const list = chosenItems(BOATS, { ...NONE, offSec: ['Moteur'] });
  expect(list.map((item) => item.id)).toStrictEqual(['b1']);
});

test('chosenItems keeps a photo-only element', () => {
  const list = chosenItems(
    [
      {
        id: 'm',
        name: 'Léa',
        sections: [{ title: 'Léa', rows: [] }],
        photos: [{ id: 'p', cap: 'Photo 1' }],
      },
    ],
    NONE,
  );
  expect(list[0]?.sections).toStrictEqual([]);
  expect(list[0]?.photos).toStrictEqual([{ id: 'p', cap: 'Photo 1' }]);
});

test('chosenItems leaves a list without section keys untouched', () => {
  const item = {
    id: 'm1',
    name: 'M001',
    sections: [{ title: 'M001', rows: [['Date', 'x']] }],
  } as PublishItem;
  expect(chosenItems([item], NONE)[0]?.sections[0]).toBe(item.sections[0]);
});
