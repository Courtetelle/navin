import { expect, test } from 'vitest';

import {
  socibChangeText,
  socibFolders,
  socibLatest,
  socibName,
  socibToLook,
  socibToSay,
} from '../socibWatch.ts';

test('SOCIB: the folders looked at, the new ones and those read', () => {
  const xml =
    '<catalogRef xlink:title="station_lamola-scb_met018"/><catalogRef xlink:title="station_galfi-scb_met001"/><catalogRef xlink:title="buoy_dragonera-scb_met040"/><dataset xlink:title="Latest"/>';
  const folders = socibFolders(xml);
  expect(folders).toStrictEqual([
    'buoy_dragonera-scb_met040',
    'station_galfi-scb_met001',
    'station_lamola-scb_met018',
  ]);
  expect(socibToLook(folders, ['station_lamola-scb_met018'])).toStrictEqual([
    'buoy_dragonera-scb_met040',
    'station_lamola-scb_met018',
  ]);
});

test('SOCIB: the last deployment of a folder, the name of a new one', () => {
  expect(
    socibLatest(
      'urlPath="m/w/b/L1/dep0001_buoy-soller_scb-met014_L1_latest.nc" urlPath="m/w/b/L1/dep0002_buoy-soller_scb-met014_L1_latest.nc" urlPath="m/w/b/L1/2026/x.nc"',
    ),
  ).toBe('m/w/b/L1/dep0002_buoy-soller_scb-met014_L1_latest.nc');
  expect(socibLatest('nothing')).toBeNull();
  expect(socibName('buoy_dragonera-scb_met040')).toBe('Dragonera (bouée)');
  expect(socibName('mobims_sonbou-scb_met021')).toBe('Sonbou (plage)');
  expect(socibName('station_salines-ime_met002')).toBe('Salines');
});

test('SOCIB: what changed is said once, until « Vu »', () => {
  const watch = { at: 1, added: ['Dragonera (bouée)'], gone: ['Cabrera'] };
  expect(socibChangeText(watch)).toBe(
    'ajoutés : Dragonera (bouée) · retirés : Cabrera',
  );
  expect(socibToSay(watch)).toBe(true);
  expect(socibToSay({ ...watch, seen: socibChangeText(watch) })).toBe(false);
  expect(socibToSay({ at: 1, added: [], gone: [] })).toBe(false);
});
