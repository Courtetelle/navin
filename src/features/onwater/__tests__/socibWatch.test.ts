import { expect, test } from 'vitest';

import { socibAdded, socibChangeText, socibToSay } from '../socibWatch.ts';

test('SOCIB: a folder of the catalogue NavIn does not know is said', () => {
  const xml =
    '<catalogRef xlink:title="station_lamola-scb_met018"/><catalogRef xlink:title="buoy_dragonera-scb_met040"/><dataset xlink:title="Latest"/>';
  expect(socibAdded(xml)).toStrictEqual(['buoy_dragonera-scb_met040']);
  const watch = {
    at: 1,
    added: ['buoy_dragonera-scb_met040'],
    gone: ['Cabrera'],
  };
  expect(socibChangeText(watch)).toBe(
    'nouveaux instruments : buoy_dragonera-scb_met040 · ne mesurent plus : Cabrera',
  );
  expect(socibToSay(watch)).toBe(true);
  expect(socibToSay({ ...watch, seen: socibChangeText(watch) })).toBe(false);
  expect(socibToSay({ at: 1, added: [], gone: [] })).toBe(false);
});
