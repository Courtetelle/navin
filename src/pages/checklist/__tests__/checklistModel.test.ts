import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  checklistUi,
  selectChecklist,
} from '../../../features/checklists/checklistUi.ts';
import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import * as actions from '../../../state/actions.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { checklistModel } from '../checklistModel.ts';

beforeEach(() => {
  useHarnessWorld();
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
  checklistUi.list.value = null;
  checklistUi.editing.value = false;
  selectChecklist(null);
});
afterEach(leaveHarnessWorld);

test('the arrival list of the boat, with its counters and tabs', () => {
  const model = checklistModel();
  expect(model.list).toBe('dep');
  expect(model.ownerId).toBe('savannah');
  expect(model.boatName).toBe('Savannah');
  expect([model.doneCount, model.leftCount, model.canReset]).toStrictEqual([
    4,
    5,
    true,
  ]);
  expect(model.categories).toStrictEqual([
    'Check-in',
    'Léman',
    'Check-out',
    'Sécurité',
  ]);
  expect(model.tabs.map((tab) => [tab.name, tab.status])).toStrictEqual([
    ['Arrivée à bord', '5 restants'],
    ['Quitter le bateau', '8 restants'],
    ['Briefing sécurité', '13 restants'],
  ]);
});

test('each item shows its state, and its value once orange or green', () => {
  const rows = checklistModel().rows;
  expect(rows[0]?.state).toBe('done');
  expect(rows[4]?.state).toBe('red');
  expect(rows[4]?.label).toBe(
    'Allumer le moteur et relever les heures moteur : 1234,5 h',
  );
  expect(rows[5]?.state).toBe('');
  expect(rows[5]?.label).toBe('Checker le niveau de carburant');
  expect(rows[5]?.value).toBe('80');
});

test('the category filter keeps the list shown among the tabs', () => {
  actions.updateSettings((settings) => {
    settings.ckCat = 'Sécurité';
  });
  expect(checklistModel().tabs.map((tab) => tab.id.length > 4)).toStrictEqual([
    false,
    true,
  ]);
});

test('a free list is not a built-in one', () => {
  selectChecklist('quit');
  expect(checklistModel().builtin).toBe(true);
  const free = checklistModel().tabs[2]?.id ?? '';
  selectChecklist(free);
  const model = checklistModel();
  expect(model.builtin).toBe(false);
  expect(model.listName).toBe('Briefing sécurité');
  expect(model.listCategories).toStrictEqual(['Sécurité', 'Check-in']);
});
