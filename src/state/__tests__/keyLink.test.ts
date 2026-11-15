import { expect, test } from 'vitest';

import { keyLink, readKeyLink } from '../keyLink.ts';

test('a key goes in the link of its QR code and comes back the same', () => {
  const page = 'https://courtetelle.github.io/navin/';
  const key = 'eyJ0eXAi.abc+/=_-é';
  const link = keyLink('mf', key, page);
  expect(link.startsWith(`${page}#cle=mf.`)).toBe(true);
  expect(readKeyLink(new URL(link).hash)).toStrictEqual({ id: 'mf', key });
  expect(readKeyLink('#cle=aemet.k1')).toStrictEqual({
    id: 'aemet',
    key: 'k1',
  });
  expect(readKeyLink('#cle=other.k1')).toBeNull();
  expect(readKeyLink('#cle=mf.')).toBeNull();
  expect(readKeyLink('#cle=mf.%E0')).toBeNull();
  expect(readKeyLink('#settings')).toBeNull();
});
