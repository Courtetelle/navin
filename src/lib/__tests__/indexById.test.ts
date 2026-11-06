import { expect, test } from 'vitest';

import { indexById } from '../indexById.ts';

test('items are found by id, the first one wins like find', () => {
  const first = { id: 'a', value: 1 };
  const second = { id: 'b', value: 2 };
  const repeated = { id: 'a', value: 3 };
  const byId = indexById([first, second, repeated]);
  expect(byId.get('a')).toBe(first);
  expect(byId.get('b')).toBe(second);
  expect(byId.size).toBe(2);
});
