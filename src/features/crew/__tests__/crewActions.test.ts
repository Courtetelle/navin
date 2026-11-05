import { beforeEach, expect, test } from 'vitest';

import type { Cruise } from '../../../model/types.ts';
import {
  blankCruise,
  initState,
  setCruise,
  state,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { crewToFiches, syncCrewFromMember } from '../crewActions.ts';

beforeEach(() => {
  initState(createMemoryStorage());
});

function openCruise(crew: Cruise['crew']): void {
  const cruise = blankCruise('Essai');
  cruise.crew = crew;
  setCruise(cruise);
}

test('a person typed by hand becomes a card, once per name', () => {
  const before = state.data.members.value.length;
  openCruise([
    { nom: 'Jean Paul Dupont', tel: '0791234567' },
    { nom: 'jean paul dupont' },
    { nom: 'Camille Rochat' },
    { nom: ' '.repeat(3) },
  ]);

  crewToFiches();
  const crew = state.data.cruise.value?.crew ?? [];
  const created = state.data.members.value.at(-1);

  expect(state.data.members.value).toHaveLength(before + 1);
  expect(created?.prenom).toBe('Jean');
  expect(created?.nom).toBe('Paul Dupont');
  expect(created?.tel).toBe('+41 79 123 45 67');
  expect(crew[0]?.memberId).toBe(created?.id);
  expect(crew[1]?.memberId).toBe(created?.id);
  expect(crew[2]?.memberId).toBe('ex1');
  expect(crew[3]?.memberId).toBeUndefined();
});

test('nothing is saved when every line has a card', () => {
  openCruise([{ nom: 'Camille Rochat', memberId: 'ex1' }]);
  const members = state.data.members.value;

  crewToFiches();

  expect(state.data.members.value).toBe(members);
});

test('a changed card is copied on board, the role stays', () => {
  openCruise([
    { nom: 'Ancien', memberId: 'ex1', fonction: 'Second', vieux: 1 },
  ]);

  syncCrewFromMember({ id: 'ex1', prenom: 'Cam', nom: 'R', sexe: 'Femme' });

  expect(state.data.cruise.value?.crew).toStrictEqual([
    { memberId: 'ex1', nom: 'Cam R', fonction: 'Second', sexe: 'Femme' },
  ]);
});

test('a card that is not on board changes nothing', () => {
  openCruise([]);
  const cruise = state.data.cruise.value;

  syncCrewFromMember({ id: 'ex1', prenom: 'Cam' });

  expect(state.data.cruise.value).toBe(cruise);
});
