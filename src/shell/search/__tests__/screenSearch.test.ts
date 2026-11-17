import { beforeEach, expect, test } from 'vitest';

import { initState } from '../../../state/init.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { screenFound } from '../screenSearch.ts';
import { searchContext, searchHits } from '../searchHits.ts';

beforeEach(() => {
  initState(createMemoryStorage());
});

const spot = (text: string) => ({
  element: null as unknown as HTMLElement,
  text,
});

test('every screen but the map, the lists and the menus searches what it shows', () => {
  expect(searchContext('dossier').screen).toBe(true);
  expect(searchContext('info').screen).toBe(true);
  expect(searchContext('settings').screen).toBe(true);
  expect(searchContext('more').screen).toBeUndefined();
  expect(searchContext('tracker').screen).toBeUndefined();
  expect(searchContext('boats').screen).toBeUndefined();
});

test('the sites are searched by their text, address and place', () => {
  const context = searchContext('sites');
  expect(context.kinds).toStrictEqual(['site']);
  const hits = searchHits('meteosuisse dangers', context);
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.every((hit) => hit.view === 'sites')).toBe(true);
});

test('the places of a screen holding every word, with the words around', () => {
  const spots = [
    spot('Numéro MMSI 269 123 456 Suisse (MID 269)'),
    spot('Call sign HBY1234'),
    spot(
      `${'Un long texte avant '.repeat(4)}Météo-France et encore bien des mots après`,
    ),
  ];
  expect(screenFound('mmsi 269', spots).map((one) => one.label)).toStrictEqual([
    'Numéro MMSI 269 123 456 Suisse (MID 269)',
  ]);
  const [far] = screenFound('meteo', spots);
  expect(far?.label.startsWith('…')).toBe(true);
  expect(far?.label).toContain('Météo-France');
  expect(screenFound('', spots)).toStrictEqual([]);
});
