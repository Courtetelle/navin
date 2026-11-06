import { afterEach, expect, test, vi } from 'vitest';

import type { FieldDefinition } from '../../../../model/field.ts';
import {
  drawFieldIds,
  drawnForm,
  markReleased,
  newFieldId,
} from '../fieldIds.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

test('an id is built like legacy', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  expect(newFieldId('loch')).toBe('f_loch_i');
});

test('every wrapping level draws one random value', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const fields: FieldDefinition[] = [
    { key: 'plain', type: 'line' },
    { key: 'en', type: 'line', en: true },
    { key: 'both', type: 'line', en: true, reveal: true },
    {
      key: 'cycle',
      type: 'line',
      labelCycle: { key: 'kind', options: ['A'] },
    },
    {
      key: 'group',
      type: 'group',
      fields: [
        { key: 'sub1', type: 'line' },
        { key: 'sub2', type: 'line', addMore: { key: 'x', label: 'x' } },
      ],
    },
  ];
  const ids = drawFieldIds(fields);
  expect(random).toHaveBeenCalledTimes(1 + 2 + 3 + 2 + 1 + 1 + 2);
  expect([...ids.keys()]).toStrictEqual([
    'plain',
    'en',
    'both',
    'cycle',
    'group',
    'sub1',
    'sub2',
  ]);
});

test('a form draws its ids once per screen', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const fields: FieldDefinition[] = [{ key: 'a', type: 'line' }];
  const first = drawnForm(1, 'form', fields);
  expect(drawnForm(1, 'form', fields)).toBe(first);
  expect(random).toHaveBeenCalledTimes(1);
  drawnForm(1, 'other', fields);
  expect(random).toHaveBeenCalledTimes(2);
  drawnForm(2, 'form', fields);
  expect(random).toHaveBeenCalledTimes(3);
});

test('a form that left the screen draws again when it comes back', () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const fields: FieldDefinition[] = [{ key: 'a', type: 'line' }];
  const form = drawnForm(3, 'form', fields);
  markReleased(form, true);
  markReleased(form, false);
  expect(drawnForm(3, 'form', fields)).toBe(form);
  markReleased(form, true);
  expect(drawnForm(3, 'form', fields)).not.toBe(form);
  expect(random).toHaveBeenCalledTimes(2);
});
