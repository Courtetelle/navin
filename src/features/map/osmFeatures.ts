import type { LatLngPair } from './constants.ts';
import { escapeHtml } from './escapeHtml.ts';

/** Tags kept from OpenStreetMap. */
export type OsmTags = Record<string, string>;

/** Geometry kinds: point, line, area, multi-polygon. */
export type OsmGeometry = 'p' | 'l' | 'a' | 'm';

/** A feature of the vector chart (`k` kind, `g` geometry, `c` coordinates, `t` tags). */
export interface OsmFeature {
  k: string;
  g: OsmGeometry;
  c: LatLngPair | LatLngPair[] | LatLngPair[][];
  t: OsmTags;
}

interface OsmNode {
  lat: number;
  lon: number;
}

/** One element of an Overpass answer. */
export interface OsmElement {
  type?: string;
  lat?: number;
  lon?: number;
  tags?: OsmTags;
  geometry?: OsmNode[];
  members?: Array<{ role?: string; geometry?: OsmNode[] }>;
}

const SEAMARK_FR = new Map<string, string>([
  ['light_major', 'Feu principal'],
  ['light_minor', 'Feu'],
  ['light', 'Feu'],
  ['light_float', 'Feu flottant'],
  ['buoy_lateral', 'Bouée latérale'],
  ['buoy_cardinal', 'Bouée cardinale'],
  ['buoy_isolated_danger', 'Bouée de danger isolé'],
  ['buoy_safe_water', 'Bouée d’eaux saines'],
  ['buoy_special_purpose', 'Bouée spéciale'],
  ['buoy_installation', 'Bouée'],
  ['beacon_lateral', 'Balise latérale'],
  ['beacon_cardinal', 'Balise cardinale'],
  ['beacon_isolated_danger', 'Balise de danger isolé'],
  ['beacon_special_purpose', 'Balise spéciale'],
  ['beacon_safe_water', 'Balise d’eaux saines'],
  ['mooring', 'Corps-mort / duc-d’Albe'],
  ['harbour', 'Port'],
  ['small_craft_facility', 'Équipement de plaisance'],
  ['restricted_area', 'Zone réglementée'],
  ['fairway', 'Chenal'],
  ['anchorage', 'Mouillage'],
  ['rock', 'Roche'],
  ['wreck', 'Épave'],
  ['obstruction', 'Obstruction'],
  ['landmark', 'Amer'],
  ['signal_station_warning', 'Feu d’avis de tempête'],
  ['bridge', 'Pont'],
  ['cable_submarine', 'Câble sous-marin'],
  ['pipeline_submarine', 'Conduite sous-marine'],
  ['notice', 'Panneau'],
  ['distance_mark', 'Borne'],
]);
const OSM_COLOURS: Record<string, string> = {
  red: '#d40000',
  green: '#008a2e',
  yellow: '#ffd400',
  white: '#ffffff',
  black: '#111111',
  orange: '#ff8c00',
  blue: '#0050d0',
};
const KEPT_TAGS = new Set([
  'name',
  'ref',
  'man_made',
  'leisure',
  'amenity',
  'operator',
]);

/**
 * Convert an Overpass answer to the features kept on the device (legacy `osmToFeats`).
 * @param elements - Overpass elements.
 * @returns The features, coordinates rounded to 5 decimals.
 */
export function osmToFeats(elements: readonly OsmElement[]): OsmFeature[] {
  const features: OsmFeature[] = [];
  for (const element of elements) {
    const tags = keptTags(element.tags);
    const kind = osmKind(element.tags ?? {});
    if (element.type === 'node') {
      features.push({
        k: kind,
        g: 'p',
        c: [round5(element.lat as number), round5(element.lon as number)],
        t: tags,
      });
    } else if (element.type === 'way' && element.geometry) {
      features.push(wayFeature(kind, element.geometry, tags));
    } else if (element.type === 'relation' && element.members) {
      const rings: LatLngPair[][] = [];
      for (const member of element.members) {
        if (member.geometry && member.role !== 'inner') {
          rings.push(toLine(member.geometry));
        }
      }
      if (rings.length > 0) {
        features.push({ k: kind, g: 'm', c: rings, t: tags });
      }
    }
  }
  return features;
}

/**
 * Colours of a seamark (legacy `seamarkColour`).
 * @param tags - Feature tags.
 * @returns CSS colours, or `null` when none is known.
 */
export function seamarkColour(tags: OsmTags): string[] | null {
  const type = tags['seamark:type'] ?? '';
  const anyColour = Object.entries(tags).find(([key]) =>
    key.endsWith(':colour'),
  )?.[1];
  const value =
    tags[`seamark:${type}:colour`] ||
    tags['seamark:light:colour'] ||
    anyColour ||
    '';
  const colours: string[] = [];
  for (const name of value.split(';')) {
    const colour = OSM_COLOURS[name.trim()];
    if (colour) colours.push(colour);
  }
  return colours.length > 0 ? colours : null;
}

/**
 * HTML of the popup of a feature (legacy `seamarkPopup`).
 * @param feature - The feature.
 * @returns The popup content.
 */
export function seamarkPopup(feature: OsmFeature): string {
  const tags = feature.t;
  const fallback = feature.k === 'harbour' ? 'harbour' : feature.k;
  const type = tags['seamark:type'] || fallback;
  const name = tags['seamark:name'] || tags.name || '';
  const spoken = type.replaceAll('_', ' ');
  const title =
    name || SEAMARK_FR.get(type) || (feature.k === 'pier' ? 'Jetée' : spoken);
  const lines = [`<b>${escapeHtml(title)}</b>`];
  if (name) lines.push(escapeHtml(SEAMARK_FR.get(type) || spoken));
  const character = tags['seamark:light:character'];
  if (character) lines.push(lightLine(character, tags));
  const category = tags[`seamark:${type}:category`];
  if (category) lines.push(escapeHtml(category.replaceAll('_', ' ')));
  const restriction = tags['seamark:restricted_area:restriction'];
  if (restriction) lines.push(escapeHtml(restriction.replaceAll('_', ' ')));
  const information =
    tags['seamark:information'] || tags['seamark:notice:information'];
  if (information) lines.push(escapeHtml(information));
  if (tags.ref) lines.push(`Réf. ${escapeHtml(tags.ref)}`);
  return lines.join('<br>');
}

function lightLine(character: string, tags: OsmTags): string {
  const group = tags['seamark:light:group'];
  const period = tags['seamark:light:period'];
  const groupText = group ? `(${escapeHtml(group)})` : '';
  const periodText = period ? ` ${escapeHtml(period)} s` : '';
  return `Feu ${escapeHtml(character)}${groupText} ${escapeHtml(tags['seamark:light:colour'] || '')}${periodText}`;
}

function osmKind(tags: OsmTags): string {
  if (tags['seamark:type']) return tags['seamark:type'];
  if (tags.leisure === 'marina') return 'harbour';
  if (tags.amenity === 'ferry_terminal') return 'ferry';
  return tags.man_made ? 'pier' : 'other';
}

function keptTags(tags: OsmTags | undefined): OsmTags {
  const kept: OsmTags = {};
  for (const [key, value] of Object.entries(tags ?? {})) {
    if (KEPT_TAGS.has(key) || key.startsWith('seamark:')) kept[key] = value;
  }
  return kept;
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

function toLine(nodes: readonly OsmNode[]): LatLngPair[] {
  return nodes.map((node) => [round5(node.lat), round5(node.lon)]);
}

function wayFeature(
  kind: string,
  nodes: readonly OsmNode[],
  tags: OsmTags,
): OsmFeature {
  const line = toLine(nodes);
  if (kind === 'ferry') {
    let lat = 0;
    let lon = 0;
    for (const point of line) {
      lat += point[0];
      lon += point[1];
    }
    return {
      k: kind,
      g: 'p',
      c: [round5(lat / line.length), round5(lon / line.length)],
      t: tags,
    };
  }
  const first = line[0];
  const last = line.at(-1);
  const closed =
    line.length > 3 && first?.[0] === last?.[0] && first?.[1] === last?.[1];
  return {
    k: kind,
    g: closed && kind !== 'pier' ? 'a' : 'l',
    c: line,
    t: tags,
  };
}
