import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

import { expect, test } from 'vitest';

import { farFromShore, parseShoreGrid } from '../../onwater/shoreFar.ts';
import { inZone, parseZones, zonesAt } from '../meteoZones.ts';

const zones = parseZones(
  JSON.parse(readFileSync('public/meteo-zones.json', 'utf8')),
);
const grid = parseShoreGrid(
  new Uint8Array(gunzipSync(readFileSync('public/shore-sea500.bin'))),
);

test('the file holds the 9 coast zones, 21 offshore zones and one Léman', () => {
  expect(zones.filter((z) => z.kind === 'cote')).toHaveLength(9);
  expect(zones.filter((z) => z.kind === 'large')).toHaveLength(21);
  expect(zones.filter((z) => z.kind === 'lac').map((z) => z.id)).toEqual([
    'leman',
  ]);
});

test('the whole Léman is one zone, from Geneva to Villeneuve', () => {
  const leman = zones.find((z) => z.id === 'leman');
  expect(leman).toBeDefined();
  if (!leman) return;
  expect(inZone(leman, 46.27, 6.18)).toBe(true); // Petit-Lac
  expect(inZone(leman, 46.45, 6.55)).toBe(true); // Grand-Lac, off Morges
  expect(inZone(leman, 46.41, 6.88)).toBe(true); // Haut-Lac
  expect(zonesAt(zones, 46.455, 6.34, true)).toEqual(['leman']); // Rolle
});

test('Saint-Quay-Portrieux and Porquerolles are in their coast zones', () => {
  expect(zonesAt(zones, 48.65, -2.81)).toEqual(['hague-penmarch']);
  expect(zonesAt(zones, 43, 6.2)).toEqual(['camargue-straphael']);
});

test('the grid keeps the shore and drops the land 500 m inland', () => {
  expect(grid).not.toBeNull();
  if (!grid) return;
  expect(farFromShore(grid, 48.651, -2.822)).toBe(false); // port of Saint-Quay
  expect(farFromShore(grid, 48.514, -2.765)).toBe(true); // Saint-Brieuc town
  expect(farFromShore(grid, 46.4585, 6.3395)).toBe(false); // port of Rolle
  expect(farFromShore(grid, 46.48, 6.33)).toBe(true); // vineyards above Rolle
});
