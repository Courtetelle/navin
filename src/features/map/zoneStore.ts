import { store } from '../../storage/store.ts';

import type { GeoBox, LatLngPair } from './constants.ts';

/** Plan of the offline zones (OSM data, CARTO Voyager tiles: OSM servers forbid bulk downloads). */
export const ZONE_BASE =
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
/** Tiles per layer and per zone, to stay reasonable. */
export const ZONE_MAX = 8000;
/** Levels of detail offered: zoom and label. */
export const ZONE_ZOOMS: ReadonlyArray<readonly [number, string]> = [
  [12, 'Large'],
  [13, 'Côtier'],
  [14, 'Détaillé'],
  [15, 'Très détaillé'],
];

/** A tile: zoom, column, row. */
export type TileXY = [number, number, number];

/** A zone kept offline (`ldb.zones`). */
export interface Zone {
  id: string;
  name: string;
  b: GeoBox;
  zmax: number;
  at: string;
  /** @default undefined */
  ok?: number;
  /** @default undefined */
  ko?: number;
  /** @default undefined */
  center?: LatLngPair;
  /** @default undefined */
  km?: number;
}

/**
 * The offline zones (legacy `zoneList`).
 * @returns The stored zones.
 */
export function zoneList(): Zone[] {
  return store.get<Zone[]>('ldb.zones', []);
}

/**
 * Store the offline zones (legacy `zoneSave`).
 * @param zones - Zones to keep.
 */
export function zoneSave(zones: readonly Zone[]): void {
  store.set('ldb.zones', zones);
}

/**
 * Tiles covering a box from zoom 6 to `zoomMax` (legacy `zoneTileXY`).
 * @param box - Geographic box.
 * @param zoomMax - Highest zoom.
 * @returns The tiles.
 */
export function zoneTileXY(box: GeoBox, zoomMax: number): TileXY[] {
  const tiles: TileXY[] = [];
  for (let zoom = 6; zoom <= zoomMax; zoom++) {
    const xEnd = tileX(box.e, zoom);
    const yEnd = tileY(box.s, zoom);
    for (let x = tileX(box.w, zoom); x <= xEnd; x++) {
      for (let y = tileY(box.n, zoom); y <= yEnd; y++) {
        tiles.push([zoom, x, y]);
      }
    }
  }
  return tiles;
}

/**
 * Address of a tile (legacy `zoneUrl`).
 * @param template - URL with `{z}`, `{x}`, `{y}`.
 * @param tile - The tile.
 * @returns The URL.
 */
export function zoneUrl(template: string, [z, x, y]: TileXY): string {
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

/**
 * The offline zone holding a position (legacy `zoneAt`).
 * @param position - `[lat, lon]`, or nothing.
 * @returns The zone, if any.
 */
export function zoneAt(position: LatLngPair | null): Zone | undefined {
  if (!position) return undefined;
  const [lat, lon] = position;
  return zoneList().find(
    (zone) =>
      lat >= zone.b.s && lat <= zone.b.n && lon >= zone.b.w && lon <= zone.b.e,
  );
}

/**
 * Text under the zone map: size of the download, or the refusal (legacy `est`).
 * @param tiles - Tiles per layer.
 * @returns The sentence.
 */
export function zoneEstimate(tiles: number): string {
  if (tiles > ZONE_MAX) {
    return `Zone trop grande pour ce détail (${tiles} tuiles par couche, maximum ${ZONE_MAX}) : rapprochez la carte ou baissez le détail.`;
  }
  const size = Math.max(1, Math.round(tiles * 2 * 0.018));
  return `Environ ${tiles * 2} tuiles (plan + balisage), ≈ ${size} Mo.`;
}

function tileX(lon: number, zoom: number): number {
  const last = 2 ** zoom - 1;
  return Math.max(
    0,
    Math.min(last, Math.floor(((lon + 180) / 360) * 2 ** zoom)),
  );
}

function tileY(lat: number, zoom: number): number {
  const last = 2 ** zoom - 1;
  const radians = (lat * Math.PI) / 180;
  const mercator = Math.log(Math.tan(radians) + 1 / Math.cos(radians));
  const row = ((1 - mercator / Math.PI) / 2) * 2 ** zoom;
  return Math.max(0, Math.min(last, Math.floor(row)));
}
