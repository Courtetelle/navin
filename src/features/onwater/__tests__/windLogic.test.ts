import { expect, test } from 'vitest';

import { SETTINGS_DEFAULTS } from '../../../model/settings.ts';
import {
  douglasOfH,
  flashColor,
  flashInk,
  seaTxt,
  signalDue,
  testSeaTxt,
  waveOmmTxt,
  windAlertConfig,
  windAlertNote,
  windLevel,
  windMutedNote,
  windValue,
} from '../windLogic.ts';

const STATION = {
  name: 'Bouveret',
  t: 0,
  avg: 15,
  gust: 22,
  dir: 45,
  km: 3,
};

test('the configuration defaults to gusts within 30 km', () => {
  expect(windAlertConfig({ ...SETTINGS_DEFAULTS })).toStrictEqual({
    on: true,
    basis: 'gust',
    radius: 30,
    mfKey: '',
  });
  expect(
    windAlertConfig({
      ...SETTINGS_DEFAULTS,
      windAlert: { on: false, basis: 'avg' },
    }),
  ).toStrictEqual({ on: false, basis: 'avg', radius: 30, mfKey: '' });
});

test('windValue reads the gusts, or the mean wind without them', () => {
  expect(windValue(STATION, 'gust')).toBe(22);
  expect(windValue(STATION, 'avg')).toBe(15);
  expect(windValue({ ...STATION, gust: null }, 'gust')).toBe(15);
});

test('windLevel starts at 4 Bf', () => {
  expect(windLevel(null)).toBe(-1);
  expect(windLevel(10)).toBe(-1);
  expect(windLevel(11)).toBe(0);
  expect(windLevel(17)).toBe(1);
  expect(windLevel(64)).toBe(8);
});

test('flash colours and ink', () => {
  expect(flashColor(0)).toBe('#7ed957');
  expect(flashColor(8)).toBe('#4b0055');
  expect(flashColor(20)).toBe('#22002b');
  expect(flashInk('#7ed957')).toBe('#000');
  expect(flashInk('#c4001a')).toBe('#fff');
});

test('douglasOfH and the sea sentences', () => {
  expect(douglasOfH(0)).toBe(0);
  expect(douglasOfH(0.3)).toBe(2);
  expect(douglasOfH(20)).toBe(9);
  expect(seaTxt(null)).toBe('');
  expect(seaTxt({ waveH: 1.3 })).toBe('mer 4 agitée, vagues 1,3 m');
  expect(seaTxt({ waveH: 0.4, douglas: 2 })).toBe('mer 2 belle, vagues 0,4 m');
  expect(waveOmmTxt(4)).toBe(
    'théorique OMM : mer 3 peu agitée, vagues ≈ 1,0 m (pleine mer, vent établi)',
  );
  expect(waveOmmTxt(12)).toBe(
    'théorique OMM : mer 8 très grosse, vagues ≈ 14,0 m et plus (pleine mer, vent établi)',
  );
  expect(testSeaTxt(5)).toBe(
    'modèle ici (exemple fictif) : mer 4 agitée, vagues 1,4 m',
  );
});

test('signalDue: first signal, stronger, other degree after a minute, reminder', () => {
  const last = { level: 2, at: 1_000_000 };
  expect(signalDue(2, null, 1_000_000)).toBe(true);
  expect(signalDue(3, last, 1_000_001)).toBe(true);
  expect(signalDue(1, last, 1_000_000 + 60_000)).toBe(false);
  expect(signalDue(1, last, 1_000_000 + 60_001)).toBe(true);
  expect(signalDue(2, last, 1_000_000 + 899_999)).toBe(false);
  expect(signalDue(2, last, 1_000_000 + 900_000)).toBe(true);
});

test('journal notes of an alert', () => {
  expect(windAlertNote(STATION, { n: 2, src: 'smn' })).toBe(
    '15 nd · 4 Bf (28 km/h), rafales 22 nd · 6 Bf (41 km/h) du 045° mesuré à Bouveret (station MeteoSwiss, 3 km)',
  );
  expect(
    windAlertNote(
      { name: 'ECMWF IFS 9 km', t: 0, avg: 20, gust: null, dir: null },
      { n: 1, src: 'model', bias: 5, waveH: 1.3, douglas: 4 },
    ),
  ).toBe(
    '20 nd · 5 Bf (37 km/h), rafales … PRÉVISION ECMWF IFS 9 km à la position du bateau, pas une mesure (aucune station à moins de 30 km, seuils abaissés de 5 nd) ; mer 4 agitée, vagues 1,3 m',
  );
  expect(windMutedNote(STATION)).toBe(
    '15 nd · 4 Bf (28 km/h), rafales 22 nd · 6 Bf (41 km/h) (alerte non diffusée jusqu’à la fin de la trace)',
  );
});
