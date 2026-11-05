import { expect, test } from 'vitest';

import { radioDesc, sailColCss, sailLineTexts } from '../boatDescription.ts';
import { colorEn, colorEnOrder, descEn } from '../translate.ts';

const SAVANNAH = {
  model: 'Hanse 325 quille courte',
  loaFt: '31,6',
  hullColor: 'Blanche',
  marking: 'bande bleue',
  gvColor: 'blanche',
  voilesAvant: 'Génois, Spi',
  voilesColor: ['', 'rouge'],
  voilesDesc: ['', 'étoile jaune'],
};

test('descEn puts colours before their noun and translates known words', () => {
  expect([
    descEn('bande bleue et blanche'),
    descEn('nom en lettres rouges, bande bleue, logo'),
    descEn('coque vert foncé avec une étoile'),
    descEn("Logo à l'avant, dauphin"),
    descEn(''),
  ]).toStrictEqual([
    'blue and white stripe',
    'name in red letters, blue stripe, logo',
    'dark green hull with star',
    'logo at the bow, dolphin',
    '',
  ]);
});

test('colorEnOrder puts the shade first', () => {
  expect([
    colorEnOrder('bleu marine'),
    colorEnOrder('blanche et bleue'),
    colorEnOrder('vert foncé'),
    colorEn('Rouge, blanc'),
  ]).toStrictEqual(['navy blue', 'white and blue', 'dark green', 'red, white']);
});

test('radioDesc builds the French and English radio descriptions', () => {
  expect(radioDesc(SAVANNAH, 'fr')).toBe(
    'Voilier Hanse 325, 32 pieds (9,6 m), coque Blanche, sur la coque : bande bleue, grand-voile (blanche), spi (rouge, étoile jaune)',
  );
  expect(radioDesc(SAVANNAH, 'en')).toBe(
    'Sailing yacht Hanse 325, 32 feet, white hull, on the hull: blue stripe, mainsail (white), spinnaker (red, yellow star)',
  );
  const dufour = {
    model: 'Dufour 530 (2024)',
    loa: '16,35',
    sailColor: 'bleu marine',
  };
  expect(radioDesc(dufour, 'en')).toBe(
    'Sailing yacht Dufour 530, 54 feet, navy blue sails',
  );
  expect(radioDesc(dufour, 'fr')).toBe(
    'Voilier Dufour 530, 54 pieds (16,35 m), voiles bleu marine',
  );
  expect(radioDesc({ desc: 'Forced text' }, 'en')).toBe('Forced text');
  expect(radioDesc({ desc: 'Forced text' }, 'en', true)).toBe('Sailing yacht');
});

test('sail helpers give the colour and the two lines under a sail', () => {
  expect(sailColCss('bleu marine')).toBe('#16264f');
  expect(sailColCss('inconnue')).toBe('transparent');
  expect(sailLineTexts('Spi', 'rouge', 'étoile jaune')).toStrictEqual({
    fr: 'Spi : rouge, étoile jaune',
    en: 'Red spinnaker, yellow star',
  });
  expect(sailLineTexts('Foc', '', '')).toBeNull();
});
