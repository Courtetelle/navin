import type { Layer } from 'leaflet';

import { rad } from '../../lib/geo.ts';

import type { LatLngPair } from './constants.ts';
import { escapeHtml } from './escapeHtml.ts';
import { leaflet } from './leaflet.ts';
import type { LemanVector } from './lemanVector.ts';
import type { OsmFeature } from './osmFeatures.ts';

/** A place where swimming is forbidden. */
export interface BathPoint {
  ll: LatLngPair;
  what: string;
  name: string;
}

const BATH_RULE =
  'Baignade interdite à moins de 100 m de l’entrée d’un port ou d’un débarcadère de la CGN (ONI art. 77). Les bateaux y manœuvrent et ne voient pas les nageurs.';

/**
 * Places where swimming is forbidden: harbour entrances (lights and beacons
 * within 200 m of a harbour) and ferry piers (legacy `bathPoints`).
 * @param features - Features of the vector chart.
 * @returns The places, never two within 30 m.
 */
export function bathPoints(features: readonly OsmFeature[]): BathPoint[] {
  const harbours = features.filter(
    (feature) =>
      feature.k === 'harbour' || feature.t['seamark:type'] === 'harbour',
  );
  const points: BathPoint[] = [];
  for (const feature of features) {
    if (feature.g !== 'p') continue;
    const position = feature.c as LatLngPair;
    const type = feature.t['seamark:type'] ?? '';
    if (feature.k === 'ferry') {
      points.push({
        ll: position,
        what: 'débarcadère',
        name: feature.t.name ?? '',
      });
    } else if (
      (type.startsWith('light') ||
        type.startsWith('beacon') ||
        feature.t['seamark:light:character']) &&
      nearHarbour(position, harbours)
    ) {
      points.push({
        ll: position,
        what: 'entrée de port',
        name: feature.t['seamark:name'] || feature.t.name || '',
      });
    }
  }
  return points.filter(
    (point, index) =>
      !points.slice(0, index).some((other) => isNear(point.ll, other.ll, 30)),
  );
}

/**
 * Circles of 100 m where swimming is forbidden (legacy `bathLayer`).
 * @param vector - The vector chart.
 * @returns The layer, or `null` without any place.
 */
export function bathLayer(vector: LemanVector | null): Layer | null {
  if (!vector?.feats) return null;
  const places = bathPoints(vector.feats);
  if (places.length === 0) return null;
  const L = leaflet();
  const group = L.layerGroup();
  for (const place of places) {
    const name = place.name ? `${place.name} · ` : '';
    L.circle(place.ll, {
      radius: 100,
      color: '#0050d0',
      weight: 2,
      dashArray: '4 4',
      fillColor: '#3a8dff',
      fillOpacity: 0.15,
    })
      .bindPopup(
        `<div class="zone-pop"><b>🚫🏊 Baignade interdite · 100 m</b><br><small>${escapeHtml(name)}${place.what} (position OpenStreetMap, indicative)</small><ul><li>${escapeHtml(BATH_RULE)}</li></ul></div>`,
        { maxWidth: 300 },
      )
      .addTo(group);
  }
  return group;
}

function isNear(
  first: LatLngPair,
  second: LatLngPair,
  metres: number,
): boolean {
  const metresPerLat = 111_320;
  const metresPerLon = 111_320 * Math.cos(rad(first[0]));
  const distance = Math.hypot(
    (first[0] - second[0]) * metresPerLat,
    (first[1] - second[1]) * metresPerLon,
  );
  return distance < metres;
}

function nearHarbour(
  position: LatLngPair,
  harbours: readonly OsmFeature[],
): boolean {
  return harbours.some((harbour) => {
    if (harbour.g === 'a' || harbour.g === 'm') {
      const rings =
        harbour.g === 'a'
          ? [harbour.c as LatLngPair[]]
          : (harbour.c as LatLngPair[][]);
      return rings.some((ring) =>
        ring.some((point) => isNear(position, point, 200)),
      );
    }
    return isNear(position, harbour.c as LatLngPair, 200);
  });
}
