import { beforeEach, expect, test } from 'vitest';

import { initState, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import {
  addPendingMembers,
  beginCrewSetEdit,
  choicePending,
  crewSetById,
  patchCrewsEdit,
  saveCrewsEdit,
  saveCrewsEditAsNew,
  setCrewPhotoCaption,
  setCrewsEditRole,
  toggleCrewsEditMember,
} from '../crewsEdit.ts';

beforeEach(() => {
  initState(createMemoryStorage());
  state.view.crewsEdit.value = null;
});

function seeded(id: string) {
  const set = crewSetById(id);
  if (!set) throw new Error(`no crew set ${id}`);
  return set;
}

test('a new composition is created with the first person chosen', () => {
  state.view.crewsEdit.value = { id: null, name: 'Du dimanche', crew: [] };
  const before = state.data.crewSets.value.length;

  saveCrewsEdit();
  expect(state.data.crewSets.value).toHaveLength(before);

  toggleCrewsEditMember('ex1');
  const id = state.view.crewsEdit.value.id;
  const set = crewSetById(id);

  expect(state.data.crewSets.value).toHaveLength(before + 1);
  expect(set?.ident).toBe('EQ004');
  expect(set?.name).toBe('Du dimanche');
  expect(set?.crew).toStrictEqual([{ memberId: 'ex1', fonction: 'Skipper' }]);

  toggleCrewsEditMember('ex2');

  expect(crewSetById(id)?.crew).toStrictEqual([
    { memberId: 'ex1', fonction: 'Skipper' },
    { memberId: 'ex2', fonction: 'Équipier' },
  ]);
});

test('a changed existing composition waits for the choice', () => {
  const crew = seeded('exc3').crew;
  beginCrewSetEdit('exc3');

  toggleCrewsEditMember('ex5');
  const edit = state.view.crewsEdit.value;

  expect(edit && choicePending(edit, seeded('exc3'))).toBe(true);
  expect(seeded('exc3').crew).toStrictEqual(crew);

  patchCrewsEdit({ mode: 'over' });
  saveCrewsEdit();

  expect(seeded('exc3').crew).toHaveLength(3);
  expect(seeded('exc3').ident).toBe('EQ003');
});

test('only the name of an unchanged composition is saved', () => {
  beginCrewSetEdit('exc3');
  patchCrewsEdit({ name: '  Nouveau nom ' });

  saveCrewsEdit();

  expect(seeded('exc3').name).toBe('Nouveau nom');

  patchCrewsEdit({ name: '' });
  saveCrewsEdit();

  expect(seeded('exc3').name).toBeUndefined();
});

test('« nouvel équipage » keeps the saved one and gets a new number', () => {
  const base = seeded('exc3');
  beginCrewSetEdit('exc3');
  toggleCrewsEditMember('ex5');

  const ident = saveCrewsEditAsNew(base);
  const edit = state.view.crewsEdit.value;

  expect(ident).toBe('EQ004');
  expect(seeded('exc3').crew).toHaveLength(2);
  expect(edit?.mode).toBe('new');
  expect(edit?.name).toBe('');
  expect(crewSetById(edit?.id ?? null)?.crew).toHaveLength(3);
  expect(crewSetById(edit?.id ?? null)?.name).toBeUndefined();
});

test('there is one skipper and one second only', () => {
  beginCrewSetEdit('exc1');
  patchCrewsEdit({ mode: 'over' });

  setCrewsEditRole(2, 'Skipper');

  expect(state.view.crewsEdit.value?.crew).toStrictEqual([
    { memberId: 'ex2', fonction: 'Équipier' },
    { memberId: 'ex1', fonction: 'Second' },
    { memberId: 'ex5', fonction: 'Skipper' },
  ]);
});

test('people created from the composition join it on the way back', () => {
  state.view.crewsEdit.value = {
    id: null,
    name: '',
    crew: [],
    pendingNew: new Set(
      state.data.members.value
        .filter((member) => member.id !== 'ex6')
        .map((member) => member.id),
    ),
  };

  addPendingMembers();
  const edit = state.view.crewsEdit.value;

  expect(edit?.crew).toStrictEqual([{ memberId: 'ex6', fonction: 'Skipper' }]);
  expect(edit?.pendingNew).toBeUndefined();
  expect(edit?.addedNew).toBe(true);
});

test('the caption is written without stamping a change', () => {
  beginCrewSetEdit('exc3');
  const signature = seeded('exc3')._sig;

  setCrewPhotoCaption('Au port');

  expect(seeded('exc3').photoCap).toBe('Au port');
  expect(seeded('exc3').mod).toBeUndefined();
  expect(seeded('exc3')._sig).toBe(signature);

  setCrewPhotoCaption('');

  expect(seeded('exc3').photoCap).toBeUndefined();
});
