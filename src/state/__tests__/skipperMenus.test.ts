import { afterEach, beforeEach, expect, test } from 'vitest';

import type { Boat } from '../../model/types.ts';
import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { setStorageBackend } from '../../storage/store.ts';
import { state } from '../index.ts';
import { applySkipperMenus } from '../skipperMenus.ts';

beforeEach(() => {
  setStorageBackend(createMemoryStorage());
});
afterEach(() => {
  state.data.boats.value = [];
  setStorageBackend(null);
});

const labels = () =>
  (state.data.boats.value[0]?.checklistDep ?? []).map((item) => item.label);

test('the day check-in of the Savannah as the skipper sent it, once', () => {
  state.data.boats.value = [
    {
      id: 'savannah',
      info: {},
      checklistDep: [
        { id: 'a', label: 'Consulter la météo et les feux d’avis de tempête' },
        { id: 'b', label: 'Gilets de sauvetage pour tout l’équipage' },
        { id: 'c', label: 'Sortir la bouée fer à cheval' },
        { id: 'd', label: 'Mettre le contact' },
        { id: 'e', label: 'Checker le niveau de carburant', key: 'carbPct' },
        { id: 'f', label: 'Vérifier le carburant' },
      ],
    },
  ];
  applySkipperMenus();
  expect(labels()).toStrictEqual([
    'Consulter la météo et les feux d’avis de tempête',
    'Gilets de sauvetage pour tout l’équipage',
    'Installer la bouée fer à cheval',
    'Checker le niveau de carburant',
    'Installer les voiles',
  ]);
  // Changed again on the device: left as it is.
  state.data.boats.value = [
    { ...state.data.boats.value[0], checklistDep: [] } as unknown as Boat,
  ];
  applySkipperMenus();
  expect(labels()).toStrictEqual([]);
});
