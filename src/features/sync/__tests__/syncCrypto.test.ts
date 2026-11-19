import { expect, test } from 'vitest';

import {
  aesKey,
  hashName,
  isSyncKey,
  newSyncKey,
  seal,
  unseal,
} from '../syncCrypto.ts';

test('a sealed text comes back whole with the key, never without it', async () => {
  const key = newSyncKey();

  expect(isSyncKey(key)).toBe(true);

  const text = JSON.stringify({ members: [{ prenom: 'Léa', nom: 'Rochat' }] });
  const sealed = await seal(await aesKey(key), text);

  expect(sealed.startsWith('v1.')).toBe(true);
  expect(sealed).not.toContain('Rochat');
  await expect(unseal(await aesKey(key), sealed)).resolves.toBe(text);
  await expect(unseal(await aesKey(newSyncKey()), sealed)).rejects.toThrow();
  // A text changed on the way is refused.
  const changed = `${sealed.slice(0, -6)}AAAAAA`;

  await expect(unseal(await aesKey(key), changed)).rejects.toThrow();
});

test('the space and the photo names say nothing of the key', async () => {
  const key = newSyncKey();
  const space = await hashName(key, 'space');

  expect(space).toMatch(/^[0-9a-f]{64}$/u);
  expect(await hashName(key, 'photo:p1', 40)).toMatch(/^[0-9a-f]{40}$/u);
  expect(await hashName(newSyncKey(), 'space')).not.toBe(space);
});
