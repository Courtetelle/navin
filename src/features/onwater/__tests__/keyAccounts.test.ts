import { afterEach, beforeEach, expect, test } from 'vitest';

import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend } from '../../../storage/store.ts';
import { backupAll } from '../../data/backup.ts';
import { saveAccount, siteAccount } from '../keyAccounts.ts';

beforeEach(() => {
  setStorageBackend(createMemoryStorage());
});
afterEach(() => {
  setStorageBackend(null);
});

test('the account of a site is kept on the device, never in a backup', () => {
  expect(siteAccount('mf', 'https://portail-api.meteofrance.fr')).toStrictEqual(
    {
      url: 'https://portail-api.meteofrance.fr',
      user: '',
      password: '',
    },
  );
  saveAccount('mf', {
    url: 'https://portail-api.meteofrance.fr',
    user: 'marin',
    password: 'secret-123',
  });
  expect(siteAccount('mf', '').user).toBe('marin');
  expect(backupAll().json).not.toContain('secret-123');
});
