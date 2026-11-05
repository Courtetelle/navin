import { beforeEach, expect, test } from 'vitest';

import { initState, state } from '../../../state/index.ts';
import { createMemoryStorage } from '../../../storage/memoryStorage.ts';
import { ZONES, autoOutingName, guessZone, nearestPort } from '../ports.ts';

beforeEach(() => {
  initState(createMemoryStorage({}));
});

test('nearestPort finds the closest port within the radius', () => {
  expect(nearestPort(46.509, 6.5, 5)).toBe('Morges');
  expect(nearestPort(43.51, 16.44, 10)).toBe('Split');
  expect(nearestPort(46.43, 6.55, 1)).toBeNull();
});

test('guessZone reads the sea area from the position', () => {
  expect(guessZone(57, 18)).toBe('B');
  expect(guessZone(54, 5)).toBe('N');
  expect(guessZone(47, -3)).toBe('A');
  expect(guessZone(43, 16)).toBe('M');
  expect(guessZone(60, 40)).toBe('X');
  expect(ZONES.map(([code]) => code)).toStrictEqual(['M', 'A', 'N', 'B', 'X']);
});

test('autoOutingName numbers the outings of the year', () => {
  const when = new Date(2026, 6, 9);
  expect(autoOutingName('lacj', 'Savannah', 'Morges', '', when)).toBe(
    '2601L_Savannah Morges JE 9/7',
  );
  state.data.index.value = [
    {
      id: 'a',
      name: '2607L_Savannah Morges JE 9/7',
      created: '2026-07-09T10:00:00Z',
      type: 'lac',
    },
    {
      id: 'b',
      name: '2533L_Autre',
      created: '2025-07-09T10:00:00Z',
      type: 'lac',
    },
  ];
  expect(autoOutingName('mer', 'Inspiration', 'St-Malo', 'A', when)).toBe(
    '2608Ac_Inspiration St-Malo JE 9/7',
  );
  expect(autoOutingName('lacc', '', '', '', when)).toBe('2608Lc_JE 9/7');
  expect(autoOutingName('mer', 'X', '', '', when)).toBe('2608Mc_X JE 9/7');
});
