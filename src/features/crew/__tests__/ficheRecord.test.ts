import { expect, test } from 'vitest';

import {
  cardFromForm,
  packRelatives,
  photosOf,
  shownRelatives,
} from '../ficheRecord.ts';

const names = { prenom: 'Léa', nom: 'Favre' };

test('only the filled fields of the card are saved, phones international', () => {
  const card = cardFromForm(
    'm1',
    names,
    { tel: '0791234567', lieu: '', autre: 'ignoré', sante: 'Aucune' },
    ['tel', 'lieu', 'sante'],
  );

  expect(card).toStrictEqual({
    id: 'm1',
    prenom: 'Léa',
    nom: 'Favre',
    tel: '+41 79 123 45 67',
    sante: 'Aucune',
  });
});

test('the framing of a photo that is gone is dropped', () => {
  const photos = [{ id: 'p1', t: '2026-07-15T08:00:00.000Z' }];
  const kept = { id: 'p1', x: 0.5, y: 0.4, z: 2 };

  expect(cardFromForm('m1', names, { photos, face: kept }, [])).toStrictEqual({
    id: 'm1',
    ...names,
    photos,
    face: kept,
  });
  expect(
    cardFromForm('m1', names, { photos, face: { ...kept, id: 'gone' } }, []),
  ).toStrictEqual({ id: 'm1', ...names, photos });
  expect(cardFromForm('m1', names, { photos: [] }, [])).toStrictEqual({
    id: 'm1',
    ...names,
  });
});

test('photosOf reads an absent list as empty', () => {
  expect(photosOf({})).toStrictEqual([]);
});

test('the form shows up to the last filled relative', () => {
  expect(shownRelatives({})).toBe(1);
  expect(shownRelatives({ procheNom: 'A' })).toBe(1);
  expect(shownRelatives({ proche2Tel: '+41' })).toBe(2);
  expect(shownRelatives({ proche3Nom: 'C' })).toBe(3);
});

test('an emptied second relative lets the third one move up', () => {
  const packed = packRelatives({
    procheNom: 'A',
    proche2Nom: ' ',
    proche3Nom: 'C',
    proche3Tel: '+41 79',
  });

  expect(packed).toStrictEqual({
    data: { procheNom: 'A', proche2Nom: 'C', proche2Tel: '+41 79' },
    shown: 2,
    changed: true,
  });
});

test('relatives already in place change nothing', () => {
  const data = { proche2Nom: 'B', proche2Tel: '+41' };

  expect(packRelatives(data)).toStrictEqual({ data, shown: 2, changed: false });
  expect(packRelatives({})).toStrictEqual({
    data: {},
    shown: 1,
    changed: false,
  });
});
