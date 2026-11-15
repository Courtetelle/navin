/* eslint-disable camelcase -- the fields as MeteoSwiss names them */
import { expect, test } from 'vitest';

import {
  dangersUrl,
  lakeSpot,
  lakeWarningsOf,
  lightOf,
  litWarnings,
  warningKey,
  warningsNear,
} from '../lakeWarnings.ts';

// As MeteoSwiss gave it on 15.11.2026 at 21:30.
const DANGERS = {
  hazards: {},
  airfields: [],
  lakes: [
    {
      warnlevel: 2,
      expires: 1_794_834_000,
      is_outlook: false,
      name: 'Grand Lac',
      description:
        'Des rafales de 25 à 33 kt de secteur sud-ouest sont possibles.',
      areas: [435],
      onset: 1_794_763_200,
    },
    {
      warnlevel: 3,
      expires: 1_794_834_000,
      is_outlook: false,
      name: 'Lac de Neuchâtel',
      description: 'Rafales <b>de 35 kt</b>',
      areas: [433],
      onset: 1_794_770_000,
    },
    {
      warnlevel: 2,
      expires: 1_794_900_000,
      is_outlook: true,
      name: 'Lac de Zurich',
      description: '',
      areas: [420],
      onset: 1_794_850_000,
    },
  ],
};

test('the newest map of dangers of MeteoSwiss', () => {
  expect(dangersUrl({ 'versioned/danger/v3': '20261115_2030' })).toBe(
    'https://www.meteoschweiz.admin.ch/product/output/versioned/danger/v3/version__20261115_2030/fr/dangers.json',
  );
  expect(dangersUrl({})).toBeNull();
  expect(dangersUrl({ 'versioned/danger/v3': '../x' })).toBeNull();
});

test('the warnings of the lakes, those lit now, the strongest first', () => {
  const warnings = lakeWarningsOf(DANGERS);
  expect(warnings).toHaveLength(3);
  expect(warnings[1]?.text).toBe('Rafales de 35 kt');
  const now = 1_794_774_000_000;
  const lit = litWarnings(warnings, now);
  expect(lit.map((warning) => warning.name)).toEqual([
    'Lac de Neuchâtel',
    'Grand Lac',
  ]);
  expect(lakeWarningsOf(null)).toEqual([]);
  expect(lit[0] && warningKey(lit[0])).toBe('Lac de Neuchâtel|1794770000000|3');
});

test('the lights flash 40 a minute for strong wind, 90 for a storm', () => {
  expect(lightOf(2)).toEqual({ words: 'VENT FORT', perMinute: 40 });
  expect(lightOf(3)).toEqual({ words: 'TEMPÊTE', perMinute: 90 });
});

test('the lake of the boat', () => {
  expect(lakeSpot('Lac de Neuchâtel')).not.toBeNull();
  expect(lakeSpot('Petit Lac')).not.toBeNull();
  expect(lakeSpot('Lac inconnu')).toBeNull();
  const warnings = litWarnings(lakeWarningsOf(DANGERS), 1_794_774_000_000);
  // Off Lausanne: the Grand Lac only (Neuchâtel and Joux only flash).
  expect(
    warningsNear(warnings, { lat: 46.5, lon: 6.6 }).map((w) => w.name),
  ).toEqual(['Grand Lac']);
  // On the Lac de Neuchâtel, its storm only flashes on the map.
  expect(warningsNear(warnings, { lat: 46.9, lon: 6.85 })).toEqual([]);
  // At sea off Saint-Malo: none.
  expect(warningsNear(warnings, { lat: 48.65, lon: -2 })).toEqual([]);
});
