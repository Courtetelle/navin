import { beforeEach, expect, test } from 'vitest';

import { buildLakeOuting } from '../../../state/__tests__/buildSamples.ts';
import { initState, updateBoat } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { checkItems } from '../checklistProgress.ts';
import { copyCheckIn, currentCheckInSources } from '../copyCheckIn.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
  buildLakeOuting();
});

test('the check-in of another boat is copied once, without doubles', () => {
  updateBoat('savannah', (boat) => {
    boat.checklistDep = [{ id: 'a', label: 'Gilets' }];
  });
  updateBoat('inspiration', (boat) => {
    boat.checklistDep = [
      { id: 'x', label: 'Gilets' },
      { id: 'y', label: 'Feux de navigation' },
    ];
  });
  const source = currentCheckInSources().find(
    (item) => item.boatId === 'inspiration',
  );
  expect(source?.count).toBe(2);
  expect(
    currentCheckInSources().some((item) => item.boatId === 'savannah'),
  ).toBe(false);
  copyCheckIn('inspiration');
  expect(checkItems('dep').map((item) => item.label)).toStrictEqual([
    'Gilets',
    'Feux de navigation',
  ]);
  copyCheckIn('inspiration');
  expect(checkItems('dep')).toHaveLength(2);
  expect(checkItems('dep')[1]?.id).not.toBe('y');
});
