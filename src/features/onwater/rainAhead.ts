/**
 * The rain ahead on the map of LiveMétéo, as fine as the radar of the hour
 * now: one grid of the model ICON-EU (DWD, 6.5 km) per hour, made at each run
 * by the workflow « Analyse météo » (analyse/pluie.py) and published with
 * NavIn under `analyse/v/pluie/`. Each hour is a grey PNG (mm/h × 10); here
 * it is smoothed between the points, laid out for the map (Mercator rows) and
 * shaded in the colours of the radar.
 */
import { rainColor } from './mapWeather.ts';

/** What `analyse/v/pluie/index.json` holds. */
export interface RainIndex {
  model: string;
  run: string;
  /** South and north edges, degrees. */
  lat: [number, number];
  /** West and east edges, degrees. */
  lon: [number, number];
  /** Points across and down. */
  w: number;
  h: number;
  /** mm/h for one grey level. */
  scale: number;
  /** Times the hour of rain ends, ms, with its file beside. */
  hours: number[];
  files: string[];
}

const RAIN_DIR = 'analyse/v/pluie/';
/** How often the index is read again, ms. */
const INDEX_MS = 10 * 60_000;
/** Output pixels for one step of the grid, across. */
const FINE = 4;
/** Grey levels are cut in this many parts for the colours. */
const SUB = 4;

const pair = (value: unknown): [number, number] | null =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every((item) => typeof item === 'number' && Number.isFinite(item)) &&
  (value[0] as number) < (value[1] as number)
    ? [value[0] as number, value[1] as number]
    : null;

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 2
    ? value
    : null;

/**
 * Read the index, keeping only what is well formed.
 * @param raw - The parsed JSON.
 * @returns The index, or null.
 */
export function parseRainIndex(raw: unknown): RainIndex | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const lat = pair(item.lat);
  const lon = pair(item.lon);
  const w = count(item.w);
  const h = count(item.h);
  const scale = item.scale;
  if (!lat || !lon || !w || !h) return null;
  if (typeof scale !== 'number' || !(scale > 0)) return null;
  if (!Array.isArray(item.hours) || !Array.isArray(item.files)) return null;
  if (item.hours.length !== item.files.length) return null;
  const hours: number[] = [];
  const files: string[] = [];
  for (const [rank, at] of item.hours.entries()) {
    const file: unknown = item.files[rank];
    const ms = typeof at === 'string' ? Date.parse(at) : Number.NaN;
    if (!Number.isFinite(ms)) continue;
    if (typeof file !== 'string' || !/^[\w.-]+\.png$/.test(file)) continue;
    hours.push(ms);
    files.push(file);
  }
  if (hours.length === 0) return null;
  return {
    model: typeof item.model === 'string' ? item.model : 'ICON-EU',
    run: typeof item.run === 'string' ? item.run : '',
    lat,
    lon,
    w,
    h,
    scale,
    hours,
    files,
  };
}

/**
 * The file of the hour shown: the hour of rain that ends at that time (as the
 * rain of Open-Meteo, the hour before).
 * @param index - The index.
 * @param ms - The time shown, ms.
 * @returns The file name, or null when the run does not reach it.
 */
export function rainFileAt(index: RainIndex, ms: number): string | null {
  let best: string | null = null;
  let gap = 30 * 60_000;
  for (const [rank, at] of index.hours.entries()) {
    const away = Math.abs(at - ms);
    if (away <= gap) {
      gap = away;
      best = index.files[rank] ?? null;
    }
  }
  return best;
}

const mercator = (lat: number): number =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

const latOf = (y: number): number => (Math.atan(Math.sinh(y)) * 180) / Math.PI;

/** The size of the image for the map: rows even in Mercator, as the map. */
export function rainImageSize(index: RainIndex): {
  width: number;
  height: number;
} {
  const width = (index.w - 1) * FINE;
  const across = ((index.lon[1] - index.lon[0]) * Math.PI) / 180;
  const down = mercator(index.lat[1]) - mercator(index.lat[0]);
  return { width, height: Math.max(2, Math.round((width * down) / across)) };
}

function colourTable(scale: number): Uint8ClampedArray {
  const table = new Uint8ClampedArray(256 * SUB * 4);
  for (let level = 0; level < 256 * SUB; level++) {
    const colour = rainColor((level / SUB) * scale);
    if (!colour) continue;
    const hex = Number.parseInt(colour.slice(1), 16);
    table[level * 4] = (hex >> 16) & 255;
    table[level * 4 + 1] = (hex >> 8) & 255;
    table[level * 4 + 2] = hex & 255;
    table[level * 4 + 3] = 255;
  }
  return table;
}

/**
 * Shade one hour: each pixel takes the rain between its four points
 * (bilinear), then the colour of the radar for that much rain.
 * @param index - The index (frame and scale).
 * @param grey - The grey levels, row 0 at the north, `w` × `h`.
 * @returns RGBA pixels and their size, for the frame of the index.
 */
export function rainPixels(
  index: RainIndex,
  grey: ArrayLike<number>,
): { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> } {
  const { w, h, lat: edges, scale } = index;
  const { width, height } = rainImageSize(index);
  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4));
  const table = colourTable(scale);
  const top = mercator(edges[1]);
  const bottom = mercator(edges[0]);
  const latStep = (edges[1] - edges[0]) / (h - 1);
  const columns = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    columns[x] = ((x + 0.5) / width) * (w - 1);
  }
  const last = 256 * SUB - 1;
  for (let y = 0; y < height; y++) {
    const lat = latOf(top - ((y + 0.5) / height) * (top - bottom));
    const row = Math.min(h - 1, Math.max(0, (edges[1] - lat) / latStep));
    const r0 = Math.min(h - 2, Math.floor(row));
    const fy = row - r0;
    const above = r0 * w;
    const below = above + w;
    for (let x = 0; x < width; x++) {
      const column = columns[x] as number;
      const c0 = Math.min(w - 2, Math.floor(column));
      const fx = column - c0;
      const a = Number(grey[above + c0]);
      const b = Number(grey[above + c0 + 1]);
      const c = Number(grey[below + c0]);
      const d = Number(grey[below + c0 + 1]);
      if (a + b + c + d === 0) continue;
      const value =
        (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
      const level = Math.min(last, Math.round(value * SUB)) * 4;
      if (table[level + 3] === 0) continue;
      const at = (y * width + x) * 4;
      data[at] = table[level] as number;
      data[at + 1] = table[level + 1] as number;
      data[at + 2] = table[level + 2] as number;
      data[at + 3] = 255;
    }
  }
  return { width, height, data };
}

let indexRead: { at: number; index: Promise<RainIndex | null> } | null = null;

/** The index, read again every 10 minutes; null when it is not there. */
export function fetchRainIndex(): Promise<RainIndex | null> {
  const now = Date.now();
  if (indexRead && now - indexRead.at < INDEX_MS) return indexRead.index;
  const index = fetch(`${import.meta.env.BASE_URL}${RAIN_DIR}index.json`)
    .then((response) => (response.ok ? response.json() : null))
    .then((raw: unknown) => parseRainIndex(raw))
    .catch(() => null);
  indexRead = { at: now, index };
  return index;
}

/**
 * The image of one hour, ready for the map: an address of the shaded image.
 * @param index - The index.
 * @param file - The file of the hour.
 * @returns An object URL (to revoke once off the map), or null.
 */
export async function rainImageUrl(
  index: RainIndex,
  file: string,
): Promise<string | null> {
  try {
    const response = await fetch(
      `${import.meta.env.BASE_URL}${RAIN_DIR}${file}`,
    );
    if (!response.ok) return null;
    const bitmap = await globalThis.createImageBitmap(await response.blob(), {
      colorSpaceConversion: 'none',
      premultiplyAlpha: 'none',
    });
    if (bitmap.width !== index.w || bitmap.height !== index.h) return null;
    const read = document.createElement('canvas');
    read.width = index.w;
    read.height = index.h;
    const readContext = read.getContext('2d', { willReadFrequently: true });
    if (!readContext) return null;
    readContext.drawImage(bitmap, 0, 0);
    const rgba = readContext.getImageData(0, 0, index.w, index.h).data;
    const grey = new Uint8Array(index.w * index.h);
    for (let at = 0; at < grey.length; at++) grey[at] = rgba[at * 4] ?? 0;
    const { width, height, data } = rainPixels(index, grey);
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const outContext = out.getContext('2d');
    if (!outContext) return null;
    outContext.putImageData(new ImageData(data, width, height), 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => {
      out.toBlob(resolve, 'image/png');
    });
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}
