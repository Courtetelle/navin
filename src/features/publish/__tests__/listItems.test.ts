import { expect, test } from 'vitest';

import type { FieldDefinition } from '../../../model/field.ts';
import type { CrewSet, Member } from '../../../model/types.ts';
import { boatItems, crewItems, memberRows, peopleItems } from '../listItems.ts';

const FIELDS = [
  { key: 'prenom', label: 'Prénom' },
  { key: 'tel', label: 'Téléphone (avec indicatif)' },
  { key: 'sexe', label: 'Sexe', show: { Femme: '♀' } },
  { key: 'langues', label: 'Langues (un par ligne)' },
  {
    key: 'pieceNo',
    label: 'Pièce',
    labelCycle: {
      key: 'pieceType',
      options: ['Passeport', 'Carte d’identité'],
      suffix: ' n°',
    },
  },
  { key: 'vide', label: 'Vide' },
  { key: 'rien', label: 'Rien' },
] as FieldDefinition[];

const nameOf = (member: Member) =>
  [member.prenom, member.nom].filter(Boolean).join(' ');

test('memberRows keeps the filled fields with their displayed labels', () => {
  const rows = memberRows(
    {
      id: 'm',
      prenom: 'Léa',
      tel: '+41 79 000 00 00',
      sexe: 'Femme',
      langues: ['fr', 'en'],
      pieceNo: 'X123',
      vide: '',
      rien: [],
    },
    FIELDS,
  );
  expect(rows).toStrictEqual([
    ['Prénom', 'Léa'],
    ['Téléphone', '+41 79 000 00 00'],
    ['♂ / ♀', '♀'],
    ['Langues', 'fr, en'],
    ['Passeport n°', 'X123'],
  ]);
});

test('memberRows follows the cycled label chosen on the card', () => {
  const rows = memberRows(
    { id: 'm', pieceNo: 'X123', pieceType: 'Carte d’identité' },
    FIELDS,
  );
  expect(rows).toStrictEqual([['Carte d’identité n°', 'X123']]);
});

test('peopleItems sorts by name and captions the photos', () => {
  const items = peopleItems(
    [
      {
        id: 'b',
        prenom: 'Élodie',
        photos: [{ id: 'p1' }, { id: 'p2', cap: 'Bord' }],
      },
      { id: 'a', prenom: 'Eric' },
      { id: 'c' },
    ],
    FIELDS,
    nameOf,
  );
  expect(items.map((item) => item.name)).toStrictEqual(['…', 'Élodie', 'Eric']);
  expect(items[1]).toStrictEqual({
    id: 'b',
    name: 'Élodie',
    sections: [{ title: 'Élodie', rows: [['Prénom', 'Élodie']] }],
    photos: [
      { id: 'p1', cap: 'Photo 1' },
      { id: 'p2', cap: 'Bord' },
    ],
    face: 'b',
  });
});

test('crewItems numbers the people with their gendered role', () => {
  const members: Member[] = [
    { id: 'm1', prenom: 'Léa', sexe: 'Femme' },
    { id: 'm2', prenom: 'Luc' },
  ];
  const sets = [
    {
      id: 's1',
      ident: 'EQ001',
      name: 'Régate',
      crew: [
        { memberId: 'm1', fonction: 'Équipier' },
        { memberId: 'm2' },
        { memberId: 'gone' },
      ],
      photo: 'ph',
      photoCap: 'Au port',
    },
    { id: 's2', ident: 'EQ002', crew: [] },
  ] as CrewSet[];
  const items = crewItems(sets, members, {
    nameOf: (set) => set.name || set.ident || '',
    dateOf: (set) => (set.name ? 'créé le 01.07.2026' : ''),
    memberNameOf: nameOf,
  });
  expect(items.map((item) => item.name)).toStrictEqual(['EQ002', 'Régate']);
  expect(items[0]?.sections[0]?.rows).toStrictEqual([['Personnes', '–']]);
  expect(items[0]?.photos).toStrictEqual([]);
  expect(items[1]).toStrictEqual({
    id: 's1',
    name: 'Régate',
    sections: [
      {
        title: 'Régate',
        rows: [
          ['Numéro', 'EQ001'],
          ['Personnes', '1. Léa · Équipière\n2. Luc\n3. ?'],
          ['Date', 'créé le 01.07.2026'],
          ['Photo', 'Au port'],
        ],
      },
    ],
    photos: [{ id: 'ph', cap: 'Au port' }],
  });
});

test('boatItems prefixes the first section and drops the boat name line', () => {
  const items = boatItems([
    {
      id: 'b1',
      name: 'Mistral',
      hasThumb: true,
      sections: [
        {
          title: 'Bateau',
          rows: [
            ['Nom du bateau', 'Mistral'],
            ['Type', 'Sloop'],
          ],
        },
        { title: 'Vide', rows: [['Nom du bateau', 'Mistral']] },
        { title: 'Moteur', rows: [['Puissance', '30 cv']] },
      ],
      photos: [{ id: 'd1' }, { id: 'd2', cap: 'Pont' }],
    },
  ]);
  expect(items).toStrictEqual([
    {
      id: 'b1',
      name: 'Mistral',
      face: 'b1',
      faceRect: true,
      sections: [
        { sk: 'Bateau', title: 'Mistral · Bateau', rows: [['Type', 'Sloop']] },
        { sk: 'Moteur', title: 'Moteur', rows: [['Puissance', '30 cv']] },
      ],
      photos: [
        { id: 'd1', cap: 'Photo 1' },
        { id: 'd2', cap: 'Pont' },
      ],
    },
  ]);
});

test('boatItems has no thumbnail when its document is gone', () => {
  const [item] = boatItems([
    { id: 'b', name: 'B', hasThumb: false, sections: [], photos: [] },
  ]);
  expect(item?.face).toBeNull();
  expect(item?.sections).toStrictEqual([]);
});
