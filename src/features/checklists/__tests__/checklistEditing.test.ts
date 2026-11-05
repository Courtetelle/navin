import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import * as actions from '../../../state/actions.ts';
import { state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { addBaseToOuting, saveAsBase } from '../checklistBases.ts';
import {
  checklistCopyText,
  ckIcon,
  ckUnitLabel,
  fromBaseItems,
  toBaseItems,
} from '../checklistEditing.ts';
import { checklistOwner, ckName } from '../checklistOwner.ts';
import {
  checklistUi,
  selectChecklist,
  toggleShownPhotos,
} from '../checklistUi.ts';

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
  checklistUi.list.value = null;
  checklistUi.shownPhotos.value = new Set();
});
afterEach(leaveHarnessWorld);

test('icons and unit labels', () => {
  expect([ckIcon('dep'), ckIcon('quit'), ckIcon('abc')]).toStrictEqual([
    '⛵',
    '🔒',
    '📋',
  ]);
  expect([ckUnitLabel(''), ckUnitLabel('nb'), ckUnitLabel('%')]).toStrictEqual([
    'pas de valeur',
    'nombre sans unité',
    '%',
  ]);
});

test('a base keeps label, unit and note but neither ids nor readings', () => {
  expect(
    toBaseItems([
      { id: 'a', label: 'Gaz', note: 'Vanne', unit: 'bar', action: 'sheet' },
      { id: 'b', label: 'Relevés', action: 'releves' },
      { id: 'c', label: 'Moteur', key: 'moteurDebut', unit: 'h' },
      { id: 'd', label: 'Gilets' },
    ]),
  ).toStrictEqual([
    { label: 'Gaz', unit: 'bar', note: 'Vanne' },
    { label: 'Gilets' },
  ]);
});

test('items taken from a base get new ids', () => {
  const items = fromBaseItems([{ label: 'Eau', unit: 'L' }, { label: 'Pain' }]);
  expect(items.map((item) => item.label)).toStrictEqual(['Eau', 'Pain']);
  expect(items[0]?.unit).toBe('L');
  expect(items[0]?.id).not.toBe(items[1]?.id);
  expect(items[0]?.id).toMatch(/^[a-z0-9]+$/);
});

test('text of a copied list', () => {
  const items = [
    { id: 'a', label: 'Gaz', unit: 'bar' },
    { id: 'b', label: 'Pression :', unit: 'nb' },
    { id: 'c', label: 'Gilets' },
  ];
  expect(checklistCopyText('Savannah', items)).toBe(
    'Check-in Savannah :\n1. Gaz [bar]\n2. Pression : [nombre]\n3. Gilets',
  );
  expect(checklistCopyText(null, [])).toBe('Check-in  :\n');
});

test('saving a list as base replaces the base of the same name, case aside', () => {
  const before = state.data.ckLib.value.length;
  saveAsBase('Avitaillement', ['Mer'], [{ id: 'a', label: 'Eau' }]);
  expect(state.data.ckLib.value).toHaveLength(before + 1);
  const created = state.data.ckLib.value.at(-1);
  saveAsBase('AVITAILLEMENT', [], [{ id: 'b', label: 'Pain' }]);
  expect(state.data.ckLib.value).toHaveLength(before + 1);
  const updated = state.data.ckLib.value.at(-1);
  expect(updated?.id).toBe(created?.id);
  expect(updated?.name).toBe('AVITAILLEMENT');
  expect(updated?.items).toStrictEqual([{ label: 'Pain' }]);
});

test('a base added to the outing becomes a list of its boat', () => {
  const base = state.data.ckLib.value.find((item) => item.seed === 'prise');
  const id = addBaseToOuting(base as NonNullable<typeof base>);
  expect(ckName(id)).toBe('Prise en main du bateau');
  expect(checklistOwner()?.[`ckx_${id}`]).toHaveLength(25);
});

test('the list shown: asked for, remembered, otherwise the one to do', () => {
  selectChecklist(null);
  expect(checklistUi.list.value).toBe('dep');
  selectChecklist('quit');
  selectChecklist(null);
  expect(checklistUi.list.value).toBe('quit');
  selectChecklist('supprimée');
  expect(checklistUi.list.value).toBe('dep');
  state.data.prep.value = { step: 4 };
  selectChecklist('quit');
  expect(checklistUi.list.value).toBe('dep');
});

test('opening the list creates the day in memory only', () => {
  actions.updateCruise((cruise) => {
    delete cruise.days['2026-07-15'];
  });
  selectChecklist(null);
  expect(state.data.cruise.value?.days['2026-07-15']).toStrictEqual({});
});

test('photos of a green item are shown and hidden', () => {
  toggleShownPhotos('d1');
  expect([...checklistUi.shownPhotos.value]).toStrictEqual(['d1']);
  toggleShownPhotos('d1');
  expect([...checklistUi.shownPhotos.value]).toStrictEqual([]);
});
