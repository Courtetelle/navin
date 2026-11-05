import { afterEach, beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { store } from '../../storage/store.ts';
import * as actions from '../actions.ts';
import { state } from '../index.ts';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from './parityHelpers.ts';

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
});
afterEach(leaveHarnessWorld);

test('mergeMembers normalizes the phones and replaces only when newer', () => {
  actions.mergeMembers(
    [
      { id: 'ex1', prenom: 'Camille', nom: 'Autre' },
      { id: 'new', prenom: 'Zoé', tel: '079 111 22 33' },
    ],
    '2000-01-01T00:00:00.000Z',
  );
  expect(
    state.data.members.value.find((member) => member.id === 'ex1')?.nom,
  ).toBe('Rochat');
  expect(
    state.data.members.value.find((member) => member.id === 'new')?.tel,
  ).toBe('+41 79 111 22 33');
  actions.mergeMembers(
    [{ id: 'ex1', prenom: 'Camille', nom: 'Autre' }],
    '2030-01-01T00:00:00.000Z',
  );
  expect(
    state.data.members.value.find((member) => member.id === 'ex1')?.nom,
  ).toBe('Autre');
  expect(store.get('ldb.members.at', '')).toBe('2030-01-01T00:00:00.000Z');
});

test('member fields follow the renamed and custom labels of the settings', () => {
  actions.updateSettings((settings) => {
    settings.memberAlias = { sante: 'Santé' };
    settings.memberCustom = [{ id: 'k1', label: 'Pointure' }];
  });
  const fields = actions.memberFieldsX();
  expect(fields.find((field) => field.key === 'sante')?.label).toBe('Santé');
  expect(fields.at(-1)).toStrictEqual({
    key: 'x_k1',
    label: 'Pointure',
    type: 'line',
    grow: true,
    wide: true,
  });
  expect(actions.memberKeysX().at(-1)).toBe('x_k1');
  const member = state.data.members.value.find((item) => item.id === 'ex5');
  if (!member) throw new Error('no ex5');
  expect(actions.memberName(member)).toBe('Noa Dubois');
  expect(actions.crewFromMember(member, 'Équipier')).toMatchObject({
    memberId: 'ex5',
    nom: 'Noa Dubois',
    fonction: 'Équipier',
    sexe: 'Non genré',
    procheNom: 'Claire Dubois',
  });
});

test('marks keep their sequence', () => {
  const mark = actions.addMark(46.123_456_7, 6.765_432_1, '12');
  expect(mark).toMatchObject({
    n: 13,
    name: 'M013',
    lat: 46.123_457,
    lon: 6.765_432,
    depth: '12',
    note: '',
  });
  actions.mergeMarks([
    {
      id: 'far',
      n: 40,
      name: 'M040',
      at: '',
      lat: 0,
      lon: 0,
      depth: '',
      note: '',
    },
    { id: 'exm1', n: 1 },
  ]);
  expect(store.get('ldb.markSeq', 0)).toBe(40);
  expect(state.data.marks.value.at(-1)?.id).toBe('far');
  actions.removeMark('far');
  expect(state.data.marks.value).toHaveLength(13);
  expect(actions.markName(7)).toBe('M007');
});

test('checklist bases merge by date and list all categories', () => {
  actions.mergeCkLib([
    {
      id: 'base-brief',
      name: 'Ancien',
      items: [],
      at: '2000-01-01T00:00:00.000Z',
    },
    { id: 'mine', name: 'Avitaillement', cats: ['Courses'], items: [] },
  ]);
  expect(
    state.data.ckLib.value.map((base) => [base.id, base.name]),
  ).toStrictEqual([
    ['base-brief', 'Briefing sécurité'],
    ['base-prise', 'Prise en main du bateau'],
    ['mine', 'Avitaillement'],
  ]);
  expect(actions.allCkCats(['Extra'])).toStrictEqual([
    'Check-in',
    'Check-out',
    'Croisière',
    'Léman',
    'Mer',
    'Avitaillement',
    'Sécurité',
    'Mouillage',
    'Entretien',
    'Courses',
    'Extra',
  ]);
  expect(store.get('ldb.ckLib.at', '')).toBe('2026-07-15T08:30:00.000Z');
  const owner: Record<string, unknown> = {};
  expect(actions.seedBrief(owner)).toBe(true);
  expect(actions.seedBrief(owner)).toBe(false);
  expect((owner.ckLists as Array<{ name: string }>)[0]?.name).toBe(
    'Briefing sécurité',
  );
});

test('task template and button customizations', () => {
  expect(state.data.taskTpl.value?.first).toBe('soir');
  expect(actions.hasAboard()).toBe(false);
  actions.updateTaskTpl((template) => {
    template.first = 'midi';
  });
  expect(store.get('ldb.taskTpl', { first: '', at: '' })).toMatchObject({
    first: 'midi',
    at: '2026-07-15T08:30:00.000Z',
  });
  actions.resetTaskTpl();
  expect(state.data.taskTpl.value?.first).toBe('soir');
  expect(
    actions.mergeUiEdits({ a: { label: 'A', at: '2026-01-01' }, b: 'bad' }),
  ).toBe(1);
  expect(actions.mergeUiEdits({ a: { label: 'old', at: '2025-01-01' } })).toBe(
    0,
  );
  expect(store.get('ldb.uiEdits', {})).toStrictEqual({
    a: { label: 'A', at: '2026-01-01' },
  });
});
