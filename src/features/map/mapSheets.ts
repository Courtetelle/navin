import type { GeoBox } from './constants.ts';

/**
 * The plan of the maps of Europe: two scales of sheets, like a chart index.
 * A large sheet (4° × 3°) is for the passage, up to zoom 10; a detailed sheet
 * (1° × 1°) for the coast, the harbours and the lakes, up to zoom 14.
 */
export type SheetScale = 'large' | 'detail';

/** A sheet of the plan. */
export interface MapSheet {
  /** File name, also the id of the map once on this device. */
  id: string;
  scale: SheetScale;
  box: GeoBox;
  minZoom: number;
  maxZoom: number;
}

/** The area of the plan. */
export const PLAN_BOX: GeoBox = { s: 34, w: -12, n: 62, e: 32 };

const SIZES: Readonly<
  Record<SheetScale, { lon: number; lat: number; min: number; max: number }>
> = {
  large: { lon: 4, lat: 3, min: 5, max: 10 },
  detail: { lon: 1, lat: 1, min: 6, max: 14 },
};

/** The tiles cover the whole planet only below this latitude. */
const MERCATOR_LAT = 85.0511;

function hemi(value: number, plus: string, minus: string): string {
  return `${Math.abs(value)}${value < 0 ? minus : plus}`;
}

/**
 * The sheet of a scale at its south-west corner.
 * @param scale - Its scale.
 * @param south - Latitude of its south side.
 * @param west - Longitude of its west side.
 * @returns The sheet.
 */
export function sheetAtCorner(
  scale: SheetScale,
  south: number,
  west: number,
): MapSheet {
  const size = SIZES[scale];
  const label = scale === 'large' ? 'Grande carte' : 'Carte détaillée';
  return {
    id: `${label} ${hemi(south, 'N', 'S')} ${hemi(west, 'E', 'W')}.pmtiles`,
    scale,
    box: { s: south, w: west, n: south + size.lat, e: west + size.lon },
    minZoom: size.min,
    maxZoom: size.max,
  };
}

/**
 * The sheet of a scale under a place of the plan.
 * @param scale - The scale.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns The sheet, or `null` out of the plan.
 */
export function sheetAt(
  scale: SheetScale,
  lat: number,
  lon: number,
): MapSheet | null {
  const size = SIZES[scale];
  if (
    lat < PLAN_BOX.s ||
    lat >= PLAN_BOX.n ||
    lon < PLAN_BOX.w ||
    lon >= PLAN_BOX.e
  ) {
    return null;
  }
  const south =
    PLAN_BOX.s + Math.floor((lat - PLAN_BOX.s) / size.lat) * size.lat;
  const west =
    PLAN_BOX.w + Math.floor((lon - PLAN_BOX.w) / size.lon) * size.lon;
  return sheetAtCorner(scale, south, west);
}

/**
 * Every sheet of a scale, minus those the test leaves out (land far from any
 * water, open sea far from the coast).
 * @param scale - The scale.
 * @param keep - Whether a 1° square deserves a map, by its south-west corner;
 *   every square is kept without it.
 * @returns The sheets, from the south-west.
 */
export function planSheets(
  scale: SheetScale,
  keep: (south: number, west: number) => boolean = () => true,
): MapSheet[] {
  const size = SIZES[scale];
  const sheets: MapSheet[] = [];
  for (let south = PLAN_BOX.s; south < PLAN_BOX.n; south += size.lat) {
    for (let west = PLAN_BOX.w; west < PLAN_BOX.e; west += size.lon) {
      let kept = false;
      for (let lat = south; lat < south + size.lat && !kept; lat++) {
        for (let lon = west; lon < west + size.lon && !kept; lon++) {
          kept = keep(lat, lon);
        }
      }
      if (kept) sheets.push(sheetAtCorner(scale, south, west));
    }
  }
  return sheets;
}

/**
 * The column of the tile under a longitude.
 * @param lon - Longitude.
 * @param zoom - Zoom.
 * @returns The column.
 */
export function tileX(lon: number, zoom: number): number {
  const count = 2 ** zoom;
  return Math.min(
    count - 1,
    Math.max(0, Math.floor(((lon + 180) / 360) * count)),
  );
}

/**
 * The row of the tile under a latitude.
 * @param lat - Latitude.
 * @param zoom - Zoom.
 * @returns The row.
 */
export function tileY(lat: number, zoom: number): number {
  const count = 2 ** zoom;
  const clamped = Math.max(-MERCATOR_LAT, Math.min(MERCATOR_LAT, lat));
  const sin = Math.sin((clamped * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * count;
  return Math.min(count - 1, Math.max(0, Math.floor(y)));
}

/**
 * The tiles of a sheet, from its first zoom to its last.
 * @param sheet - The sheet.
 * @returns Their places.
 */
export function sheetTiles(
  sheet: Pick<MapSheet, 'box' | 'minZoom' | 'maxZoom'>,
): Array<{ z: number; x: number; y: number }> {
  const tiles: Array<{ z: number; x: number; y: number }> = [];
  // A side shared with the next sheet belongs to it, not to this one.
  const edge = 1e-9;
  for (let z = sheet.minZoom; z <= sheet.maxZoom; z++) {
    const x0 = tileX(sheet.box.w, z);
    const x1 = tileX(sheet.box.e - edge, z);
    const y0 = tileY(sheet.box.n - edge, z);
    const y1 = tileY(sheet.box.s, z);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) tiles.push({ z, x, y });
    }
  }
  return tiles;
}

/** Average weight of a tile by zoom, for the estimate (bytes). */
function tileWeight(zoom: number): number {
  if (zoom >= 14) return 9000;
  if (zoom === 13) return 14_000;
  if (zoom >= 11) return 22_000;
  return 40_000;
}

/**
 * About how much a sheet weighs once downloaded.
 * @param sheet - The sheet.
 * @returns Bytes, rounded up to the MB.
 */
export function sheetEstimate(
  sheet: Pick<MapSheet, 'box' | 'minZoom' | 'maxZoom'>,
): number {
  let bytes = 0;
  for (const tile of sheetTiles(sheet)) bytes += tileWeight(tile.z);
  return Math.ceil(bytes / 1e6) * 1e6;
}

function degrees(value: number, plus: string, minus: string): string {
  return `${Math.abs(value)}° ${value < 0 ? minus : plus}`;
}

/**
 * What a sheet covers, in words.
 * @param sheet - The sheet.
 * @returns E.g. « 48° N à 49° N · 3° W à 2° W ».
 */
export function sheetArea(sheet: Pick<MapSheet, 'box'>): string {
  const { s, n, w, e } = sheet.box;
  return `${degrees(s, 'N', 'S')} à ${degrees(n, 'N', 'S')} · ${degrees(w, 'E', 'W')} à ${degrees(e, 'E', 'W')}`;
}

/**
 * The title of a sheet, also the name of its map once on this device.
 * @param sheet - The sheet.
 * @returns E.g. « Carte détaillée 48N 3W ».
 */
export function sheetTitle(sheet: Pick<MapSheet, 'id'>): string {
  return sheet.id.replace(/\.pmtiles$/u, '');
}
