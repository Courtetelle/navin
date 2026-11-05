import { rad } from '../../lib/geo.ts';

import type { LatLngPair } from './constants.ts';
import { escapeHtml } from './escapeHtml.ts';
import type { OsmElement } from './osmFeatures.ts';

/** Rules of a shore zone. */
interface ZoneRules {
  title: string;
  rules: readonly string[];
}

const ZONE_RULES: Record<150 | 300, ZoneRules> = {
  150: {
    title: 'Zone riveraine intérieure · moins de 150 m',
    rules: [
      'On y passe seulement pour accoster, partir ou stationner, par le chemin le plus court, perpendiculairement à la rive (ONI art. 53, RNL).',
      'Au moteur : 10 km/h au maximum.',
      'Interdit d’entrer dans les roseaux, joncs et nénuphars : garder en général 25 m (ONI art. 53).',
      'Bouées jaunes : zones interdites à la navigation (baignade, réserves).',
    ],
  },
  300: {
    title: 'Zone riveraine extérieure · 150 à 300 m',
    rules: [
      'Au moteur : 10 km/h au maximum à moins de 300 m de la rive (ONI art. 53, RNL).',
      'La zone se mesure depuis la rive, les roselières ou les constructions dans l’eau.',
      'Au-delà de 300 m, gilets et équipement de sécurité exigés à bord.',
    ],
  },
};

/**
 * Douglas-Peucker simplification of a shore, in degrees (legacy `dpSimplify`).
 * @param points - `[lat, lon]` points.
 * @param tolerance - Largest distance allowed.
 * @returns The points kept.
 */
export function dpSimplify(
  points: readonly LatLngPair[],
  tolerance: number,
): LatLngPair[] {
  if (points.length < 3) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop() as [number, number];
    let worst = 0;
    let worstIndex = -1;
    const [ax, ay] = points[first] as LatLngPair;
    const [bx, by] = points[last] as LatLngPair;
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    for (let index = first + 1; index < last; index++) {
      const [px, py] = points[index] as LatLngPair;
      const along = length ? ((px - ax) * dx + (py - ay) * dy) / length : 0;
      const ratio = Math.max(0, Math.min(1, along));
      const ex = ax + ratio * dx - px;
      const ey = ay + ratio * dy - py;
      const distance = ex * ex + ey * ey;
      if (distance > worst) {
        worst = distance;
        worstIndex = index;
      }
    }
    if (worstIndex > 0 && worst > tolerance * tolerance) {
      keep[worstIndex] = 1;
      stack.push([first, worstIndex], [worstIndex, last]);
    }
  }
  const kept: LatLngPair[] = [];
  for (let index = 0; index < points.length; index++) {
    if (keep[index]) kept.push(points[index] as LatLngPair);
  }
  return kept;
}

/**
 * Join the pieces of shore of an Overpass answer into closed rings: the lake and
 * its islands (legacy `shoreRings`).
 * @param elements - Overpass elements.
 * @returns The rings, simplified and rounded to 5 decimals.
 */
export function shoreRings(elements: readonly OsmElement[]): LatLngPair[][] {
  const pieces: LatLngPair[][] = [];
  for (const element of elements) {
    for (const member of element.members ?? []) {
      if (member.geometry && member.geometry.length > 1) {
        pieces.push(
          member.geometry.map((node): LatLngPair => [node.lat, node.lon]),
        );
      }
    }
  }
  const rings: LatLngPair[][] = [];
  while (pieces.length > 0) {
    const ring = growRing(pieces.shift() as LatLngPair[], pieces);
    if (ring.length > 3) {
      const rounded: LatLngPair[] = [];
      for (const [lat, lon] of dpSimplify(ring, 0.000_04)) {
        rounded.push([
          Math.round(lat * 1e5) / 1e5,
          Math.round(lon * 1e5) / 1e5,
        ]);
      }
      rings.push(rounded);
    }
  }
  return rings;
}

/**
 * Whether a point is in the lake, even-odd: islands are holes (legacy `inShore`).
 * @param rings - Lake rings.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns `true` on the water.
 */
export function inShore(
  rings: readonly LatLngPair[][],
  lat: number,
  lon: number,
): boolean {
  let inside = false;
  for (const ring of rings) {
    let previous = ring.length - 1;
    for (let index = 0; index < ring.length; index++) {
      const [latA, lonA] = ring[index] as LatLngPair;
      const [latB, lonB] = ring[previous] as LatLngPair;
      if (
        latA > lat !== latB > lat &&
        lon < ((lonB - lonA) * (lat - latA)) / (latB - latA) + lonA
      ) {
        inside = !inside;
      }
      previous = index;
    }
  }
  return inside;
}

/**
 * Distance to the nearest shore in metres (legacy `shoreDist`).
 * @param rings - Lake rings.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The distance.
 */
export function shoreDist(
  rings: readonly LatLngPair[][],
  lat: number,
  lon: number,
): number {
  const metresPerLat = 111_320;
  const metresPerLon = 111_320 * Math.cos(rad(lat));
  let best = Infinity;
  for (const ring of rings) {
    for (let index = 1; index < ring.length; index++) {
      const [fromLat, fromLon] = ring[index - 1] as LatLngPair;
      const [toLat, toLon] = ring[index] as LatLngPair;
      const ax = (fromLon - lon) * metresPerLon;
      const ay = (fromLat - lat) * metresPerLat;
      const dx = (toLon - lon) * metresPerLon - ax;
      const dy = (toLat - lat) * metresPerLat - ay;
      const length = dx * dx + dy * dy;
      const along = length ? -(ax * dx + ay * dy) / length : 0;
      const ratio = Math.max(0, Math.min(1, along));
      const ex = ax + ratio * dx;
      const ey = ay + ratio * dy;
      best = Math.min(best, ex * ex + ey * ey);
    }
  }
  return Math.sqrt(best);
}

/**
 * HTML of the popup of a shore zone (legacy `zonePopupHtml`).
 * @param distance - Distance to the shore in metres.
 * @returns The popup content.
 */
export function zonePopupHtml(distance: number): string {
  const zone = ZONE_RULES[distance < 150 ? 150 : 300];
  const rules = zone.rules
    .map((rule) => `<li>${escapeHtml(rule)}</li>`)
    .join('');
  return `<div class="zone-pop"><b>${escapeHtml(zone.title)}</b><br><small>≈ ${Math.round(distance)} m de la rive (contour indicatif)</small><ul>${rules}</ul></div>`;
}

function samePoint(first: LatLngPair, second: LatLngPair): boolean {
  return (
    Math.abs(first[0] - second[0]) < 1e-7 &&
    Math.abs(first[1] - second[1]) < 1e-7
  );
}

function growRing(start: LatLngPair[], pieces: LatLngPair[][]): LatLngPair[] {
  let ring = start;
  let grown = true;
  while (
    grown &&
    !samePoint(ring[0] as LatLngPair, ring.at(-1) as LatLngPair)
  ) {
    grown = false;
    for (let index = 0; index < pieces.length; index++) {
      const piece = pieces[index] as LatLngPair[];
      const end = ring.at(-1) as LatLngPair;
      if (samePoint(piece[0] as LatLngPair, end)) {
        ring = [...ring, ...piece.slice(1)];
      } else if (samePoint(piece.at(-1) as LatLngPair, end)) {
        ring = [...ring, ...piece.slice(0, -1).toReversed()];
      } else {
        continue;
      }
      pieces.splice(index, 1);
      grown = true;
      break;
    }
  }
  return ring;
}
