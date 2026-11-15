import { expect, test } from 'vitest';

import { keyEnd, keyPrint } from '../keyHealth.ts';

const jwt = (payload: object) =>
  `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replaceAll('=', '')}.sig`;

test('the end a key holds, and its print (never the key itself)', () => {
  expect(keyEnd(jwt({ exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
  expect(keyEnd(jwt({ sub: 'x' }))).toBeNull();
  expect(keyEnd('https://navin-relay.x.workers.dev')).toBeNull();
  const print = keyPrint('abcdefghijklmnopqrstuvwxyz');
  expect(print).not.toContain('xyz');
  expect(keyPrint('abcdefghijklmnopqrstuvwxyz')).toBe(print);
  expect(keyPrint('abcdefghijklmnopqrstuvwxyZ')).not.toBe(print);
});
