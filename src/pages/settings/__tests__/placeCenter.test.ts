import { expect, test } from 'vitest';

import { plain, zoomOf } from '../placeCenter.ts';

test('names compare without accents, capitals nor apostrophes', () => {
  expect(plain('Lac d’Annecy')).toBe('lac d annecy');
  expect(plain('Léman').includes(plain('leman'))).toBe(true);
});

test('a place found opens at a zoom that shows it whole', () => {
  // Lake Annecy, about 14 km long.
  expect(zoomOf([45.78, 45.91, 6.12, 6.24])).toBe(12);
  // Lake Geneva.
  expect(zoomOf([46.2, 46.54, 6.11, 6.93])).toBe(9);
  // A village: as close as allowed.
  expect(zoomOf([46.5, 46.501, 6.6, 6.601])).toBe(13);
  expect(zoomOf(undefined)).toBeUndefined();
});
