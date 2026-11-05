import { expect, test } from 'vitest';

import { prepTarifSuggest, prepTarifs } from '../prepTarif.ts';

const boat = {
  info: {
    name: '',
    tarifs: [
      'Journée en semaine : CHF 120.–',
      'Soir dès 17h00 en semaine : CHF 60.–',
      'Journée le week-end : CHF 150,50',
      '',
      'Soir dès 17h00 le week-end : CHF 80.–',
    ].join('\n'),
  },
};

test('prepTarifs reads one fare per line', () => {
  expect(prepTarifs(boat)).toStrictEqual([
    {
      index: 0,
      line: 'Journée en semaine : CHF 120.–',
      label: 'Journée en semaine',
      price: 'CHF 120.–',
      chf: '120',
    },
    {
      index: 1,
      line: 'Soir dès 17h00 en semaine : CHF 60.–',
      label: 'Soir dès 17h00 en semaine',
      price: 'CHF 60.–',
      chf: '60',
    },
    {
      index: 2,
      line: 'Journée le week-end : CHF 150,50',
      label: 'Journée le week-end',
      price: 'CHF 150,50',
      chf: '151',
    },
    {
      index: 3,
      line: 'Soir dès 17h00 le week-end : CHF 80.–',
      label: 'Soir dès 17h00 le week-end',
      price: 'CHF 80.–',
      chf: '80',
    },
  ]);
});

test('a line without colon or amount is its own label', () => {
  expect(prepTarifs({ info: { name: '', tarifs: 'Gratuit' } })).toStrictEqual([
    { index: 0, line: 'Gratuit', label: 'Gratuit', price: '', chf: '' },
  ]);
});

test('no boat, no fare', () => {
  expect(prepTarifs(null)).toStrictEqual([]);
});

test('the fare of a week day', () => {
  const { tarif, why } = prepTarifSuggest(boat, new Date(2026, 6, 15, 10, 30));
  expect(tarif?.index).toBe(0);
  expect(why).toBe('mercredi');
});

test('the evening starts at 16:30', () => {
  const { tarif, why } = prepTarifSuggest(boat, new Date(2026, 6, 15, 16, 30));
  expect(tarif?.index).toBe(1);
  expect(why).toBe('mercredi soir');
});

test('the fare of a week-end evening', () => {
  const { tarif, why } = prepTarifSuggest(boat, new Date(2026, 6, 18, 18, 0));
  expect(tarif?.index).toBe(3);
  expect(why).toBe('samedi soir');
});

test('no fare for the moment', () => {
  const { tarif } = prepTarifSuggest(
    { info: { name: '', tarifs: 'Gratuit' } },
    new Date(2026, 6, 18, 18, 0),
  );
  expect(tarif).toBeUndefined();
});
