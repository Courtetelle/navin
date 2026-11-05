import { expect, test } from 'vitest';

import { ZONE_CYC, nextZone } from '../zone.ts';

test('the zone button cycles lake, sea, automatic', () => {
  expect(ZONE_CYC).toStrictEqual(['lac', 'mer', 'auto']);
  expect(nextZone('lac')).toBe('mer');
  expect(nextZone('mer')).toBe('auto');
  expect(nextZone('auto')).toBe('lac');
});
