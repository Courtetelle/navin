import type { PlaceEntry } from '../../shell/search/searchIndex.ts';

/** Closest and farthest zoom given from the size of a place found. */
const ZOOM_MIN = 8;
const ZOOM_MAX = 13;

/**
 * Text without accents nor capitals, to compare names.
 * @param text - A name.
 * @returns The plain text.
 */
export function plain(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .replaceAll(/[’']/gu, ' ')
    .toLowerCase();
}

/**
 * The zoom that shows a place found whole, from its box.
 * @param bounds - South, north, west, east.
 * @returns The zoom, or `undefined` without a box.
 */
export function zoomOf(
  bounds: PlaceEntry['bounds'] | undefined,
): number | undefined {
  if (!bounds) return undefined;
  const [south, north, west, east] = bounds;
  const middle = (south + north) / 2;
  const span = Math.max(
    north - south,
    (east - west) * Math.cos((middle * Math.PI) / 180),
    0.005,
  );
  const zoom = Math.floor(Math.log2(540 / span));
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom));
}
