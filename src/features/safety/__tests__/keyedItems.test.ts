import { expect, test } from 'vitest';

import { keyedItems } from '../keyedItems.ts';

test('repeated items get distinct keys', () => {
  expect(keyedItems(['A', 'B', 'A'], String)).toStrictEqual([
    { key: 'A#0', item: 'A', index: 0 },
    { key: 'B#0', item: 'B', index: 1 },
    { key: 'A#1', item: 'A', index: 2 },
  ]);
});
