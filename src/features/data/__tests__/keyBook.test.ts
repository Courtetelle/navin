import { afterEach, beforeEach, expect, test } from 'vitest';

import {
  KEY_GUIDES,
  keyGuide,
  mergeKeyBook,
  saveAccount,
  saveGuide,
  siteAccount,
} from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { setStorageBackend, store } from '../../../storage/store.ts';
import { backupAll } from '../backup.ts';

beforeEach(() => {
  setStorageBackend(createMemoryStorage());
});
afterEach(() => {
  setStorageBackend(null);
});

test('the accounts and the guides of the keys go in the full backup', () => {
  expect(backupAll().data.keyBook).toBeUndefined();
  expect(siteAccount('mf', 'https://portail-api.meteofrance.fr').user).toBe('');
  saveAccount('mf', {
    url: 'https://portail-api.meteofrance.fr',
    user: 'marin',
    password: 'secret-123',
  });
  saveGuide('aemet', '1. Ma façon');
  expect(keyGuide('aemet')).toBe('1. Ma façon');
  expect(keyGuide('mf')).toBe(KEY_GUIDES.mf);
  const book = backupAll().data.keyBook;
  expect(book).toStrictEqual({
    accounts: {
      mf: {
        url: 'https://portail-api.meteofrance.fr',
        user: 'marin',
        password: 'secret-123',
      },
    },
    guides: { aemet: '1. Ma façon' },
  });
  // An emptied guide comes back to the one of NavIn.
  saveGuide('aemet', '  ');
  expect(keyGuide('aemet')).toBe(KEY_GUIDES.aemet);
  // Another device: its empty fields are filled, what it wrote stays.
  setStorageBackend(createMemoryStorage());
  saveAccount('mf', { url: '', user: 'autre', password: '' });
  mergeKeyBook(book);
  expect(siteAccount('mf', '')).toStrictEqual({
    url: 'https://portail-api.meteofrance.fr',
    user: 'autre',
    password: 'secret-123',
  });
  expect(keyGuide('aemet')).toBe('1. Ma façon');
  mergeKeyBook('nonsense');
  expect(store.get('ldb.keyGuides', {})).toStrictEqual({
    aemet: '1. Ma façon',
  });
});
