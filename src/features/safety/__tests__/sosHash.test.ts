import { expect, test } from 'vitest';

import { fallbackHash, sosHash } from '../sosHash.ts';

test('the password hash is the salted SHA-256 of legacy', async () => {
  await expect(sosHash('abcd')).resolves.toBe(
    'bdb87d3c772e6460e730c57e6609b7e2bc264082f8c2923af10ef26001d32eb2',
  );
});

test('the hash without Web Crypto is the one of legacy', () => {
  expect(fallbackHash('navin-sos:abcd')).toBe('d4421a1c7');
});
