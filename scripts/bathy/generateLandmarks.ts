/*
 * Well-known landmarks of Lake Geneva, chosen by hand; only their positions come
 * from OpenStreetMap:
 *
 *   node scripts/bathy/generateLandmarks.ts
 */
import { writeFileSync } from 'node:fs';

interface OsmPlace {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const OUTPUT = 'src/features/map/landmarks.json';
const BOX = '45.95,5.9,46.6,7.1';
/** Name shown, kind, name in OpenStreetMap. */
const CHOSEN: ReadonlyArray<readonly [string, string, string]> = [
  ['Jet d’eau de Genève', 'Fontaine', "Jet d'eau"],
  ['Phare des Pâquis', 'Phare', 'Phare des Pâquis'],
  ['Phare des Eaux-Vives', 'Phare', 'Phare des Eaux-Vives'],
  ['Cathédrale Saint-Pierre, Genève', 'Cathédrale', 'Cathédrale Saint-Pierre'],
  ['Château de Coppet', 'Château', 'Château de Coppet'],
  ['Château de Nyon', 'Château', 'Château de Nyon'],
  ['Château de Prangins', 'Château', 'Château de Prangins'],
  ['Château de Rolle', 'Château', 'Château de Rolle'],
  ['Château de Morges', 'Château', 'Château de Morges'],
  ['Cathédrale de Lausanne', 'Cathédrale', 'Cathédrale Notre-Dame de Lausanne'],
  ['Château d’Ouchy', 'Château', "Château d'Ouchy"],
  ['Château de Glérolles', 'Château', 'Château de Glérolles'],
  ['Château de La Tour-de-Peilz', 'Château', 'Château de La Tour-de-Peilz'],
  ['Château de Chillon', 'Château', 'Château de Chillon'],
  ['Château d’Yvoire', 'Château', "Château d'Yvoire"],
  ['Château de Ripaille', 'Château', 'Château de Ripaille'],
  ['Rochers de Naye', 'Sommet', 'Rochers de Naye'],
  ['Dents du Midi', 'Sommet', 'Haute Cime'],
  ['Le Grammont', 'Sommet', 'Le Grammont'],
  ['Cornettes de Bise', 'Sommet', 'Les Cornettes de Bise'],
  ['Dent d’Oche', 'Sommet', "Dent d'Oche"],
  ['Le Salève', 'Sommet', 'Le Grand Piton'],
  ['La Dôle', 'Sommet', 'La Dôle'],
];

const names = CHOSEN.map(([, , name]) => name.replaceAll('"', ''));
const QUERY = `[out:json][timeout:100];
nwr["name"~"^(${names.join('|')})$"](${BOX});
out tags center;`;
const response = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: `data=${encodeURIComponent(QUERY)}`,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'NavIn-dev/1.0',
  },
});
if (!response.ok) throw new Error(`Overpass: ${response.status}`);
const { elements } = (await response.json()) as { elements: OsmPlace[] };

const features: unknown[] = [];
const missing: string[] = [];
for (const [shown, kind, name] of CHOSEN) {
  const found = elements.find((element) => element.tags?.name === name);
  const lat = found?.lat ?? found?.center?.lat;
  const lon = found?.lon ?? found?.center?.lon;
  if (lat === undefined || lon === undefined) {
    missing.push(name);
    continue;
  }
  const height = Number.parseFloat(
    found?.tags?.ele ?? found?.tags?.height ?? '',
  );
  features.push({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5],
    },
    properties: {
      kind,
      name: shown,
      ...(Number.isFinite(height) ? { height } : {}),
    },
  });
}
writeFileSync(
  OUTPUT,
  `${JSON.stringify({ type: 'FeatureCollection', features })}\n`,
);
process.stdout.write(
  `${features.length} landmarks; missing: ${missing.join(', ') || 'none'}\n`,
);
