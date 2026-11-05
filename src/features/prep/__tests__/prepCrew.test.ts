import { beforeEach, expect, test } from 'vitest';

import {
  blankCruise,
  initState,
  saveCruise,
  setCruise,
  setPrep,
  state,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { applyCrewSet, crewKey, crewSetFromCruise } from '../prepCrew.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
});

function openCruise(): void {
  setCruise(blankCruise('Test', null));
  saveCruise();
}

test('crewKey ignores the order and sees the roles', () => {
  const first = { memberId: 'a', fonction: 'Skipper' };
  const second = { memberId: 'b' };
  expect(crewKey([first, second])).toBe(crewKey([second, first]));
  expect(crewKey([first, second])).toBe('a:Skipper|b:');
});

test('applyCrewSet puts the known people on board and forgets the fresh flag', () => {
  openCruise();
  setPrep({ step: 3, fresh: true });
  const applied = applyCrewSet({
    crew: [
      { memberId: 'ex2', fonction: 'Skipper' },
      { memberId: 'nobody', fonction: 'Équipier' },
    ],
  });
  expect(applied).toBe(true);
  expect(state.data.prep.value).toStrictEqual({ step: 3 });
  expect(state.data.cruise.value?.crew).toHaveLength(1);
  expect(state.data.cruise.value?.crew[0]?.nom).toBe('Thomas Keller');
  expect(state.data.cruise.value?.crew[0]?.fonction).toBe('Skipper');
});

test('applyCrewSet needs an open cruise', () => {
  expect(applyCrewSet({ crew: [] })).toBe(false);
});

test('crewSetFromCruise is null without anyone from the cards', () => {
  openCruise();
  expect(crewSetFromCruise()).toBeNull();
});

test('crewSetFromCruise finds the same people and roles', () => {
  openCruise();
  const known = state.data.crewSets.value.find((set) => set.id === 'exc3');
  applyCrewSet({ crew: known?.crew ?? [] });
  expect(crewSetFromCruise()?.id).toBe('exc3');
  expect(state.data.crewSets.value).toHaveLength(3);
});

test('crewSetFromCruise creates a new composition with the next number', () => {
  openCruise();
  applyCrewSet({ crew: [{ memberId: 'ex1', fonction: 'Skipper' }] });
  const set = crewSetFromCruise();
  expect(set?.ident).toBe('EQ004');
  expect(set?.crew).toStrictEqual([{ memberId: 'ex1', fonction: 'Skipper' }]);
  expect(state.data.crewSets.value).toHaveLength(4);
});
