import { expect, test } from 'vitest';

import { watersRenamed } from '../boatMigrations.ts';

test('the old « Navigue » values become Maritime / Lacustre', () => {
  const sea: Record<string, unknown> = { waters: 'Eaux maritimes' };
  const lake: Record<string, unknown> = { waters: 'Eaux intérieures' };
  watersRenamed(sea);
  watersRenamed(lake);
  expect(sea).toStrictEqual({ waters: 'Maritime' });
  expect(lake).toStrictEqual({ waters: 'Lacustre' });
});

test('a new value, or none, is left as it is', () => {
  const info: Record<string, unknown> = { waters: 'Lacustre' };
  watersRenamed(info);
  watersRenamed({});
  watersRenamed(null);
  expect(info).toStrictEqual({ waters: 'Lacustre' });
});
