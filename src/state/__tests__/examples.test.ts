import { beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../storage/memoryStorage.ts';
import { store } from '../../storage/store.ts';
import { data } from '../data.ts';
import { purgeExamples } from '../examples.ts';
import { initState } from '../init.ts';

beforeEach(() => {
  initState(createMemoryStorage());
});

const boatIds = () => data.boats.value.map((boat) => boat.id);

test('it removes the examples once, and keeps the own boats and a copy', () => {
  expect(boatIds()).toContain('exb1');
  expect(data.marks.value.length).toBeGreaterThan(0);
  purgeExamples();
  expect(boatIds()).toStrictEqual(
    expect.arrayContaining(['savannah', 'inspiration']),
  );
  expect(boatIds().some((id) => id.startsWith('exb'))).toBe(false);
  expect(data.members.value).toStrictEqual([]);
  expect(data.crewSets.value).toStrictEqual([]);
  expect(data.marks.value).toStrictEqual([]);
  const copy = JSON.parse(store.raw('ldb.prePurge') as string) as {
    boats: Array<{ id: string }>;
  };
  expect(copy.boats.some((boat) => boat.id === 'exb1')).toBe(true);
  // Added again later, by a restored backup for example: left alone.
  data.marks.value = [{ id: 'exm1', note: 'Bouée devant Morges' }] as never;
  purgeExamples();
  expect(data.marks.value).toHaveLength(1);
});

test('an example used or renamed by the user stays', () => {
  store.set('ldb.cruise.c1', {
    id: 'c1',
    boatId: 'exb3',
    crew: [{ memberId: 'ex1' }],
    entries: [],
  });
  data.index.value = [{ id: 'c1', name: 'Sortie', created: '' }] as never;
  data.marks.value = data.marks.value.map((mark, index) =>
    index === 0 ? { ...mark, note: 'Mon repère' } : mark,
  );
  data.crewSets.value = [
    ...data.crewSets.value,
    { id: 'mine', name: 'Les miens', crew: [{ memberId: 'ex2' }] },
  ] as never;
  purgeExamples();
  expect(boatIds()).toContain('exb3');
  expect(boatIds()).not.toContain('exb1');
  const members = data.members.value.map((member) => member.id);
  expect(members).toStrictEqual(['ex1', 'ex2']);
  expect(data.crewSets.value.map((set) => set.id)).toStrictEqual(['mine']);
  expect(data.marks.value.map((mark) => mark.note)).toStrictEqual([
    'Mon repère',
  ]);
});
