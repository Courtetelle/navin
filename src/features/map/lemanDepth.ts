import { wgsToLv95 } from './bathyGeometry.ts';
import { LEMAN_BBOX } from './constants.ts';
import {
  DEPTH_CELL_M,
  DEPTH_DEEP,
  DEPTH_SCALE,
  DEPTH_TILE_CELLS,
} from './lemanDepthFormat.ts';
import tiles from './lemanDepthTiles.json' with { type: 'json' };
import { inLemanPort } from './lemanPorts.ts';

/** Reads the cells of a tile, row 0 to the north. */
export type DepthTileLoader = (key: string) => Promise<Uint8Array>;

const SHALLOW_TILES: ReadonlySet<string> = new Set(tiles);
/** A boat stays in few tiles: enough to read them only once in a while. */
const CACHED_TILES = 12;
const cache = new Map<string, Uint8Array>();
/** Distance around the position searched for the least water, in metres. */
const MARGIN_M = 10;
/** In a port: only the cells around the position, so not the quays and shores. */
const PORT_SPAN_CELLS = 1;

/** Forget the tiles read so far. */
export function forgetDepthTiles(): void {
  cache.clear();
}

async function fetchTile(key: string): Promise<Uint8Array> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}leman-depth/${key}.bin`,
  );
  if (!response.ok) throw new Error(`depth tile ${key}: ${response.status}`);
  const packed = new Blob([await response.arrayBuffer()]).stream();
  const stream = packed.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function tileCells(
  key: string,
  load: DepthTileLoader,
): Promise<Uint8Array> {
  const known = cache.get(key);
  if (known) return known;
  const loaded = await load(key);
  cache.set(key, loaded);
  if (cache.size > CACHED_TILES) {
    cache.delete(cache.keys().next().value as string);
  }
  return loaded;
}

/**
 * Depth of Lake Geneva from the swissBATHY3D cells of 2 m, down to 20 m: the
 * least water within 10 m of the position, as a GPS is never exact. In a port,
 * only the cell under the position and the eight around it count.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @param load - Reads a tile.
 * @returns The depth (m); `null` over deep water or land; `undefined` out of
 * the lake area, where these cells say nothing.
 */
export async function lemanDepthAt(
  lat: number,
  lon: number,
  load: DepthTileLoader = fetchTile,
): Promise<number | null | undefined> {
  const { s, n, w, e } = LEMAN_BBOX;
  if (lat < s || lat > n || lon < w || lon > e) return undefined;
  const [east, north] = wgsToLv95(lat, lon);
  const column = Math.floor(east / DEPTH_CELL_M);
  const row = Math.floor(north / DEPTH_CELL_M);
  const port = inLemanPort(lat, lon);
  const span = port ? PORT_SPAN_CELLS : Math.ceil(MARGIN_M / DEPTH_CELL_M);
  let lowest = DEPTH_DEEP;
  /* eslint-disable no-await-in-loop -- few cells, nearly always in a cached tile */
  for (let dy = -span; dy <= span; dy++) {
    for (let dx = -span; dx <= span; dx++) {
      if (!port && Math.hypot(dx, dy) * DEPTH_CELL_M > MARGIN_M) continue;
      const tileEast = Math.floor((column + dx) / DEPTH_TILE_CELLS);
      const tileNorth = Math.floor((row + dy) / DEPTH_TILE_CELLS);
      const key = `${tileEast}_${tileNorth}`;
      if (!SHALLOW_TILES.has(key)) continue;
      const cells = await tileCells(key, load);
      const cellColumn = column + dx - tileEast * DEPTH_TILE_CELLS;
      const cellRow =
        DEPTH_TILE_CELLS - 1 - (row + dy - tileNorth * DEPTH_TILE_CELLS);
      const value = cells[cellRow * DEPTH_TILE_CELLS + cellColumn] as number;
      lowest = Math.min(lowest, value);
    }
  }
  /* eslint-enable no-await-in-loop */
  return lowest >= DEPTH_DEEP ? null : lowest / DEPTH_SCALE;
}
