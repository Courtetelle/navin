import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import * as actions from '../../../state/actions.ts';
import { state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { store } from '../../../storage/store.ts';
import type { ChecklistOwnerRecord } from '../checklistOwner.ts';
import {
  checklistOwner,
  ckCats,
  ckDefs,
  ckName,
  ckProp,
  ownerBoatId,
} from '../checklistOwner.ts';
import { ensureChecklistOwner, updateOwner } from '../ownerUpdates.ts';

beforeEach(() => {
  useHarnessWorld();
});
afterEach(leaveHarnessWorld);

function open(fixture: string): void {
  actions.initState(createMemoryStorage(readFixture(fixture)));
}

test('the boat of a lake outing owns the lists, otherwise the cruise', () => {
  open('sample-lake');
  expect(ownerBoatId()).toBe('savannah');
  expect(checklistOwner()?.id).toBe('savannah');
  open('sample-sea');
  expect(ownerBoatId()).toBeNull();
  expect(checklistOwner()?.id).toBe('mrltkr40tkny6');
  expect(ownerBoatId('exb1')).toBe('exb1');
  open('empty');
  expect(checklistOwner()).toBeNull();
});

test('a boat gets the briefing once, and its stamp changes', () => {
  open('sample-lake');
  ensureChecklistOwner();
  const boat = checklistOwner() as ChecklistOwnerRecord;
  expect(boat.briefSeeded).toBe(true);
  expect(boat.ckLists?.map((list) => list.name)).toStrictEqual([
    'Briefing sécurité',
  ]);
  const id = boat.ckLists?.[0]?.id ?? '';
  expect(boat[`ckx_${id}`]).toHaveLength(13);
  expect(store.get('ldb.boats.at', '')).toBe('2026-07-15T08:30:00.000Z');
  ensureChecklistOwner();
  expect((checklistOwner() as ChecklistOwnerRecord).ckLists).toHaveLength(1);
});

test('a sea cruise copies the template at its first opening', () => {
  open('sample-sea');
  expect(state.data.cruise.value?.checklistDep).toBeUndefined();
  ensureChecklistOwner();
  const cruise = state.data.cruise.value as ChecklistOwnerRecord;
  expect(cruise.checklistDep).toHaveLength(37);
  expect(cruise.ckLists?.map((list) => list.name)).toStrictEqual([
    'Briefing sécurité',
  ]);
  expect(state.data.seaTpl.value.briefSeeded).toBe(true);
  const template = state.data.seaTpl.value;
  const listId = template.ckLists?.[0]?.id ?? '';
  expect(template[`ckx_${listId}`]).toHaveLength(13);
  expect(
    store.get<{ briefSeeded?: boolean }>('ldb.tpl.mer', {}).briefSeeded,
  ).toBe(true);
});

test('the next sea cruise takes the free lists of the template', () => {
  open('sample-sea');
  ensureChecklistOwner();
  const template = state.data.seaTpl.value;
  const previous = state.data.cruise.value;
  actions.setCruise(actions.blankCruise('Grèce 2027'));
  ensureChecklistOwner();
  const cruise = state.data.cruise.value as ChecklistOwnerRecord;
  expect(cruise.id).not.toBe(previous?.id);
  expect(cruise.briefSeeded).toBe(true);
  expect(cruise.ckLists).toStrictEqual(template.ckLists);
});

test('list names and categories: built-in, renamed and free lists', () => {
  open('sample-lake');
  ensureChecklistOwner();
  expect(ckName('dep')).toBe('Arrivée à bord');
  expect(ckCats('dep')).toStrictEqual(['Check-in', 'Léman']);
  updateOwner('savannah', 'lacj', (owner) => {
    owner.ckMeta = { lacj: { dep: { name: 'À bord', cats: ['Léman'] } } };
  });
  expect(ckName('dep')).toBe('À bord');
  expect(ckCats('dep')).toStrictEqual(['Léman']);
  const free = ckDefs()[2];
  expect(free?.[2]).toBe('Briefing sécurité');
  expect(ckProp(free?.[0] ?? '')).toBe(free?.[1]);
  expect(ckCats(free?.[0] ?? '')).toStrictEqual(['Sécurité', 'Check-in']);
  expect(ckName('inconnue')).toBe('');
  expect(ckProp('inconnue')).toBe('ckx_inconnue');
  expect(ckCats('inconnue')).toStrictEqual([]);
});

test('a lake cruise uses its own built-in lists', () => {
  open('sample-lake');
  const boat = checklistOwner();
  expect(ckDefs('lacc', boat).slice(0, 2)).toStrictEqual([
    ['dep', 'checklistDepX', 'Arrivée à bord'],
    ['quit', 'checklistX', 'Fin de croisière'],
  ]);
});

test('changing the lists of a sea cruise changes the template of the next ones', () => {
  open('sample-sea');
  ensureChecklistOwner();
  updateOwner(null, 'mer', (owner) => {
    (owner.checklist as Array<{ id: string; label: string }>).push({
      id: 'n1',
      label: 'Rendre les clés',
    });
  });
  expect(state.data.seaTpl.value.checklist?.at(-1)?.label).toBe(
    'Rendre les clés',
  );
  expect(
    store.get<{ checklist?: unknown[] }>('ldb.tpl.mer', {}).checklist,
  ).toHaveLength(9);
});
