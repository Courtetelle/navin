import { expect, test } from 'vitest';

import type { Boat } from '../../../model/types.ts';
import { prepListName, prepListSeed } from '../prepLists.ts';

const SAVANNAH = {
  id: 's',
  info: { boat: 'Savannah' },
  checklistDep: [{ id: 'd1', label: 'Ouvrir la vanne' }],
  checklist: [{ id: 'q1', label: 'Fermer tous les hublots', action: 'x' }],
} as unknown as Boat;

test('the ready lists are named by their subject', () => {
  expect(prepListName('in', 'Invitation')).toBe('Check-in · Invitation');
  expect(prepListName('out', 'Rêves-sur-mer')).toBe(
    'Check-out · Rêves-sur-mer',
  );
});

test('the Savannah lists start from its own check-in and « Quitter le bateau »', () => {
  expect(prepListSeed('in', 'Location Savannah', [SAVANNAH])).toEqual([
    { label: 'Ouvrir la vanne' },
  ]);
  expect(prepListSeed('out', 'Entraînement Savannah', [SAVANNAH])).toEqual([
    { label: 'Fermer tous les hublots', action: 'x' },
  ]);
  // Without the Savannah: its leaving list of NavIn.
  expect(prepListSeed('out', 'Invitation', [])[0]?.label).toBe(
    'Couper la batterie du moteur',
  );
});

test('the cruises start from a sea charter', () => {
  expect(prepListSeed('in', 'Bretagne nord 2027', [SAVANNAH])[0]?.label).toBe(
    'Papiers du bateau, contrat et caution',
  );
  expect(prepListSeed('out', 'Rêves-sur-mer', [SAVANNAH]).at(-1)?.label).toBe(
    'Prendre toutes vos affaires',
  );
});
