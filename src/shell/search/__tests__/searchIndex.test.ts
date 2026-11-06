/* eslint-disable camelcase -- names of the API */
import { beforeEach, expect, test, vi } from 'vitest';

import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import {
  functionEntries,
  matches,
  onlinePlaces,
  placeEntries,
  plain,
} from '../searchIndex.ts';

beforeEach(() => {
  initState(createMemoryStorage());
});

const names = (query: string) =>
  matches(query, placeEntries(), (entry) => entry.name).map(
    (entry) => entry.name,
  );
const keys = (query: string) =>
  matches(
    query,
    functionEntries(),
    (entry) => `${entry.title} ${entry.sub}`,
  ).map((entry) => entry.key);

test('a search ignores accents and capitals', () => {
  expect(plain('  ÉVIAN ')).toBe('evian');
  expect(names('evian')).toContain('Évian');
  expect(names('ST-MALO')).toContain('St-Malo');
});

test('it finds places without network, at sea too', () => {
  expect(names('porquerolles').length).toBeGreaterThan(0);
  expect(names('ouchy')).toContain('Ouchy');
});

test('it finds functions by their name and by other words', () => {
  expect(keys('sos')).toContain('sos');
  expect(keys('hors ligne')).toContain('cartes');
  expect(keys('alarme')).toContain('settings');
  expect(keys('beaufort')[0]).toBe('beaufort');
});

test('names starting with the search come first; nothing for an empty one', () => {
  expect(names('cap')[0]?.toLowerCase().startsWith('cap')).toBe(true);
  expect(names(' '.repeat(3))).toStrictEqual([]);
});

test('online places are read, and a failure gives nothing', async () => {
  const signal = new AbortController().signal;
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            {
              display_name: 'Bonifacio, Sartène, Corse, France',
              lat: '41.4',
              lon: '9.2',
              boundingbox: ['41', '42', '9', '10'],
            },
            { display_name: 'sans position' },
          ]),
      }),
    ),
  );
  await expect(onlinePlaces('bonifacio', signal)).resolves.toStrictEqual([
    {
      name: 'Bonifacio, Sartène, Corse',
      lat: 41.4,
      lon: 9.2,
      bounds: [41, 42, 9, 10],
    },
  ]);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  );
  await expect(onlinePlaces('bonifacio', signal)).resolves.toStrictEqual([]);
  vi.unstubAllGlobals();
});
