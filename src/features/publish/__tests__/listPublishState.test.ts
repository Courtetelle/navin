import { beforeEach, expect, test, vi } from 'vitest';

import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend, store } from '../../../storage/store.ts';
import {
  keepOnly,
  toggleAllItems,
  toggleAllSections,
  toggleItem,
  togglePhoto,
  toggleRow,
  toggleSection,
} from '../listChoiceActions.ts';
import {
  activeTemplate,
  listChoice,
  listTemplatesOf,
  listTheme,
  prepareList,
  resetListPublishState,
} from '../listPublishState.ts';
import {
  addTemplate,
  renameTemplate,
  selectTemplate,
} from '../listTemplateActions.ts';
import { setShareTheme } from '../shareTheme.ts';

const stored = () => store.raw('ldb.lxTpl');

beforeEach(() => {
  setStorageBackend(createMemoryStorage());
  resetListPublishState();
});

test('opening a list creates its template in memory only', () => {
  prepareList('boats');
  expect(listTemplatesOf('boats')).toStrictEqual({
    act: 't1',
    list: [{ id: 't1', name: 'Modèle 1', offSec: [], offRow: [] }],
  });
  expect(stored()).toBeNull();
});

test('an empty storage has a default layout', () => {
  expect(listTheme('marks')).toBe('cards');
});

test('section, row and photo switches are saved in the active template', () => {
  prepareList('boats');
  toggleSection('boats', 'Moteur');
  toggleRow('boats', 'Identité|Année');
  togglePhoto('boats', 'p1');
  expect(stored()).toBe(
    '{"boats":{"act":"t1","list":[{"id":"t1","name":"Modèle 1","offSec":["Moteur"],"offRow":["Identité|Année"],"offPh":["p1"]}]}}',
  );
  toggleSection('boats', 'Moteur');
  expect(listChoice('boats').offSec).toStrictEqual([]);
});

test('elements switched off stay out of the storage', () => {
  prepareList('marks');
  toggleItem('marks', 'm1');
  expect(listChoice('marks').off).toStrictEqual(['m1']);
  expect(stored()).toBeNull();
  toggleItem('marks', 'm1');
  expect(listChoice('marks').off).toStrictEqual([]);
});

test('the master box of the elements checks all, then unchecks all', () => {
  prepareList('marks');
  toggleAllItems('marks', ['a', 'b']);
  expect(listChoice('marks').off).toStrictEqual(['a', 'b']);
  toggleAllItems('marks', ['a', 'b']);
  expect(listChoice('marks').off).toStrictEqual([]);
  toggleItem('marks', 'a');
  toggleAllItems('marks', ['a', 'b']);
  expect(listChoice('marks').off).toStrictEqual([]);
});

test('the master box of the sections keeps the photo switches', () => {
  prepareList('boats');
  toggleSection('boats', '§photos');
  toggleAllSections('boats', ['A', 'B']);
  expect(listChoice('boats').offSec).toStrictEqual(['§photos', 'A', 'B']);
  toggleSection('boats', 'A');
  toggleAllSections('boats', ['A', 'B']);
  expect(listChoice('boats').offSec).toStrictEqual(['§photos']);
});

test('keepOnly unchecks all the others, whatever the session did', () => {
  prepareList('people');
  toggleItem('people', 'x');
  keepOnly('people', ['a', 'b']);
  expect(listChoice('people').off).toStrictEqual(['a', 'b']);
});

test('every list takes the layout chosen in Réglages', () => {
  prepareList('crews');
  expect(listTheme('crews')).toBe('cards');
  setShareTheme('carnet');
  expect(listTheme('crews')).toBe('carnet');
  expect(listTheme('boats')).toBe('carnet');
  setShareTheme('cards');
});

test('addTemplate copies the active one and activates the copy', () => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
  prepareList('boats');
  toggleSection('boats', 'Moteur');
  addTemplate('boats');
  vi.useRealTimers();
  const added = {
    id: 'tlfls',
    name: 'Modèle 2',
    offSec: ['Moteur'],
    offRow: [],
    offPh: [],
    theme: 'cards',
  };
  expect(activeTemplate('boats')).toStrictEqual(added);
  expect(listTemplatesOf('boats').list).toHaveLength(2);
  expect(listChoice('boats').offSec).toStrictEqual(['Moteur']);
});

test('selectTemplate restores what the template switched off', () => {
  prepareList('boats');
  addTemplate('boats');
  toggleSection('boats', 'Moteur');
  selectTemplate('boats', 't1');
  expect(listChoice('boats').offSec).toStrictEqual([]);
  expect(listTemplatesOf('boats').act).toBe('t1');
});

test('renameTemplate renames, or deletes when emptied', () => {
  prepareList('boats');
  addTemplate('boats');
  expect(renameTemplate('boats', 'Assurance')).toBe(false);
  expect(activeTemplate('boats').name).toBe('Assurance');
  expect(renameTemplate('boats', '')).toBe(true);
  expect(listTemplatesOf('boats').list.map((item) => item.id)).toStrictEqual([
    't1',
  ]);
  expect(listTemplatesOf('boats').act).toBe('t1');
});

test('deleting the last template gives back a « Modèle 1 »', () => {
  prepareList('boats');
  toggleSection('boats', 'Moteur');
  renameTemplate('boats', '');
  expect(listTemplatesOf('boats')).toStrictEqual({
    act: 't1',
    list: [{ id: 't1', name: 'Modèle 1', offSec: [], offRow: [] }],
  });
  expect(listChoice('boats').offSec).toStrictEqual([]);
});

test('a stored template is read at the first opening', () => {
  store.set('ldb.lxTpl', {
    boats: {
      act: 'gone',
      list: [
        {
          id: 'tx',
          name: 'Assurance',
          offSec: ['Moteur'],
          offRow: ['A|b'],
          offPh: ['p'],
          theme: 'mini',
        },
      ],
    },
  });
  resetListPublishState();
  // The layout of a stored template gives way to the one of Réglages.
  expect(listTheme('boats')).toBe('cards');
  expect(listChoice('boats')).toStrictEqual({
    off: [],
    offSec: ['Moteur'],
    offRow: ['A|b'],
    offPh: ['p'],
  });
  expect(listTemplatesOf('boats').act).toBe('tx');
});
