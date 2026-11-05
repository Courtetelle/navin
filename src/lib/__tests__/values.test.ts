import { expect, test } from 'vitest';

import { FIELDS } from '../../model/fields.ts';
import { SETTINGS_DEFAULTS } from '../../model/settings.ts';
import {
  autoAdd,
  marginVal,
  pairConv,
  pairManual,
  roundStep,
  stepTxt,
} from '../boatValues.ts';
import { fmtNum, fmtValue } from '../fieldFormat.ts';

/** Marker of the first filled field of the m / ft pair. */
const PAIR_SOURCE = 'pairSrc_loa_loaFt';

const field = (key: string) => {
  const found = FIELDS.find((item) => item.key === key);
  if (!found) throw new Error(key);
  return found;
};

test('autoAdd adds the margin and rounds up to the step', () => {
  expect([
    autoAdd('1,53', 0.6, 0.1),
    autoAdd('2,33', 0, 0.1),
    autoAdd('14,77', 1.5, 0.5),
    autoAdd('1,5', 0.6, 0),
    autoAdd('', 1, 0.1),
    autoAdd('3', 1, 1),
  ]).toStrictEqual(['2,2', '2,4', '16,5', '2,1', '', '4']);
});

test('pairConv and pairManual handle the paired fields', () => {
  expect([
    pairConv('31,6', 0.3048, 2),
    pairConv('16,35', 1 / 0.3048, 1),
    pairConv('13,3', 1.359_62, 1),
    pairConv('', 2, 1),
  ]).toStrictEqual(['9,63', '53,6', '18,1', '']);
  const data = { loa: '9,6', loaFt: '31,6', [PAIR_SOURCE]: 'loaFt' };
  expect([
    pairManual(data, 'loa', 'loaFt'),
    pairManual(data, 'loaFt', 'loa'),
    pairManual({ loa: '9' }, 'loa', 'loaFt'),
  ]).toStrictEqual([true, false, false]);
});

test('margins and rounding steps come from the settings or their defaults', () => {
  const settings = {
    ...SETTINGS_DEFAULTS,
    piedPilote: '0,8',
    arrProf: 0.5,
    arrHaut: 0,
  };
  expect([
    marginVal(settings, 'piedPilote'),
    marginVal(settings, 'margeHaut'),
    roundStep(settings, 'arrProf'),
    roundStep(SETTINGS_DEFAULTS, 'arrProf'),
  ]).toStrictEqual([0.8, 1.5, 0.5, 0.1]);
  expect([
    stepTxt(settings, 'arrProf'),
    stepTxt(settings, 'arrHaut'),
  ]).toStrictEqual([', arrondi au 0,5 m supérieur', '']);
});

test('fmtValue formats the logbook values like the legacy journal', () => {
  expect([
    fmtValue(field('hdg'), 7),
    fmtValue(field('mer'), '3'),
    fmtValue(field('tws'), 12),
    fmtValue(field('loch'), 12.34),
    fmtValue(field('evt'), ['Départ', 'Virement']),
    fmtValue(field('evt'), []),
    fmtValue(field('note'), ''),
    fmtNum({ decimals: 1 }, '2'),
  ]).toStrictEqual([
    '007 °',
    '3 peu agitée',
    '12 nd · 4 Bf (22 km/h)',
    '12,3 NM',
    'Départ, Virement',
    '',
    '',
    '2,0',
  ]);
});
