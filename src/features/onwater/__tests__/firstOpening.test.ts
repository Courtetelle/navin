import { expect, test } from 'vitest';

import { firstOpening } from '../windStart.ts';

test('a reload in the same tab is not a new opening of NavIn', () => {
  const kept = new Map<string, string>();
  globalThis.sessionStorage = {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => {
      kept.set(key, value);
    },
  } as unknown as Storage;

  expect(firstOpening()).toBe(true);
  expect(firstOpening()).toBe(false);
  kept.clear();

  expect(firstOpening()).toBe(true);
});
