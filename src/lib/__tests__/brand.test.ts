import { expect, test } from 'vitest';

import { upperKeepBrands } from '../brand.ts';

test('capitals keep NavIn and LiveMétéo as written', () => {
  expect(upperKeepBrands('NavIn · LiveMétéo · alerte')).toBe(
    'NavIn · LiveMétéo · ALERTE',
  );
});
