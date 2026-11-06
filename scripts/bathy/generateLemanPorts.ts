/*
 * Keeps the outlines of the ports of Lake Geneva, from OpenStreetMap, shipped
 * with the app so that the depth alarm knows them without network:
 *
 *   node scripts/bathy/generateLemanPorts.ts
 */
import { writeFileSync } from 'node:fs';

import type { LatLngPair } from '../../src/features/map/constants.ts';
import { LEMAN_BBOX } from '../../src/features/map/constants.ts';
import type { OsmElement } from '../../src/features/map/osmFeatures.ts';
import { shoreRings } from '../../src/features/map/shore.ts';

const OUTPUT = 'src/features/map/lemanPorts.json';
/** Larger than this in degrees (about 2 km), it is not one port. */
const MAX_SPAN = 0.02;
const { s, w, n, e } = LEMAN_BBOX;
const BOX = `${s},${w},${n},${e}`;
const QUERY = `[out:json][timeout:100];
(
  nwr["leisure"="marina"](${BOX});
  nwr["harbour"](${BOX});
  nwr["seamark:type"="harbour"](${BOX});
);
out geom;`;

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

// A closed way is one outline; a relation gives its members.
const rings = shoreRings(
  elements.map((element) =>
    element.members
      ? element
      : { members: element.geometry ? [{ geometry: element.geometry }] : [] },
  ),
).filter((ring) => {
  const lats = ring.map(([lat]) => lat);
  const lons = ring.map(([, lon]) => lon);
  return (
    Math.max(...lats) - Math.min(...lats) < MAX_SPAN &&
    Math.max(...lons) - Math.min(...lons) < MAX_SPAN
  );
});
// A port known only as a point.
const points: LatLngPair[] = [];
for (const element of elements) {
  if (
    element.type === 'node' &&
    element.lat !== undefined &&
    element.lon !== undefined &&
    /^port\b/i.test(element.tags?.name ?? '')
  ) {
    points.push([element.lat, element.lon]);
  }
}
writeFileSync(OUTPUT, `${JSON.stringify({ rings, points })}\n`);
process.stdout.write(`${rings.length} outlines, ${points.length} points\n`);
