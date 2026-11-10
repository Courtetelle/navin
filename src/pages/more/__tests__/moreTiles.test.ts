import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  load,
  useHarnessClock,
} from '../../../features/data/__tests__/fixtures.ts';
import { tilesWithCruise, tilesWithoutCruise } from '../moreTiles.ts';

function keys(tiles: ReadonlyArray<{ key: string }>): string[] {
  return tiles.map((tile) => tile.key);
}

beforeEach(useHarnessClock);

afterEach(() => {
  vi.useRealTimers();
});

test('without a cruise, the menu lists the records of the phone', () => {
  load('empty');
  const tiles = tilesWithoutCruise();

  expect(keys(tiles)).toStrictEqual([
    'traces',
    'meteo',
    'ckbases',
    'boats',
    'people',
    'crews',
    'tasktpl',
    'mob',
    'soslogs',
    'rules',
    'docs',
    'cartes',
    'nmea',
    'marks',
    'lists',
  ]);
  expect(tiles[3]?.sub).toBe('5 bateaux, données et check-lists du lac');
  expect(tiles[5]?.sub).toBe('3 groupes de navigants, avec les rôles');
});

test('a lake outing shows its sheet, its rules and the lake totals', () => {
  load('sample-lake');
  const tiles = tilesWithCruise();

  expect(keys(tiles)).toStrictEqual([
    'day',
    'log',
    'soslogs',
    'traces',
    'meteo',
    'checklist',
    'ckbases',
    'sheet',
    'rules',
    'docs',
    'stats',
    'boats',
    'info',
    'people',
    'crews',
    'lists',
    'marks',
    'cartes',
    'map',
    'nmea',
    'print',
    'export',
  ]);
  expect(tiles[0]?.sub).toBe('fiche de la sortie');
  expect(tiles[14]?.sub).toBe('3 à bord · 4 groupes enregistrés');
});

test('a sea cruise has its task rotation and the GPX exchange', () => {
  load('sample-sea');
  const tiles = tilesWithCruise();

  expect(keys(tiles)).toContain('aboard');
  expect(keys(tiles)).not.toContain('sheet');
  expect(keys(tiles)).not.toContain('stats');
  expect(tiles.at(-1)?.sub).toBe('tableur, sauvegarde, trace GPX');
});
