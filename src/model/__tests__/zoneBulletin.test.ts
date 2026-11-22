/* eslint-disable camelcase -- the names of the variables of Open-Meteo */
import { expect, test } from 'vitest';

import type { BulletinData, BulletinInput } from '../zoneBulletin.ts';
import {
  convectionWords,
  lemanWind,
  provenceWind,
  tendencyWords,
  zoneBulletin,
  zoneKindOf,
} from '../zoneBulletin.ts';

const NOW = Date.UTC(2026, 10, 22, 8);

function data(
  make: (hour: number) => Record<string, number | null>,
): BulletinData {
  const t = Array.from({ length: 96 }, (_, hour) => NOW + hour * 3_600_000);
  const v: Record<string, Array<number | null>> = {};
  for (const [index] of t.entries()) {
    for (const [name, value] of Object.entries(make(index))) {
      (v[name] ??= []).push(value);
    }
  }
  return {
    at: NOW,
    src: 'ECMWF IFS 0,25° (via Open-Meteo)',
    offset: 3600,
    t,
    v,
  };
}

const calm = (hour: number) => ({
  wind_speed_10m: 8,
  wind_direction_10m: 230,
  wind_gusts_10m: 12,
  pressure_msl: 1018,
  precipitation: 0,
  cape: 0,
  convective_inhibition: 0,
  temperature_2m: 10 + (hour % 24 > 12 ? 2 : 0),
  dew_point_2m: 5,
  wave_height: 1.2,
  wave_period: 8,
  wind_wave_height: 0.4,
  wind_wave_period: 3,
  swell_wave_height: 1,
  swell_wave_period: 10,
  swell_wave_direction: 280,
});

function input(over: Partial<BulletinInput>): BulletinInput {
  return {
    kind: 'manche',
    lat: 48.652,
    lon: -2.831,
    name: 'Saint-Quay-Portrieux',
    data: data(calm),
    now: NOW,
    gradient: null,
    lakeAlerts: null,
    fetchKm: null,
    ...over,
  };
}

test('the five levels, in the universal order', () => {
  const bulletin = zoneBulletin(input({}));
  expect(bulletin.levels.map((level) => level.level)).toStrictEqual([
    1, 2, 3, 4, 5,
  ]);
  expect(bulletin.levels.map((level) => level.title)).toStrictEqual([
    'Alertes, BMS et avis de vent fort',
    'Situation générale et évolution',
    'Vent',
    'Marées, courants et houle',
    'Temps sensible et visibilité',
  ]);
  expect(bulletin.old).toBe(false);
});

test('every table says its units in its head', () => {
  for (const kind of ['lac', 'manche', 'med'] as const) {
    const bulletin = zoneBulletin(input({ kind, fetchKm: () => 10 }));
    for (const level of bulletin.levels) {
      for (const name of level.table?.head.slice(1) ?? []) {
        expect(name).toMatch(/\(.+\)/u);
      }
    }
  }
});

test('Channel: the BMS and the tides are not invented, their links are given', () => {
  const bulletin = zoneBulletin(input({}));
  const [alerts, , , sea] = bulletin.levels;
  expect(alerts?.links).toContain('wx-bms-manche');
  expect(alerts?.missing.join(' ')).toContain('BMS');
  expect(sea?.links).toContain('wx-shom-marees');
  expect(sea?.missing.join(' ')).toContain('SHOM');
});

test('force 7 or more: a BMS is likely, no-go', () => {
  const strong = data((hour) => ({
    ...calm(hour),
    wind_speed_10m: hour >= 10 ? 30 : 12,
    wind_gusts_10m: hour >= 10 ? 42 : 18,
  }));
  const [alerts] = zoneBulletin(input({ data: strong })).levels;
  expect(alerts?.lines.join(' ')).toMatch(/force 7.*No-go/u);
});

test('a trough: the pressure dips and the wind veers', () => {
  const trough = data((hour) => ({
    ...calm(hour),
    pressure_msl: 1010 - 6 + Math.abs(hour - 20) * 0.6,
    wind_direction_10m: hour < 20 ? 210 : 300,
    wind_speed_10m: 15,
  }));
  const [, situation] = zoneBulletin(input({ data: trough })).levels;
  expect(situation?.lines.join(' ')).toContain('talweg');
});

test('lake: chop, no tide, the MeteoSwiss warnings', () => {
  const bise = data((hour) => ({
    ...calm(hour),
    wind_speed_10m: 18,
    wind_direction_10m: 50,
    wave_height: null,
  }));
  const bulletin = zoneBulletin(
    input({
      kind: 'lac',
      lat: 46.46,
      lon: 6.338,
      name: 'Rolle',
      data: bise,
      fetchKm: () => 12,
      lakeAlerts: [
        {
          name: 'Grand Lac',
          level: 2,
          onset: NOW - 3_600_000,
          expires: NOW + 6 * 3_600_000,
        },
      ],
      gradient: {
        t: [NOW],
        p: { geneve: [1016], zurich: [1021], lugano: [1015] },
      },
    }),
  );
  const text = bulletin.levels.flatMap((level) => level.lines).join(' ');
  expect(text).toContain('VENT FORT');
  expect(text).toContain('Bise');
  expect(text).toContain('bise forte');
  expect(text).toContain('Clapot');
  expect(text).not.toContain('Marées');
  expect(bulletin.levels[3]?.title).toBe('État de l’eau (clapot)');
});

test('Mediterranean: the mistral, and the shelters of Porquerolles', () => {
  const mistral = data((hour) => ({
    ...calm(hour),
    wind_speed_10m: 22,
    wind_direction_10m: 310,
    dew_point_2m: 0,
  }));
  const bulletin = zoneBulletin(
    input({
      kind: 'med',
      lat: 43,
      lon: 6.2,
      name: 'Porquerolles',
      data: mistral,
    }),
  );
  const text = bulletin.levels.flatMap((level) => level.lines).join(' ');
  expect(text).toContain('Mistral');
  expect(text).toContain('Porquerolles');
  expect(text).toContain('air sec');
  expect(bulletin.levels[0]?.links).toContain('wx-bms-provence');
});

test('an old forecast is said old', () => {
  expect(zoneBulletin(input({ now: NOW + 7 * 3_600_000 })).old).toBe(true);
});

test('the kinds of zone', () => {
  expect(zoneKindOf({ lat: 46.46, lon: 6.34 }, true)).toBe('lac');
  expect(zoneKindOf({ lat: 43, lon: 6.2 }, false)).toBe('med');
  expect(zoneKindOf({ lat: 48.65, lon: -2.83 }, false)).toBe('manche');
});

test('the words of the barometer, the winds and the storms', () => {
  expect(tendencyWords(-4)).toBe('baisse rapide');
  expect(tendencyWords(0.05)).toBe('stationnaire');
  expect(lemanWind({ from: 45, wind: 15, hour: 10 })).toBe('bise');
  expect(lemanWind({ from: 320, wind: 15, hour: 20 })).toBe('joran possible');
  expect(provenceWind({ from: 320, wind: 25, hour: 12 })).toBe('mistral');
  expect(convectionWords(1600, -150)).toContain('verrouillée');
  expect(convectionWords(800, -20)).toContain('zone tampon');
  expect(convectionWords(100, 0)).toBe('atmosphère stable');
});
