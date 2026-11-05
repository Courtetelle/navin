import { expect, test } from 'vitest';

import { bathPoints } from '../bathLayer.ts';
import { applyMapDay } from '../mapDayState.ts';
import type { OsmFeature } from '../osmFeatures.ts';

const harbour: OsmFeature = {
  k: 'harbour',
  g: 'a',
  c: [
    [46.5, 6.5],
    [46.5, 6.502],
    [46.502, 6.502],
    [46.5, 6.5],
  ],
  t: { name: 'Port' },
};

function light(lat: number, lon: number, name: string): OsmFeature {
  return {
    k: 'light_minor',
    g: 'p',
    c: [lat, lon],
    t: Object.fromEntries([
      ['seamark:type', 'light_minor'],
      ['name', name],
    ]),
  };
}

test('bathPoints keeps the lights near a harbour and the ferry piers', () => {
  const ferry: OsmFeature = {
    k: 'ferry',
    g: 'p',
    c: [46.6, 6.6],
    t: { name: 'Rolle' },
  };
  expect(
    bathPoints([
      harbour,
      light(46.5005, 6.5, 'Entrée'),
      light(46.6, 6.5, 'Loin'),
      ferry,
    ]),
  ).toStrictEqual([
    { ll: [46.5005, 6.5], what: 'entrée de port', name: 'Entrée' },
    { ll: [46.6, 6.6], what: 'débarcadère', name: 'Rolle' },
  ]);
});

test('bathPoints drops a second place within 30 m', () => {
  const places = bathPoints([
    harbour,
    light(46.5005, 6.5, 'Une'),
    light(46.5006, 6.5, 'Deux'),
  ]);
  expect(places.map((place) => place.name)).toStrictEqual(['Une']);
});

test('applyMapDay keeps the day until another one', () => {
  expect(applyMapDay('2026-07-15')).toBe('2026-07-15');
  expect(applyMapDay(null)).toBe('2026-07-15');
  expect(applyMapDay('all')).toBeNull();
  expect(applyMapDay(undefined)).toBeNull();
});
