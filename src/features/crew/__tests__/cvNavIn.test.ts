import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  leaveHarnessWorld,
  readFixture,
  useHarnessWorld,
} from '../../../state/__tests__/parityHelpers.ts';
import * as actions from '../../../state/actions.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { cvWithNavIn, navInTrips } from '../cvNavIn.ts';

beforeEach(useHarnessWorld);
afterEach(leaveHarnessWorld);

test('a sea cruise saved in NavIn is a line of the CV of each person aboard', () => {
  actions.initState(createMemoryStorage(readFixture('sample-sea')));
  const [trip] = navInTrips('ex6');
  expect(trip).toMatchObject({
    waters: 'mer',
    when: '2026',
    boat: 'Mistral',
    role: 'Skipper',
    duration: '8 jours',
  });
  expect(navInTrips('nobody')).toStrictEqual([]);
  // Already typed in the CV (same year, same boat): not twice.
  const typed = {
    trips: [{ id: 'a', waters: 'mer' as const, when: '2026', boat: 'mistral' }],
  };
  expect(cvWithNavIn('ex6', typed).trips).toHaveLength(1);
  expect(cvWithNavIn('ex6', {}).trips).toHaveLength(1);
});

test('the lake outings are counted in days only', () => {
  actions.initState(createMemoryStorage(readFixture('sample-lake')));
  const trips = navInTrips('ex2');
  expect(trips).toHaveLength(1);
  expect(trips[0]).toMatchObject({
    waters: 'lac',
    route: 'Sorties enregistrées dans NavIn',
  });
  expect(trips[0]?.boat).toBeUndefined();
  expect(trips[0]?.duration).toMatch(/^\d+ jours?$/);
});
