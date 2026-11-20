import { beforeEach, expect, test } from 'vitest';

import { buildLakeOuting } from '../../../state/__tests__/buildSamples.ts';
import { initState, updateBoat, updateCkLib } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { menusChanges, resetMenusChanges } from '../menusChanges.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
  buildLakeOuting();
});

test('the changes of the menus are listed since the starting point', () => {
  expect(menusChanges()).toStrictEqual([]);
  updateBoat('savannah', (boat) => {
    boat.checklistDep = [
      ...(boat.checklistDep ?? []),
      { id: 'new1', label: 'Installer les voiles' },
    ];
  });
  updateCkLib((library) => {
    const base = library[0];
    if (!base) return;
    base.items[0] = { ...base.items[0], label: 'Gilets portés' };
  });
  const said = menusChanges().map((change) => `${change.kind} ${change.said}`);

  expect(said).toContain('added Installer les voiles');
  expect(
    said.some(
      (line) => line.startsWith('renamed ') && line.endsWith('→ Gilets portés'),
    ),
  ).toBe(true);
  resetMenusChanges();

  expect(menusChanges()).toStrictEqual([]);
});
