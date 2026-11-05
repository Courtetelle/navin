import { expect, test } from 'vitest';

import { lakeMessage, vhfSettingKey } from '../vhfContext.ts';

test('the lake message without any data keeps its blanks', () => {
  expect(
    lakeMessage({
      boat: '',
      registration: '',
      position: null,
      french: false,
      onBoard: 0,
      description: '',
    }),
  ).toStrictEqual([
    'Ici le voilier (nom du bateau).',
    'Position : (position GPS).',
    'Nature du problème : (homme à la mer, voie d’eau, avarie, malaise…).',
    'Nous sommes (nombre) personnes à bord.',
    'Aide demandée : (remorquage, secours, médecin…).',
    'Description : (coque, voiles).',
  ]);
});

test('the lake message names the boat, the side and the crew', () => {
  expect(
    lakeMessage({
      boat: 'Savannah',
      registration: 'VD 123',
      position: { lat: 46.418, lon: 6.72 },
      french: true,
      onBoard: 1,
      description: 'Voilier blanc',
    }),
  ).toStrictEqual([
    'Ici le voilier Savannah, immatriculé VD 123.',
    "Position : 46°25,080' N  006°43,200' E, côté français du Léman.",
    'Nature du problème : (homme à la mer, voie d’eau, avarie, malaise…).',
    'Nous sommes 1 personne à bord.',
    'Aide demandée : (remorquage, secours, médecin…).',
    'Description : Voilier blanc.',
  ]);
});

test('station and channel are remembered per call', () => {
  expect(vhfSettingKey('chan', 'berth')).toBe('chan_berth');
  expect(vhfSettingKey('station', 'fuel')).toBe('station_fuel');
  expect(vhfSettingKey('eta', 'berth')).toBe('eta');
});
