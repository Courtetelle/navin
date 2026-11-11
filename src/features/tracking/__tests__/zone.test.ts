import { expect, test } from 'vitest';

import { ZONE_CYC, nextZone } from '../zone.ts';

test('NavIn goes between lake and sea; the GPS is left for the lake', () => {
  expect(ZONE_CYC).toStrictEqual(['lac', 'mer']);
  expect(nextZone('lac')).toBe('mer');
  expect(nextZone('mer')).toBe('lac');
  expect(nextZone('auto')).toBe('lac');
});
