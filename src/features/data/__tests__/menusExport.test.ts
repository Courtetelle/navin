import { beforeEach, expect, test } from 'vitest';

import { buildLakeOuting } from '../../../state/__tests__/buildSamples.ts';
import { initState, updateBoat, updateSettings } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { menusFile } from '../menusExport.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
  buildLakeOuting();
});

test('the menus file holds the lists of the boats, and nothing personal', () => {
  updateBoat('savannah', (boat) => {
    boat.checklistDep = [{ id: 'a', label: 'Gilets à bord' }];
    boat.ckVals = { a: 'secret value' };
  });
  updateSettings((settings) => {
    settings.windAlert = { ...settings.windAlert, mfKey: 'KEY-PRIVATE-123' };
  });
  const file = menusFile();
  const text = JSON.stringify(file);
  const savannah = file.boats.find((boat) => boat.id === 'savannah');
  expect(savannah?.lists.checklistDep).toStrictEqual([
    { id: 'a', label: 'Gilets à bord' },
  ]);
  expect(savannah?.lists).not.toHaveProperty('ckVals');
  expect(text).not.toContain('KEY-PRIVATE-123');
  expect(text).not.toContain('secret value');
  expect(text).not.toContain('Skipper');
  expect(file.kind).toBe('navin-menus');
});
