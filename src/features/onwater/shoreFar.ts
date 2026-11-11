/**
 * The land farther than 1 km from the sea or a lake of 2 km² or more, on a
 * grid of 0.005° over Europe (built from OpenStreetMap, see
 * `scripts/shore/build_shore.py`). A wind station there says little of the
 * wind on the water.
 */
export interface ShoreGrid {
  perDeg: number;
  lon0: number;
  lat0: number;
  tilesLon: number;
  tilesLat: number;
  /** Per tile: 0 all kept, 1 all far land, 2 mixed. */
  kinds: Uint8Array;
  /** Start of the runs of each mixed tile, by tile index. */
  runsAt: Map<number, number>;
  bytes: Uint8Array;
}

const MAGIC = 'NVSH';
const HEAD = 14;

/**
 * Read the grid file.
 * @param bytes - The file, unpacked.
 * @returns The grid, or `null` when the file is not one.
 */
export function parseShoreGrid(bytes: Uint8Array): ShoreGrid | null {
  if (bytes.length < HEAD) return null;
  if (String.fromCodePoint(...bytes.subarray(0, 4)) !== MAGIC) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint8(4) !== 1) return null;
  const perDeg = view.getUint8(5);
  const lon0 = view.getInt16(6, true);
  const lat0 = view.getInt16(8, true);
  const tilesLon = view.getUint16(10, true);
  const tilesLat = view.getUint16(12, true);
  const count = tilesLon * tilesLat;
  if (bytes.length < HEAD + count) return null;
  const kinds = bytes.subarray(HEAD, HEAD + count);
  const runsAt = new Map<number, number>();
  let at = HEAD + count;
  for (let tile = 0; tile < count; tile++) {
    if (kinds[tile] !== 2) continue;
    if (at + 2 > bytes.length) return null;
    const length = view.getUint16(at, true);
    runsAt.set(tile, at + 2);
    at += 2 + length;
  }
  return { perDeg, lon0, lat0, tilesLon, tilesLat, kinds, runsAt, bytes };
}

/**
 * Whether a place is on land, farther than 1 km from the sea or a lake.
 * @param grid - The grid.
 * @param lat - Latitude.
 * @param lon - Longitude.
 * @returns `true` only when the grid says so; `false` outside the grid.
 */
export function farFromShore(
  grid: ShoreGrid,
  lat: number,
  lon: number,
): boolean {
  const tileLon = Math.floor(lon - grid.lon0);
  const tileLat = Math.floor(lat - grid.lat0);
  if (
    tileLon < 0 ||
    tileLat < 0 ||
    tileLon >= grid.tilesLon ||
    tileLat >= grid.tilesLat
  ) {
    return false;
  }
  const tile = tileLat * grid.tilesLon + tileLon;
  const kind = grid.kinds[tile];
  if (kind !== 2) return kind === 1;
  const per = grid.perDeg;
  const column = Math.min(
    per - 1,
    Math.floor((lon - grid.lon0 - tileLon) * per),
  );
  const row = Math.min(per - 1, Math.floor((lat - grid.lat0 - tileLat) * per));
  return cellIsFar(grid.bytes, grid.runsAt.get(tile) ?? 0, row * per + column);
}

/** Walk the runs, kept then far by turns, up to the cell. */
function cellIsFar(bytes: Uint8Array, start: number, cell: number): boolean {
  let at = start;
  let far = false;
  let passed = 0;
  for (;;) {
    let run = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = bytes[at++] ?? 0;
      run += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);
    passed += run;
    if (cell < passed) return far;
    if (at >= bytes.length) return false;
    far = !far;
  }
}

let loading: Promise<ShoreGrid | null> | null = null;

/** Forget the grid read, so that it is read again. */
export function forgetShoreGrid(): void {
  loading = null;
}

async function fetchGrid(): Promise<ShoreGrid | null> {
  const response = await fetch(`${import.meta.env.BASE_URL}shore-far.bin`);
  if (!response.ok) return null;
  const packed = new Blob([await response.arrayBuffer()]).stream();
  const stream = packed.pipeThrough(new DecompressionStream('gzip'));
  return parseShoreGrid(
    new Uint8Array(await new Response(stream).arrayBuffer()),
  );
}

/**
 * The grid, read once; `null` when it cannot be read (it is tried again
 * next time).
 * @returns The grid or `null`.
 */
export function shoreGrid(): Promise<ShoreGrid | null> {
  const reading = loading ?? fetchGrid().catch(() => null);
  loading = reading;
  void reading.then((grid) => {
    if (!grid && loading === reading) forgetShoreGrid();
  });
  return reading;
}

/**
 * The places that are not on land far from the water: those at sea, on a
 * lake or within 1 km of the shore. Everything is kept without the grid, and
 * a place without a position is kept.
 * @param places - Stations or readings.
 * @returns Those kept, in the same order.
 */
export async function nearWater<T extends { lat?: number; lon?: number }>(
  places: readonly T[],
): Promise<T[]> {
  const grid = await shoreGrid();
  if (!grid) return [...places];
  return places.filter(
    ({ lat, lon }) =>
      lat == null || lon == null || !farFromShore(grid, lat, lon),
  );
}
