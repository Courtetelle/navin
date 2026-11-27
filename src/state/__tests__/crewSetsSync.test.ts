import { beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import * as actions from '../actions.ts';
import { state } from '../index.ts';

function byId(id: string) {
  return state.data.crewSets.value.find((set) => set.id === id);
}

beforeEach(() => {
  actions.initState(createMemoryStorage({}));
  actions.updateCrewSets((sets) => {
    sets.push(
      { id: 'a', name: 'Bretagne', crew: [], mod: '2026-01-01T00:00:00.000Z' },
      { id: 'b', name: 'Léman', crew: [], mod: '2026-01-01T00:00:00.000Z' },
    );
  });
});

test('a crew changed here takes the time of its change', () => {
  actions.updateCrewSets((sets) => {
    const set = sets.find((item) => item.id === 'a');
    if (set) set.name = 'Bretagne Nord';
  });
  const changed = byId('a');
  const same = byId('b');
  expect(changed?.mod).not.toBe('2026-01-01T00:00:00.000Z');
  expect(same?.mod).toBe('2026-01-01T00:00:00.000Z');
});

test('a crew replaced by a newer copy keeps the time of that copy', () => {
  actions.updateCrewSets((sets) => {
    const at = sets.findIndex((set) => set.id === 'b');
    sets[at] = {
      id: 'b',
      name: 'Léman',
      crew: [],
      mod: '2026-02-01T00:00:00.000Z',
    };
  });
  expect(state.data.crewSets.value.find((set) => set.id === 'b')?.mod).toBe(
    '2026-02-01T00:00:00.000Z',
  );
});
