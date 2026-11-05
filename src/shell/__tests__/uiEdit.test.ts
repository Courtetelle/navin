import { expect, test } from 'vitest';

import { editClasses } from '../uiEdit/applyUiEdit.tsx';
import { normalizeLabel, uiEditKey } from '../uiEdit/uiEditKey.ts';

test('a button key uses its id, else its data attributes, else its text', () => {
  expect(uiEditKey('view', 'boats', { id: 'addBoat', text: 'x' })).toBe(
    'boats|#addBoat',
  );
  expect(
    uiEditKey('view', 'more', {
      data: [
        ['data-go', 'cruises'],
        ['data-ue-key', 'ignored'],
        ['data-arg', '2'],
      ],
      text: 'x',
    }),
  ).toBe('more|data-go=cruises&data-arg=2');
  expect(uiEditKey('haut', 'more', { text: '  Mes   bateaux ' })).toBe(
    'haut|txt=Mes bateaux',
  );
  expect(uiEditKey('onglets', 'more', { text: 'data' })).toBe(
    'onglets|txt=data',
  );
});

test('labels are compared with their whitespace collapsed', () => {
  expect(normalizeLabel(' ⛵ Mes\n navigations ')).toBe('⛵ Mes navigations');
});

test('an edit adds size and long-text classes', () => {
  expect(editClasses({ size: 'xl', wrap: 'roll' })).toStrictEqual([
    'ue-xl',
    'ue-roll',
  ]);
  expect(editClasses({ size: 'm', wrap: 'wrap' })).toStrictEqual([]);
  expect(editClasses(undefined)).toStrictEqual([]);
});
