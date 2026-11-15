import { expect, test } from 'vitest';

import { reportLines } from '../restoreReport.ts';

test('the report of a restoration says what was added, merged and the same', () => {
  expect(
    reportLines({
      added: ['2601L_SA 14/11'],
      completed: ['2620L_Savannah VE 13/11', 'Autre'],
      same: [],
      boats: 1,
      members: 0,
      marks: 2,
      crews: 0,
    }),
  ).toStrictEqual([
    '➕ 1 navigation ajoutée : 2601L_SA 14/11',
    '🔁 2 navigations déjà là, complétées (doublons fusionnés, rien d’effacé) : 2620L_Savannah VE 13/11, Autre',
    '➕ Fiches ajoutées : 1 bateau, 2 marques',
  ]);
  expect(
    reportLines({
      added: [],
      completed: [],
      same: ['A'],
      boats: 0,
      members: 0,
      marks: 0,
      crews: 0,
    }),
  ).toStrictEqual([
    '✔︎ 1 navigation déjà identique : A',
    '✔︎ Bateaux, équipiers, marques et équipages : déjà à jour',
  ]);
});
