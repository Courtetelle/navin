/*
 * The buoyage of Lake Geneva kept in the app, so that it shows without network,
 * from OpenStreetMap:
 *
 *   node scripts/bathy/generateSeamarks.ts
 */
import { writeFileSync } from 'node:fs';

import type { OsmElement } from '../../src/features/map/osmFeatures.ts';
import { osmToFeats } from '../../src/features/map/osmFeatures.ts';

const OUTPUT = 'src/features/map/lemanSeamarks.json';
const BOX = '46.18,6.10,46.56,6.98';
const QUERY = `[out:json][timeout:90];
(
  nwr["seamark:type"](${BOX});
  nwr["leisure"="marina"](${BOX});
  nwr["amenity"="ferry_terminal"](${BOX});
);
out tags geom;`;
const response = await fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: `data=${encodeURIComponent(QUERY)}`,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'NavIn-dev/1.0',
  },
});
if (!response.ok) throw new Error(`Overpass: ${response.status}`);
const { elements } = (await response.json()) as { elements: OsmElement[] };
// Too many to draw on a phone, or of no use to find the way.
const LEFT_OUT = new Set(['pier', 'small_craft_facility']);
const feats = osmToFeats(elements).filter(
  (feature) =>
    !LEFT_OUT.has(feature.k) && !LEFT_OUT.has(feature.t['seamark:type'] ?? ''),
);
writeFileSync(OUTPUT, `${JSON.stringify({ feats })}\n`);
process.stdout.write(`${feats.length} features in ${OUTPUT}\n`);
