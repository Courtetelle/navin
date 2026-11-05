import { expect, test } from 'vitest';

import { intlPhone, intlPhoneIn, normMemberPhones, telOf } from '../phone.ts';

test('intlPhone writes numbers in the international format', () => {
  expect([
    intlPhone('079 123 45 67'),
    intlPhone('0033 6 12 34 56 78'),
    intlPhone('+39 333 123 4567'),
    intlPhone('41791234567'),
    intlPhone('+1 555 123 4567'),
    intlPhone('12345'),
    intlPhone(''),
  ]).toStrictEqual([
    '+41 79 123 45 67',
    '+33 6 12 34 56 78',
    '+39 333 123 4567',
    '+41 79 123 45 67',
    '+1 555 123 4567',
    '+41 12 345',
    '',
  ]);
});

test('intlPhoneIn only reformats the numbers of a text', () => {
  expect(intlPhoneIn('Paul 079 765 43 21, bureau 0041 21 000 00 00')).toBe(
    'Paul +41 79 765 43 21, bureau +41 21 000 00 00',
  );
  expect(telOf('+41 79 123 45 67')).toBe('+41791234567');
});

test('normMemberPhones splits an old relative and rebuilds the summary', () => {
  expect(
    normMemberPhones({
      tel: '0791234567',
      proche: 'Paul Test 0041 79 765 43 21',
    }),
  ).toStrictEqual({
    tel: '+41 79 123 45 67',
    proche: 'Paul Test +41 79 765 43 21',
    procheTel: '+41 79 765 43 21',
    procheNom: 'Paul Test',
  });
  expect(normMemberPhones({ prenom: 'Ana', proche: '' })).toStrictEqual({
    prenom: 'Ana',
  });
});
