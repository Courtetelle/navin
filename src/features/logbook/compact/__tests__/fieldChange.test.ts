import { expect, test } from 'vitest';

import type { FieldDefinition } from '../../../../model/field.ts';
import { SETTINGS_DEFAULTS } from '../../../../model/settings.ts';
import {
  applyFieldChange,
  cycleDisplay,
  cycleText,
  drawnSections,
  gridItems,
  nextOption,
} from '../fieldChange.ts';

const settings = { ...SETTINGS_DEFAULTS };
const SOURCE = 'pairSrc_loa_loaFt';

function line(
  key: string,
  extra: Partial<FieldDefinition> = {},
): FieldDefinition {
  return { key, type: 'line', ...extra };
}

test('a value is stored and an empty value removed', () => {
  const fields = [line('a')];
  expect(applyFieldChange({}, 'a', 'x', fields, settings)).toStrictEqual({
    a: 'x',
  });
  expect(
    applyFieldChange({ a: 'x', b: 1 }, 'a', '', fields, settings),
  ).toStrictEqual({ b: 1 });
  expect(applyFieldChange({ a: 'x' }, 'a', [], fields, settings)).toStrictEqual(
    {},
  );
  expect(
    applyFieldChange({ a: 'x' }, 'a', null, fields, settings),
  ).toStrictEqual({});
});

test('the given values are not changed', () => {
  const data = Object.freeze({ a: 'x' });
  expect(applyFieldChange(data, 'a', 'y', [line('a')], settings)).toStrictEqual(
    { a: 'y' },
  );
  expect(data).toStrictEqual({ a: 'x' });
});

test('a value equal to the computed one goes back to automatic', () => {
  const fields = [line('a', { auto: () => '12' })];
  expect(applyFieldChange({}, 'a', '12', fields, settings)).toStrictEqual({});
  expect(applyFieldChange({}, 'a', '13', fields, settings)).toStrictEqual({
    a: '13',
  });
});

test('the first filled field of a pair is remembered as the base', () => {
  const fields = [
    line('loa', { pair: 'loaFt', auto: () => '' }),
    line('loaFt', { pair: 'loa', auto: () => '' }),
  ];
  expect(applyFieldChange({}, 'loaFt', '30', fields, settings)).toStrictEqual({
    loaFt: '30',
    [SOURCE]: 'loaFt',
  });
  expect(
    applyFieldChange(
      { loaFt: '30', [SOURCE]: 'loaFt' },
      'loa',
      '9',
      fields,
      settings,
    ),
  ).toStrictEqual({ loaFt: '30', loa: '9', [SOURCE]: 'loaFt' });
  expect(
    applyFieldChange(
      { loa: '9', loaFt: '30', [SOURCE]: 'loaFt' },
      'loaFt',
      '',
      fields,
      settings,
    ),
  ).toStrictEqual({ loa: '9', [SOURCE]: 'loa' });
});

test('grid items keep pairs and frames together', () => {
  const fields = [
    line('a', { pairNext: true }),
    line('b'),
    line('c', { frame: 'f' }),
    line('d', { frame: 'f' }),
    line('e', { frame: 'g' }),
    line('h'),
  ];
  const keys = gridItems(fields).map((item) =>
    item.kind === 'field'
      ? item.field.key
      : `${item.kind}:${item.fields.map((field) => field.key).join('+')}`,
  );
  expect(keys).toStrictEqual(['pair:a+b', 'frame:c+d', 'frame:e', 'h']);
});

test('a pair field without next field stays alone', () => {
  expect(gridItems([line('a', { pairNext: true })])).toHaveLength(1);
  expect(gridItems([line('a', { pairNext: true })])[0]?.kind).toBe('field');
});

test('a flat form draws only its first section', () => {
  const first = { fields: [line('a')] };
  const second = { fields: [line('b')] };
  expect(drawnSections([first, second], true)).toStrictEqual([first]);
  expect(drawnSections([first, second], false)).toStrictEqual([first, second]);
});

test('cycle text: value, own display, or the choices', () => {
  const show = { '': 'Sans', Bâbord: '< Bâbord', Tribord: 'Tribord >' };
  expect(cycleText(undefined, '', ['A', 'B'])).toBe('A / B');
  expect(cycleText(undefined, 'B', ['A', 'B'])).toBe('B');
  expect(cycleText(show, '', ['Bâbord', 'Tribord'])).toBe('Sans');
  expect(cycleText(show, 'Bâbord', ['Bâbord'])).toBe('< Bâbord');
  expect(cycleText({ A: 'en a', B: 'en b' }, '', ['A', 'B'])).toBe(
    'en a / en b',
  );
  expect(cycleText({ A: '< a', B: 'b >' }, '', ['A', 'B'])).toBe('< a  b >');
});

test('cycle display drops the arrows', () => {
  expect(cycleDisplay({ Bâbord: '< Bâbord' }, 'Bâbord')).toBe('Bâbord');
  expect(cycleDisplay(undefined, 'Sans')).toBe('Sans');
});

test('next option wraps and starts at the first one', () => {
  expect(nextOption(['A', 'B'], '')).toBe('A');
  expect(nextOption(['A', 'B'], 'A')).toBe('B');
  expect(nextOption(['A', 'B'], 'B')).toBe('A');
});
